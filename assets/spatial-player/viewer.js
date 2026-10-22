(() => {
 const root=document.querySelector('[data-spatial-player]');if(!root)return;
 const q=s=>root.querySelector(s),audio=q('#fc-audio'),play=q('#fc-play'),restart=q('#fc-restart'),seek=q('#fc-seek'),status=q('#fc-status'),canvas=q('canvas'),ctx=canvas.getContext('2d'),follow=q('#fc-follow'),readout=q('#fc-field-status');
 const M=window.SpatialFieldMath;let baseAudio=audio.getAttribute('src');
 let data,chosen,operation=0,ending=false,requested=0,viewTime=0,raf=0,yaw=.65,pitch=.38,drag=null;
 const stamp=t=>`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`;
 follow.checked=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 function draw(time=viewTime){
  if(!chosen||!ctx)return;viewTime=Math.max(chosen.start,Math.min(chosen.end,time));
  const rect=canvas.getBoundingClientRect(),size=rect.width,dpr=Math.min(devicePixelRatio||1,2);if(!size)return;
  canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
  const R=size*.37,cx=size/2,cy=size*.49,camera=[Math.cos(pitch)*Math.cos(yaw),Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch)],right=[-Math.sin(yaw),Math.cos(yaw),0],up=[-Math.sin(pitch)*Math.cos(yaw),-Math.sin(pitch)*Math.sin(yaw),Math.cos(pitch)];
  const project=v=>({x:cx+R*dot(v,right),y:cy-R*dot(v,up),z:dot(v,camera)});
  function line(points,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;for(let i=1;i<points.length;i++){const a=project(points[i-1]),b=project(points[i]);ctx.globalAlpha=(a.z+b.z)<0?.23:.6;ctx.setLineDash((a.z+b.z)<0?[2,4]:[]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.setLineDash([]);ctx.globalAlpha=1;}
  const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,R);halo.addColorStop(0,'#203126');halo.addColorStop(1,'#131c15');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fill();
  for(let e=-2;e<=2;e++)line(Array.from({length:97},(_,i)=>M.vector(i*Math.PI/48,e*Math.PI/6)),'#72917a');
  for(let a=0;a<8;a++)line(Array.from({length:49},(_,i)=>M.vector(a*Math.PI/4,i*Math.PI/48-Math.PI/2)),'#72917a');
  ctx.strokeStyle='#537060';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();
  const state=M.state(data,chosen,viewTime);
  // Anchor reference is always visible; filled marks indicate active score events.
  const anchor=project(M.vector(...data.anchor.geometry));ctx.strokeStyle=data.roles.find(r=>r.id===data.anchor.roles[0]).color;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(anchor.x,anchor.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(anchor.x,anchor.y,12,0,Math.PI*2);ctx.stroke();
  const marks=[];for(const group of state.groups){const role=data.roles.find(r=>r.id===group.role);const points=group.points.map(project);if(role.geometry.kind!=='fixed'){ctx.strokeStyle=role.color;ctx.globalAlpha=.25;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);ctx.lineTo(points[1].x,points[1].y);ctx.stroke();ctx.globalAlpha=1;}for(const p of points)marks.push({...p,role:group.role,color:role.color,shape:role.shape,size:role.size});}
  marks.sort((a,b)=>a.z-b.z);for(const p of marks){ctx.globalAlpha=p.z<0?.4:1;ctx.fillStyle=p.color;ctx.strokeStyle='#11130f';ctx.lineWidth=1;ctx.beginPath();if(p.shape==='square'){ctx.rect(p.x-p.size,p.y-p.size,p.size*2,p.size*2);}else{ctx.arc(p.x,p.y,p.size,0,Math.PI*2);}ctx.fill();ctx.stroke();}ctx.globalAlpha=1;
  ctx.fillStyle='#f7f4e9';ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();ctx.font=`${Math.max(10,size*.023)}px monospace`;ctx.textAlign='center';
  for(const [label,v] of [['FRONT',[1.14,0,0]],['BACK',[-1.14,0,0]],['LEFT',[0,1.14,0]],['RIGHT',[0,-1.14,0]],['UP',[0,0,1.14]]]){const p=project(v);ctx.fillStyle=p.z<0?'#819587':'#d5dfcf';ctx.fillText(label,p.x,p.y);}
  ctx.fillStyle='#c5c9ba';ctx.fillText('LISTENER',cx,cy+18);ctx.fillStyle='#c9ef69';ctx.textAlign='left';ctx.fillText(stamp(viewTime),16,size-18);
  canvas.dataset.time=String(viewTime);canvas.dataset.frame=String(state.frame);canvas.dataset.grainPairs=String(state.grainPairs);canvas.dataset.yaw=String(yaw);canvas.dataset.pitch=String(pitch);
  readout.textContent=`${follow.checked?'Following playback':'View held'} · ${stamp(viewTime)} · ${state.grainPairs} ${data.movingEventLabel||'moving events'} · ${data.anchor.label} ${data.anchor.roles.some(r=>state.activeRoles.includes(r))?'active':'resting'}`;
 }
 function update(force=false){if(!chosen)return;const t=audio.readyState?audio.currentTime:requested;const offset=Math.max(0,Math.min(chosen.end-chosen.start,t-chosen.start));seek.value=offset;seek.setAttribute('aria-valuetext',`${offset.toFixed(2)} seconds of ${(chosen.end-chosen.start).toFixed(2)}`);play.textContent=audio.paused?'Play passage':'Pause';if(force||follow.checked)draw(chosen.start+offset);}
 function boundary(){if(!chosen||ending)return;if(audio.currentTime>=chosen.end){ending=true;audio.pause();audio.currentTime=chosen.end;requested=chosen.end;status.textContent=`End of passage · ${stamp(chosen.end)}`;update();}}
 function tick(){boundary();update();if(!audio.paused&&!document.hidden)raf=requestAnimationFrame(tick);}
 function runClock(){cancelAnimationFrame(raf);if(!audio.paused&&!document.hidden)raf=requestAnimationFrame(tick);}
 function choose(key){operation++;audio.pause();chosen=data.windows.find(w=>w.key===key);ending=false;requested=chosen.start;audio.src=baseAudio+`#t=${chosen.start},${chosen.end}`;root.querySelectorAll('[data-passage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.passage===key)));seek.max=chosen.end-chosen.start;seek.value=0;q('#fc-fallback').href=audio.src;status.textContent=`${chosen.title} · ${chosen.time}`;draw(chosen.start);play.textContent='Play passage';}
 async function start(){const token=++operation;if(!audio.paused){audio.pause();return;}try{if(audio.readyState<1){status.textContent='Loading the recording';await new Promise((resolve,reject)=>{const clean=()=>{audio.removeEventListener('loadedmetadata',ok);audio.removeEventListener('error',bad);};const ok=()=>{clean();resolve();},bad=()=>{clean();reject(Error('audio'));};audio.addEventListener('loadedmetadata',ok);audio.addEventListener('error',bad);audio.load();});}if(token!==operation)return;let t=requested;if(t<chosen.start||t>=chosen.end-.02)t=chosen.start;if(Math.abs(audio.currentTime-t)>.001)audio.currentTime=t;ending=false;await audio.play();if(token!==operation){audio.pause();return;}status.textContent=`Playing ${chosen.title} · ${chosen.time}`;}catch(e){if(token===operation)status.textContent='Playback could not start. Use the direct passage link.';}}
 play.addEventListener('click',start);
 restart.addEventListener('click',()=>{operation++;audio.pause();ending=false;requested=chosen.start;if(audio.readyState)audio.currentTime=requested;update(true);status.textContent=`${chosen.title} · ${chosen.time}`;});
 seek.addEventListener('input',()=>{ending=false;requested=chosen.start+Number(seek.value);if(audio.readyState)audio.currentTime=requested;draw(requested);});
 audio.addEventListener('timeupdate',()=>{boundary();if(audio.readyState)requested=audio.currentTime;update();});
 // Explicit inspection draws in the slider/restart handlers. Internal boundary seeks respect held motion.
 audio.addEventListener('seeked',()=>update());
 audio.addEventListener('play',()=>{document.querySelectorAll('audio').forEach(a=>{if(a!==audio)a.pause();});runClock();update();});
 audio.addEventListener('pause',()=>{cancelAnimationFrame(raf);if(audio.readyState)requested=audio.currentTime;update();if(!ending&&chosen)status.textContent=`Paused · ${chosen.title}`;});
 audio.addEventListener('ended',()=>{ending=true;status.textContent=`End of passage · ${stamp(chosen.end)}`;update();});
 document.addEventListener('play',e=>{if(e.target!==audio&&e.target instanceof HTMLMediaElement){operation++;audio.pause();}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else{boundary();update();runClock();}});
 follow.addEventListener('change',()=>{draw(audio.readyState?audio.currentTime:requested);});
 function camera(dx,dy,reset=false){if(reset){yaw=.65;pitch=.38;}else{yaw+=dx;pitch=Math.max(-1.3,Math.min(1.3,pitch+dy));}draw();}
 canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
 canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;camera(-(e.clientX-drag.x)*.008,(e.clientY-drag.y)*.008);drag.x=e.clientX;drag.y=e.clientY;});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});
 canvas.addEventListener('keydown',e=>{const keys={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,.15],ArrowDown:[0,-.15],Home:[0,0,true]};if(keys[e.key]){e.preventDefault();camera(...keys[e.key]);}});
 root.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>camera(...JSON.parse(b.dataset.camera))));
 root.querySelectorAll('[data-passage]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.passage)));
 new ResizeObserver(()=>draw()).observe(canvas);
 let loading=false;function loadField(){if(loading)return;loading=true;fetch(root.dataset.motionUrl).then(r=>{if(!r.ok)throw Error(r.status);return r.json().then(d=>({d,url:r.url}));}).then(({d,url})=>{if(d.schemaVersion!==1||d.adapter!=='lg-native-directions-v1')throw Error('Unsupported spatial data');data=d;baseAudio=new URL(d.mediaUrl,url).href;choose(data.windows[0].key);root.querySelectorAll('[data-passage]').forEach(b=>b.disabled=false);play.disabled=restart.disabled=seek.disabled=false;root.dataset.ready='true';}).catch(()=>{status.textContent='The field view could not load. The recording links remain available.';});}
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){loadField();observer.disconnect();}},{rootMargin:'300px'});observer.observe(root);}else loadField();
 root.addEventListener('focusin',loadField,{once:true});
})();
