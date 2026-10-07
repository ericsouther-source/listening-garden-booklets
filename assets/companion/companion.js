(() => {
  'use strict';
  const root = document.getElementById('garden-companion');
  if (!root) return;
  const flower = root.querySelector('.companion-flower');
  const drawing = flower.querySelector('svg');
  const stop = root.querySelector('.companion-stop');
  const motion = root.querySelector('.companion-motion');
  const status = root.querySelector('.companion-status');
  const audio = root.querySelector('audio');
  const head = root.querySelector('.companion-head');
  const stem = root.querySelector('.companion-stem');
  const leaves = [...root.querySelectorAll('.companion-leaves path')];
  const petals = root.querySelector('.companion-petals');
  const petalInk = root.querySelector('#companion-pink-ink > path');
  const eyes = [...root.querySelectorAll('.companion-eye')];
  const smile = root.querySelector('.companion-smile');
  const mouth = root.querySelector('.companion-mouth');
  const blush = root.querySelector('.companion-blush');
  const halo = root.querySelector('.companion-halo');
  const seeds = root.querySelector('.companion-seeds');
  const pollen = [...seeds.children].map((dot, index) => ({
    dot, offset: index / seeds.children.length, radius: +dot.getAttribute('r'),
    x: +dot.getAttribute('cx'), y: +dot.getAttribute('cy')
  }));
  const grass = [
    [22,326,17,-7,1.5],[34,323,29,4,2],[42,328,21,-9,1.8],
    [52,322,41,-11,2.5],[60,330,25,9,2],[69,324,34,-4,2.5],
    [77,320,48,9,2.7],[84,327,29,-12,2],[91,322,39,3,2.8],
    [99,325,24,12,2.2],[106,318,44,-7,2.5],[113,320,31,8,2.8],
    [120,326,47,13,2.6],[127,320,34,-4,2.3],[136,327,27,10,2],
    [143,323,45,-6,2.7],[151,329,22,9,2],[161,322,37,14,2.5],
    [170,326,26,-4,1.8],[179,321,32,10,2],[191,327,20,6,1.7],
    [201,324,13,5,1.3]
  ].map(([x,y,height,lean,width], index) => {
    const blade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    blade.setAttribute('fill', ['#247345','#68bc78','#86ba81'][index % 3]);
    blade.setAttribute('opacity', index < 3 || index > 18 ? '.6' : '.9');
    root.querySelector('.companion-grass').appendChild(blade);
    return {blade,x,y,height,lean,width,index};
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const data = window.gardenCompanionSounds;
  delete window.gardenCompanionSounds;
  if (!data || !data.sounds.length) return;
  let active, bag = [], last = -1, request = 0, inView = false;
  let frame = 0, previous = 0, phase = 0, rotation = 0, level = 0, oldLevel = 0;
  let gazeX = 0, gazeY = 0, targetX = 0, targetY = 0;
  let blinkAt = 3, blinkStart = -1;
  let motionPaused = false;
  let pointerX = 0, pointerY = 0, pointerActive = false;
  let bodyLevel = 0, bloomPoint = {x:121,y:79}, drawingBox, boundsDirty = true;
  let mouthLevel = 0, toneLevel = 0;
  const inks = [[243,43,139],[108,47,171],[36,148,104]];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  // The flower remembers each recording's measured envelope; no sound analysis runs on the phone.
  const nextSound = sounds => {
    if (!bag.length) {
      bag = sounds.map((_, index) => index);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    last = bag.pop();
    return sounds[last];
  };
  function bendStem(energy, still = false) {
    const point = fraction => {
      const wave = still ? 0 : Math.sin(phase * .9 - fraction * 2.4) * (4 + energy * 17) * fraction
        + Math.sin(phase * 1.7 - fraction * 3.2) * (1 + energy * 8) * fraction * fraction;
      return {
        x: 110 + 11 * fraction + Math.sin(fraction * Math.PI) * 4 + wave,
        y: 315 - 236 * fraction + (still ? 0 : Math.sin(phase * 1.4 - fraction * 2.2) * (1 + energy * 2) * fraction)
      };
    };
    const points = Array.from({length:9}, (_, i) => point(i / 8));
    let curve = 'M110 315';
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i], next = points[i + 1];
      const end = i === points.length - 2 ? next : {x:(p.x + next.x) / 2,y:(p.y + next.y) / 2};
      curve += `Q${p.x.toFixed(2)} ${p.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    }
    stem.setAttribute('d', curve);
    leaves.forEach((leaf, index) => {
      const f = [.31,.5,.68][index], p = point(f), above = point(f + .02);
      const angle = Math.atan2(above.x - p.x, p.y - above.y) * 180 / Math.PI;
      const flutter = still ? 0 : Math.sin(phase * 2.2 - index * 1.7) * (2 + energy * 6);
      leaf.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${(angle + flutter).toFixed(2)})`);
    });
    const tip = points[8];
    bloomPoint = tip;
    head.setAttribute('transform', `translate(${tip.x.toFixed(2)} ${tip.y.toFixed(2)}) rotate(${(still ? 0 : Math.sin(phase * 1.15) * 3 + gazeX * .65).toFixed(2)}) scale(1.25)`);
  }
  function resetPollen() {
    pollen.forEach(({dot,x,y,radius}) => {
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', radius); dot.removeAttribute('opacity');
    });
  }
  function bendGrass(energy, still = false) {
    grass.forEach(({blade,x,y,height,lean,width,index}) => {
      const breeze = still ? 0 : (Math.sin(phase * .9 - x / 65) * 5
        + Math.sin(phase * 1.65 + index * .7) * 2) * (height / 35) * (1 + energy * .7);
      const tip = x + lean + breeze;
      const lower = x + lean * .15 + breeze * .2, upper = tip - lean * .2 - breeze * .25;
      blade.setAttribute('d', `M${x-width/2} ${y}C${lower-width*.45} ${y-height*.35} ${upper-width*.2} ${y-height*.76} ${tip} ${y-height}C${upper+width*.2} ${y-height*.76} ${lower+width*.45} ${y-height*.35} ${x+width/2} ${y}Z`);
    });
  }
  function resetFace() {
    level = oldLevel = bodyLevel = mouthLevel = toneLevel = 0;
    petalInk.setAttribute('fill', '#f32b8b');
    bendStem(0, true);
    bendGrass(0, true);
    petals.setAttribute('transform', `rotate(${rotation.toFixed(2)})`);
    mouth.setAttribute('opacity', '0'); smile.setAttribute('opacity', '1');
    blush.setAttribute('opacity', '0'); halo.setAttribute('r', '40');
  }
  function finish(message = '') {
    const restoreFocus = document.activeElement === stop;
    stop.hidden = true;
    delete root.dataset.playing;
    flower.removeAttribute('aria-busy');
    status.textContent = message;
    resetFace();
    if (restoreFocus) flower.focus({preventScroll:true});
  }
  function stopSound(message = '') {
    request++;
    audio.pause();
    active = null;
    finish(message);
  }
  async function play() {
    const token = ++request;
    audio.pause(); active = null;
    resetFace();
    flower.setAttribute('aria-busy', 'true');
    root.dataset.playing = '';
    stop.hidden = false;
    status.textContent = 'Finding a sound…';
    try {
      active = nextSound(data.sounds);
      active.fps = data.fps;
      audio.src = active.src;
      // Call play before any await so the first iPhone tap retains its user gesture.
      await audio.play();
      if (token !== request) return;
      flower.removeAttribute('aria-busy');
      status.textContent = active.title;
      schedule();
    } catch (error) {
      if (token !== request) return;
      active = null;
      finish('Couldn’t play that sound. Tap to try again.');
    }
  }
  function soundFeature(name) {
    if (!active || audio.paused || audio.ended || audio.readyState < 2) return 0;
    const position = audio.currentTime * active.fps;
    const index = Math.floor(position), mix = position - index;
    const values = active[name] || [];
    const a = values[index] || 0, b = values[index + 1] || 0;
    return a + (b - a) * mix;
  }
  function colorPetals() {
    // Brightness steers the inks slowly; the rhythm moves the petals, without flashing them.
    const position = clamp(toneLevel, 0, 1) * 2;
    const index = Math.min(1, Math.floor(position)), mix = position - index;
    const amount = active && !audio.paused ? clamp(bodyLevel * 1.5, 0, 1) : 0;
    const ink = inks[index].map((channel, i) => {
      const target = channel + (inks[index + 1][i] - channel) * mix;
      return Math.round(inks[0][i] + (target - inks[0][i]) * amount);
    });
    petalInk.setAttribute('fill', `rgb(${ink.join(',')})`);
  }
  function draw(now) {
    frame = 0;
    if (!inView || document.hidden || motionPaused) { previous = 0; return; }
    if (previous && now - previous < 32) { schedule(); return; }
    const dt = previous ? Math.min((now - previous) / 1000, .08) : 1 / 30;
    previous = now; phase += dt;
    if (boundsDirty) { drawingBox = drawing.getBoundingClientRect(); boundsDirty = false; }
    const measured = soundFeature('envelope');
    level += (measured - level) * (measured > level ? .65 : .22);
    const punch = Math.max(0, level - oldLevel);
    oldLevel = level;
    bodyLevel += (level - bodyLevel) * .1;
    const articulation = soundFeature('mouth');
    mouthLevel += (articulation - mouthLevel) * (articulation > mouthLevel ? .85 : .65);
    toneLevel += (soundFeature('tone') - toneLevel) * .06;
    if (!reduced.matches) {
      // Quick petals, a slower stem: the bloom catches each attack before the body sways.
      rotation = (rotation + dt * (12 + level * 330) + punch * 72) % 360;
      petals.setAttribute('transform', `rotate(${rotation.toFixed(2)}) scale(${(1 + level * .39 + punch * .2).toFixed(3)})`);
      colorPetals();
      bendStem(bodyLevel);
      bendGrass(bodyLevel);
      halo.setAttribute('r', (40 + level * 18).toFixed(2));
      pollen.forEach(({dot,offset,radius}, index) => {
        const cycle = (phase * (.028 + index * .0011) + offset) % 1;
        const spread = 47 + (index % 3) * 13 + level * 8;
        const x = 110 + Math.sin(cycle * Math.PI * 2 + index * 2.4) * spread + Math.sin(phase * .48 + index) * 6;
        const y = 310 - cycle * 270 + Math.sin(phase * .65 + index) * 7;
        dot.setAttribute('cx', x.toFixed(2)); dot.setAttribute('cy', y.toFixed(2));
        dot.setAttribute('r', (radius * (1 + level * .25)).toFixed(2));
        dot.setAttribute('opacity', (Math.sin(cycle * Math.PI) * .85).toFixed(2));
      });
      if (pointerActive) {
        const scale = drawingBox.width / 220;
        targetX = clamp((pointerX - drawingBox.left - bloomPoint.x * scale) / 48, -4, 4);
        targetY = clamp((pointerY - drawingBox.top - bloomPoint.y * scale) / 65, -2.6, 2.6);
      }
      gazeX += (targetX - gazeX) * .23; gazeY += (targetY - gazeY) * .23;
      if (phase > blinkAt && blinkStart < 0) blinkStart = phase;
      let open = 1;
      if (blinkStart >= 0) {
        const elapsed = phase - blinkStart;
        open = Math.max(.08, Math.abs(1 - elapsed / .11));
        if (elapsed > .22) { blinkStart = -1; blinkAt = phase + 2 + Math.random() * 4; open = 1; }
      }
      eyes.forEach(eye => eye.setAttribute('transform', `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)}) scale(1 ${open.toFixed(2)})`));
    }
    const singing = mouthLevel > .32;
    smile.setAttribute('opacity', singing ? '0' : '1');
    mouth.setAttribute('opacity', singing ? '1' : '0');
    mouth.setAttribute('ry', (.7 + mouthLevel * 4.5).toFixed(2));
    mouth.setAttribute('rx', (2 + mouthLevel * 2).toFixed(2));
    blush.setAttribute('opacity', (level * .48).toFixed(2));
    if (!reduced.matches || !audio.paused) schedule();
  }
  function schedule() { if (!frame && inView && !document.hidden && !motionPaused) frame = requestAnimationFrame(draw); }
  document.addEventListener('pointermove', event => {
    if (!inView || reduced.matches || motionPaused) return;
    pointerX = event.clientX; pointerY = event.clientY; pointerActive = true;
    schedule();
  }, {passive:true});
  document.documentElement.addEventListener('pointerleave', () => { pointerActive = false; targetX = targetY = 0; });
  window.addEventListener('scroll', () => { boundsDirty = true; }, {passive:true});
  window.addEventListener('resize', () => { boundsDirty = true; }, {passive:true});
  new ResizeObserver(() => { boundsDirty = true; }).observe(drawing);
  flower.addEventListener('click', play);
  stop.addEventListener('click', () => { stopSound(''); flower.focus({preventScroll:true}); });
  motion.addEventListener('click', () => {
    motionPaused = !motionPaused;
    motion.setAttribute('aria-pressed', String(motionPaused));
    motion.textContent = motionPaused ? 'Resume motion' : 'Pause motion';
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    resetFace(); resetPollen(); eyes.forEach(eye => eye.removeAttribute('transform'));
    schedule();
  });
  audio.addEventListener('ended', () => { active = null; finish('Another sound is waiting.'); });
  audio.addEventListener('error', () => { if (active) { active = null; finish('Sound unavailable. Tap to try again.'); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopSound(); cancelAnimationFrame(frame); frame = 0; previous = 0; }
    else schedule();
  });
  reduced.addEventListener('change', () => { resetFace(); resetPollen(); eyes.forEach(eye => eye.removeAttribute('transform')); schedule(); });
  bendGrass(0, true);
  root.hidden = false;
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) schedule();
    else { cancelAnimationFrame(frame); frame = 0; previous = 0; }
  }, {threshold:0}).observe(root);
})();
