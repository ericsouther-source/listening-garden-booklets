(() => {
  'use strict';
  const catalog = window.WG_FIELD_CATALOG;
  if (!catalog) return;
  const paper = '#faf8f0', ink = '#54218e', loads = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
  const normal = v => { const length = Math.hypot(...v); return length ? v.map(x => x / length) : [1, 0, 0]; };
  const timeLabel = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const grid = [];
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const e = latitude * Math.PI / 180;
    grid.push(Array.from({length:73}, (_, i) => { const a = i * Math.PI / 36; return [Math.cos(e)*Math.cos(a), Math.cos(e)*Math.sin(a), Math.sin(e)]; }));
  }
  for (let longitude = 0; longitude < 180; longitude += 45) {
    const a = longitude * Math.PI / 180;
    grid.push(Array.from({length:73}, (_, i) => { const e = i * Math.PI / 36; return [Math.cos(e)*Math.cos(a), Math.cos(e)*Math.sin(a), Math.sin(e)]; }));
  }
  function load(track) {
    if (window.WG_FIELD_DATA?.[track]) return Promise.resolve(window.WG_FIELD_DATA[track]);
    if (!loads.has(track)) loads.set(track, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = catalog.tracks[track].src;
      script.onload = () => {
        const data = window.WG_FIELD_DATA?.[track];
        if (data) resolve(data); else { loads.delete(track); reject(new Error('Missing field data')); }
      };
      script.onerror = () => { loads.delete(track); script.remove(); reject(new Error('Field unavailable')); };
      document.head.append(script);
    }));
    return loads.get(track);
  }
  function make(audio) {
    const container = document.createElement('section');
    container.className = 'mini-field';
    container.setAttribute('aria-label', 'Ambisonic view for this recording');
    container.innerHTML = `<div class="mini-field-heading"><span>IN THE FIELD</span><span class="mini-field-time" aria-live="off"></span></div>
      <div class="mini-field-layout"><canvas width="360" height="360" tabindex="0" role="img" aria-label="Sound roles in an ambisonic sphere. Drag horizontally or use arrow keys to turn; Home resets the view."></canvas><ul class="mini-field-key" aria-label="Sound roles"></ul></div>
      <div class="mini-field-controls"><label><input type="checkbox" checked> Follow sound</label><button type="button">Reset view</button></div>
      <p class="mini-field-note">Filled dots mark written notes; open dots mark rests. Drag to turn.</p>
      <p class="mini-field-error" role="status" hidden></p>`;
    const slot = audio.id === 'comparison-player' && document.querySelector('.comparison-field-slot');
    if (slot) slot.append(container); else audio.before(container);
    const canvas = container.querySelector('canvas'), ctx = canvas.getContext('2d');
    const key = container.querySelector('ul'), follow = container.querySelector('input');
    const clock = container.querySelector('.mini-field-time'), error = container.querySelector('[role="status"]');
    let entry, data, visible = false, serial = 0, raf = 0, lastFrame = 0, moment = 0;
    let az = Math.PI / 4, elev = 25 * Math.PI / 180, width = 0, dragging = null, labels = [];
    follow.checked = !reduced.matches;
    function lookup() {
      const filename = decodeURIComponent(new URL(audio.dataset.fieldFile || audio.getAttribute('src') || '', location.href).pathname.split('/').pop());
      return catalog.audio[filename];
    }
    function currentTime() { return clamp((entry?.origin || 0) + ((audio.gardenTransport || audio).currentTime || 0), 0, data?.duration || 0); }
    function activeAt(t, role) {
      const intervals = (entry.edition === 'garden' ? data.gardenActivity : data.activity)[role];
      const sample = Math.floor(t * data.sampleRate);
      let lo = 0, hi = intervals.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (intervals[mid][0] <= sample) lo = mid + 1; else hi = mid; }
      return lo > 0 && sample < intervals[lo - 1][1];
    }
    function vector(t, role, offset = 0) {
      const f = clamp(t * data.fps, 0, data.frames.length - 1), lower = Math.floor(f), upper = Math.min(lower + 1, data.frames.length - 1), q = f - lower;
      const a = data.frames[lower][role + 1], b = data.frames[upper][role + 1];
      return normal([0,1,2].map(j => a[offset+j] + q*(b[offset+j]-a[offset+j])));
    }
    function draw() {
      if (!width || !visible) return;
      const center = width / 2, radius = width * .405;
      const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(elev), se = Math.sin(elev);
      const right = [sa,-ca,0], up = [-se*ca,-se*sa,ce], eye = [ce*ca,ce*sa,se];
      const project = p => ({x:center+radius*dot(p,right),y:center-radius*dot(p,up),depth:dot(p,eye)});
      ctx.clearRect(0,0,width,width);
      const path = (points, color, lineWidth, dashed=false) => {
        ctx.beginPath(); points.forEach((p,i) => { const q=project(p); i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); });
        ctx.strokeStyle=color; ctx.lineWidth=lineWidth; ctx.setLineDash(dashed?[1.5,3]:[]); ctx.stroke(); ctx.setLineDash([]);
      };
      grid.forEach(line => {
        for(let i=1;i<line.length;i++){
          const back = dot(line[i],eye) < 0;
          path([line[i-1],line[i]],back?'#d3c7d1':'#ad98b7',back?.5:.65,back);
        }
      });
      ctx.beginPath(); ctx.arc(center,center,radius,0,Math.PI*2); ctx.strokeStyle=ink; ctx.lineWidth=.8; ctx.stroke();
      [[1,0,0,'front'],[0,0,1,'up']].forEach(axis => {
        const p=project(axis.slice(0,3).map(v=>v*1.13)); ctx.font='10px ui-monospace,monospace'; ctx.fillStyle=ink; ctx.textAlign='center';ctx.fillText(axis[3],p.x,p.y+3);
      });
      if (!data || !entry) return;
      const endpoints=[];
      data.roleLabels.forEach((role,i) => {
        const active=activeAt(moment,i), color=data.roleColors[i], trail=[];
        for(let t=Math.max(0,moment-1.5);t<moment;t+=.1)trail.push(vector(t,i));
        trail.push(vector(moment,i)); path(trail,color,.85,true);
        const left=vector(moment,i,3),rightPoint=vector(moment,i,6),angle=Math.acos(clamp(dot(left,rightPoint),-1,1)),pair=[];
        const fixedElevation=Math.asin(clamp(vector(moment,i)[2],-1,1));
        const la=Math.atan2(left[1],left[0]),ra=Math.atan2(rightPoint[1],rightPoint[0]),span=Math.atan2(Math.sin(ra-la),Math.cos(ra-la));
        for(let n=0;n<=16;n++){
          const q=n/16;
          if(data.roleKinds[i]==='strings'){
            const a=la+q*span;pair.push([Math.cos(fixedElevation)*Math.cos(a),Math.cos(fixedElevation)*Math.sin(a),Math.sin(fixedElevation)]);
          }else pair.push(angle<.000001?left:normal(left.map((v,j)=>(Math.sin((1-q)*angle)*v+Math.sin(q*angle)*rightPoint[j])/Math.sin(angle))));
        }
        path(pair,color,active?1.5:.8);
        [left,rightPoint].forEach(v=>endpoints.push({...project(v),color,active}));
        labels[i].dataset.active=String(active);
        labels[i].querySelector('.mini-role-state').textContent=active?'note':'rest';
      });
      endpoints.sort((a,b)=>a.depth-b.depth).forEach(p=>{
        ctx.beginPath();ctx.arc(p.x,p.y,width<150?2.3:3,0,Math.PI*2);ctx.fillStyle=p.active?p.color:paper;ctx.strokeStyle=p.color;ctx.lineWidth=1.2;ctx.fill();ctx.stroke();
      });
      const timestamp=timeLabel(moment);
      if(clock.textContent!==timestamp)clock.textContent=timestamp;
      container.dataset.time=moment.toFixed(3);
    }
    function resize() {
      width=canvas.getBoundingClientRect().width;
      const ratio=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(width*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();
    }
    function stop() { cancelAnimationFrame(raf);raf=0;lastFrame=0; }
    function tick(now) {
      raf=0;
      if(!visible||document.hidden||(audio.gardenTransport || audio).paused||!follow.checked)return;
      if(!lastFrame||now-lastFrame>=48){lastFrame=now;moment=currentTime();draw();}
      raf=requestAnimationFrame(tick);
    }
    function start() { if(!raf&&visible&&!document.hidden&&!(audio.gardenTransport || audio).paused&&follow.checked)raf=requestAnimationFrame(tick); }
    async function bind() {
      const token=++serial;entry=lookup();data=null;key.replaceChildren();labels=[];
      error.hidden=true;container.dataset.ready='false';
      if(!entry){error.textContent='A field drawing is not available for this recording.';error.hidden=false;draw();return;}
      container.dataset.track=entry.track;container.dataset.edition=entry.edition;
      if(!visible)return;
      try{
        const loaded=await load(entry.track);if(token!==serial)return;data=loaded;
        data.roleLabels.forEach((role,i)=>{
          const item=document.createElement('li'),mark=document.createElement('span'),name=document.createElement('span'),state=document.createElement('span');
          mark.className='mini-role-dot';mark.setAttribute('aria-hidden','true');name.textContent=role;state.className='mini-role-state';
          item.style.setProperty('--role-ink',data.roleColors[i]);item.append(mark,name,state);key.append(item);labels.push(item);
        });
        moment=currentTime();container.dataset.ready='true';resize();start();
      }catch(_){if(token===serial){error.textContent='The field drawing could not load. The recording is still available.';error.hidden=false;}}
    }
    audio.addEventListener('play',()=>{if(!data)bind();start();});
    audio.addEventListener('pause',()=>{if(audio.gardenTransport)return;stop();if(follow.checked){moment=currentTime();draw();}});
    audio.addEventListener('ended',()=>{if(audio.gardenTransport)return;stop();if(follow.checked){moment=currentTime();draw();}});
    audio.addEventListener('seeked',()=>{moment=currentTime();draw();});
    audio.addEventListener('gardenstatechange',()=>{
      if((audio.gardenTransport || audio).paused)stop();else start();
      if(follow.checked){moment=currentTime();draw();}
    });
    audio.addEventListener('gardentimeupdate',()=>{if(follow.checked){moment=currentTime();draw();}});
    audio.addEventListener('albumtrackchange',bind);
    follow.addEventListener('change',()=>{if(follow.checked){moment=currentTime();draw();start();}else stop();});
    reduced.addEventListener('change',event=>{if(event.matches){follow.checked=false;stop();}});
    document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
    function rotate(x,y){az+=x;elev=clamp(elev+y,-Math.PI*.47,Math.PI*.47);draw();}
    const reset=()=>{az=Math.PI/4;elev=25*Math.PI/180;draw();};
    container.querySelector('button').addEventListener('click',reset);
    canvas.addEventListener('keydown',event=>{
      const keys={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,.15],ArrowDown:[0,-.15]};
      if(keys[event.key]){event.preventDefault();rotate(...keys[event.key]);}else if(event.key==='Home'){event.preventDefault();reset();}
    });
    canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragging={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{if(!dragging)return;rotate((event.clientX-dragging.x)*.012,(event.clientY-dragging.y)*.012);dragging={x:event.clientX,y:event.clientY};});
    ['pointerup','pointercancel','lostpointercapture'].forEach(name=>canvas.addEventListener(name,()=>{dragging=null;}));
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if(visible){if(!data)bind();else{if(follow.checked)moment=currentTime();resize();start();}}else stop();
    },{rootMargin:'80px'}).observe(container);
  }
  document.querySelectorAll('audio:not([data-comparison-buddy])').forEach(audio=>{if(audio.id!=='field-audio')make(audio);});
})();
