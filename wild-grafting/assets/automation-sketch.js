/* Composition study. These invented paths are not album evidence.
   Silent canvas/SVG drawing only: no recording, media, or audio graph is changed. */
(function () {
  'use strict';
  const root = document.querySelector('.automation-sketch');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  const $ = selector => root.querySelector(selector);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const roles = [
    {name: 'Anchor', color: '#df1d7c', ui: '#c71568', height: -.08, width: .07, initial: [0, .07, -.05, .06, 0]},
    {name: 'Pulse', color: '#54218e', ui: '#54218e', height: .16, width: .17, initial: [-.45, .35, -.6, .45, -.1]},
    {name: 'Reply', color: '#007fbd', ui: '#006a9f', height: .38, width: .3, initial: [.65, .2, -.55, -.15, .65]}
  ];
  roles.forEach(role => role.points = role.initial.slice());
  const canvas = $('.as-sphere'), ctx = canvas.getContext('2d');
  const curve = $('.as-curve'), points = $('.as-points'), trace = $('.as-trace');
  const cursor = $('.as-cursor'), moving = $('.as-moving-point');
  const time = $('.as-time'), direction = $('.as-direction'), play = $('.as-play');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selectedRole = 0, selectedPoint = 0, phase = 0, frame = null, previous = 0, playing = false;
  const directionText = value => Math.abs(value) < .005 ? 'Front' : `${Math.round(Math.abs(value) * 100)}% ${value > 0 ? 'left' : 'right'}`;
  function sample(role, at) {
    const p = clamp(at, 0, 1) * 4, i = Math.min(3, Math.floor(p)), mix = p - i;
    return role.points[i] * (1 - mix) + role.points[i + 1] * mix;
  }
  const xyz = (az, el) => [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  // Fixed elevated frontal view: the listener's left is the drawing's left.
  function project(p) {
    const elevation = .3;
    return [300 - p[1] * 163, 221 + (Math.sin(elevation) * p[0] - Math.cos(elevation) * p[2]) * 163, Math.cos(elevation) * p[0] + Math.sin(elevation) * p[2]];
  }
  function line(path, color, width, dashed) {
    ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dashed ? [3, 6] : []); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawSphere() {
    ctx.clearRect(0, 0, 600, 440);
    const meridians = Array.from({length: 6}, (_, i) => Array.from({length: 73}, (_, j) => xyz(i * Math.PI / 6, j * Math.PI * 2 / 72)));
    const parallels = [-60, -30, 0, 30, 60].map(e => Array.from({length: 73}, (_, j) => xyz(j * Math.PI * 2 / 72, e * Math.PI / 180)));
    [...meridians, ...parallels].forEach(path => {
      const p = path.map(project);
      for (let i = 1; i < p.length; i++) {
        const back = (p[i - 1][2] + p[i][2]) < 0;
        line([p[i - 1], p[i]], back ? '#d7cdd9' : '#b09fc0', back ? .6 : .9, back);
      }
    });
    ctx.beginPath();ctx.arc(300, 221, 163, 0, Math.PI * 2);ctx.strokeStyle='#846b99';ctx.lineWidth=.8;ctx.stroke();
    roles.forEach((role, index) => {
      const isSelected = index === selectedRole;
      ctx.globalAlpha = isSelected ? 1 : .28;
      const path = Array.from({length: 65}, (_, i) => project(xyz(sample(role, i / 64) * Math.PI / 2, role.height)));
      line(path, role.color, isSelected ? 2 : 1.2, true);
      const az = sample(role, phase) * Math.PI / 2;
      const arc = Array.from({length: 17}, (_, i) => project(xyz(az - role.width + role.width * 2 * i / 16, role.height)));
      line(arc, role.color, isSelected ? 3 : 1.5, false);
      [az - role.width, az + role.width].forEach(a => {
        const p = project(xyz(a, role.height));ctx.beginPath();ctx.arc(p[0], p[1], isSelected ? 5 : 3, 0, Math.PI * 2);ctx.fillStyle=role.color;ctx.fill();
      });
      const p = project(xyz(az, role.height));ctx.beginPath();ctx.arc(p[0],p[1],isSelected?8:4,0,Math.PI*2);ctx.fillStyle=role.color;ctx.fill();ctx.strokeStyle='#faf8f0';ctx.lineWidth=2;ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle='#645667';ctx.font='16px "Courier New", monospace';ctx.textAlign='center';
    ctx.fillText('left', 86, 226);ctx.fillText('right', 514, 226);ctx.fillText('front', 300, 421);
    canvas.setAttribute('aria-label', `${roles[selectedRole].name} at ${Math.round(phase * 100)}% of the phrase: ${directionText(sample(roles[selectedRole], phase))}. Invented path for the composition study.`);
  }
  function sync() {
    const role = roles[selectedRole];
    root.style.setProperty('--as-role', role.color);
    root.style.setProperty('--as-ui', role.ui);
    root.querySelectorAll('[data-as-role]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.asRole) === selectedRole)));
    $('.as-curve-role').textContent = role.name;
    trace.setAttribute('d', role.points.map((p, i) => `${i ? 'L' : 'M'}${i * 125},${100 - p * 90}`).join(' '));
    const x = phase * 500, y = 100 - sample(role, phase) * 90;
    cursor.setAttribute('d', `M${x} 0V200`);moving.setAttribute('cx',x);moving.setAttribute('cy',y);
    points.querySelectorAll('button').forEach((button, i) => {
      button.style.left = `${i * 25}%`;button.style.top = `${50 - role.points[i] * 45}%`;
      button.setAttribute('aria-pressed', String(i === selectedPoint));
      button.setAttribute('aria-label', `Point ${i + 1}, ${directionText(role.points[i])}. Arrow up moves left; arrow down moves right.`);
    });
    $('.as-point-number').textContent = selectedPoint + 1;
    const label = directionText(role.points[selectedPoint]);
    $('.as-direction-output').textContent = label;direction.value = Math.round(role.points[selectedPoint] * 100);direction.setAttribute('aria-valuetext', label);
    time.value = phase * 100;$('.as-time-output').textContent=`${Math.round(phase * 100)}%`;time.setAttribute('aria-valuetext', `${Math.round(phase * 100)}% through phrase`);
    drawSphere();
  }
  function setPoint(value) {roles[selectedRole].points[selectedPoint] = clamp(value, -1, 1);sync();}
  function stop() {playing=false;cancelAnimationFrame(frame);frame=null;play.textContent='Follow the path';play.setAttribute('aria-pressed','false');}
  function tick(timestamp) {
    if (!playing) return;
    const elapsed = Math.min(.05, (timestamp - previous) / 1000);previous=timestamp;
    phase = Math.min(1, phase + elapsed / 8);sync();
    if (phase >= 1) stop();else frame=requestAnimationFrame(tick);
  }
  for (let i=0;i<5;i++) {
    const button=document.createElement('button');button.type='button';button.className='as-point';button.innerHTML=`<span>${i+1}</span>`;points.append(button);
    button.addEventListener('click',()=>{selectedPoint=i;sync();});
    button.addEventListener('focus',()=>{selectedPoint=i;sync();});
    button.addEventListener('keydown',event=>{
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();selectedPoint=i;
      if(event.key==='Home')setPoint(-1);else if(event.key==='End')setPoint(1);else setPoint(roles[selectedRole].points[i]+(['ArrowUp','ArrowRight'].includes(event.key)?1:-1)*(event.shiftKey ? .1 : .02));
    });
    let dragging=false;
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;stop();selectedPoint=i;dragging=true;button.setPointerCapture(event.pointerId);button.focus({preventScroll:true});sync();
    });
    button.addEventListener('pointermove',event=>{if(!dragging)return;const rect=curve.getBoundingClientRect();setPoint((.5-(event.clientY-rect.top)/rect.height)/.45);});
    const finish=()=>{dragging=false;};button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',finish);button.addEventListener('lostpointercapture',finish);
  }
  root.querySelectorAll('[data-as-role]').forEach(button=>button.addEventListener('click',()=>{selectedRole=Number(button.dataset.asRole);sync();}));
  direction.addEventListener('input',()=>setPoint(Number(direction.value)/100));
  time.addEventListener('input',()=>{stop();phase=Number(time.value)/100;sync();});
  play.addEventListener('click',()=>{
    if(playing){stop();return;}if(reduced.matches)return;
    if(phase>=1)phase=0;playing=true;previous=performance.now();play.textContent='Pause the path';play.setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);
  });
  $('.as-reset').addEventListener('click',()=>{stop();roles.forEach(role=>role.points=role.initial.slice());phase=0;selectedPoint=0;sync();});
  function motionPreference(){if(reduced.matches)stop();play.disabled=reduced.matches;$('.as-reduced-note').hidden=!reduced.matches;}
  reduced.addEventListener('change',motionPreference);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();});observer.observe(root);
  motionPreference();sync();
})();
