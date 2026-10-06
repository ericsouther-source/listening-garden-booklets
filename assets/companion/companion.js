(() => {
  'use strict';
  const root = document.getElementById('garden-companion');
  if (!root) return;
  const flower = root.querySelector('.companion-flower');
  const stop = root.querySelector('.companion-stop');
  const motion = root.querySelector('.companion-motion');
  const status = root.querySelector('.companion-status');
  const audio = root.querySelector('audio');
  const head = root.querySelector('.companion-head');
  const shoot = root.querySelector('.companion-shoot');
  const petals = root.querySelector('.companion-petals');
  const eyes = [...root.querySelectorAll('.companion-eye')];
  const smile = root.querySelector('.companion-smile');
  const mouth = root.querySelector('.companion-mouth');
  const blush = root.querySelector('.companion-blush');
  const halo = root.querySelector('.companion-halo');
  const seeds = root.querySelector('.companion-seeds');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const data = window.gardenCompanionSounds;
  delete window.gardenCompanionSounds;
  if (!data || !data.sounds.length) return;
  let active, bag = [], last = -1, request = 0, inView = false;
  let frame = 0, previous = 0, phase = 0, rotation = 0, level = 0, oldLevel = 0;
  let gazeX = 0, gazeY = 0, targetX = 0, targetY = 0;
  let blinkAt = 3, blinkStart = -1;
  let motionPaused = false;
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
  function resetFace() {
    level = oldLevel = 0;
    shoot.removeAttribute('transform');
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
  function envelope() {
    if (!active || audio.paused || audio.ended || audio.readyState < 2) return 0;
    const position = audio.currentTime * active.fps;
    const index = Math.floor(position), mix = position - index;
    const a = active.envelope[index] || 0, b = active.envelope[index + 1] || 0;
    return a + (b - a) * mix;
  }
  function draw(now) {
    frame = 0;
    if (!inView || document.hidden || motionPaused) { previous = 0; return; }
    if (previous && now - previous < 32) { schedule(); return; }
    const dt = previous ? Math.min((now - previous) / 1000, .08) : 1 / 30;
    previous = now; phase += dt;
    const measured = envelope();
    level += (measured - level) * (measured > level ? .65 : .22);
    const punch = Math.max(0, level - oldLevel);
    oldLevel = level;
    if (!reduced.matches) {
      // Quick petals, a slower stem: the bloom catches each attack before the body sways.
      rotation = (rotation + dt * (2.5 + level * 105) + punch * 38) % 360;
      petals.setAttribute('transform', `rotate(${rotation.toFixed(2)}) scale(${(1 + level * .36 + punch * .18).toFixed(3)})`);
      const lean = Math.sin(phase * (.8 + level * .7)) * (1.2 + level * 2.7);
      shoot.setAttribute('transform', `rotate(${lean.toFixed(2)} 110 315)`);
      halo.setAttribute('r', (40 + level * 18).toFixed(2));
      seeds.setAttribute('transform', `translate(${(Math.sin(phase * .65) * 2).toFixed(2)} ${(Math.sin(phase * .9) * 3).toFixed(2)})`);
      gazeX += (targetX - gazeX) * .16; gazeY += (targetY - gazeY) * .16;
      if (phase > blinkAt && blinkStart < 0) blinkStart = phase;
      let open = 1;
      if (blinkStart >= 0) {
        const elapsed = phase - blinkStart;
        open = Math.max(.08, Math.abs(1 - elapsed / .11));
        if (elapsed > .22) { blinkStart = -1; blinkAt = phase + 2 + Math.random() * 4; open = 1; }
      }
      eyes.forEach(eye => eye.setAttribute('transform', `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)}) scale(1 ${open.toFixed(2)})`));
    }
    const singing = level > .06;
    smile.setAttribute('opacity', singing ? '0' : '1');
    mouth.setAttribute('opacity', singing ? '1' : '0');
    mouth.setAttribute('ry', (1 + level * 4).toFixed(2));
    mouth.setAttribute('rx', (2.3 + level * 1.8).toFixed(2));
    blush.setAttribute('opacity', (level * .48).toFixed(2));
    if (!reduced.matches || !audio.paused) schedule();
  }
  function schedule() { if (!frame && inView && !document.hidden && !motionPaused) frame = requestAnimationFrame(draw); }
  document.addEventListener('pointermove', event => {
    if (!inView || reduced.matches || motionPaused) return;
    const box = head.getBoundingClientRect();
    targetX = clamp((event.clientX - box.x - box.width / 2) / 120, -1.6, 1.6);
    targetY = clamp((event.clientY - box.y - box.height / 2) / 140, -1.4, 1.4);
    schedule();
  }, {passive:true});
  document.documentElement.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  flower.addEventListener('click', play);
  stop.addEventListener('click', () => { stopSound(''); flower.focus({preventScroll:true}); });
  motion.addEventListener('click', () => {
    motionPaused = !motionPaused;
    motion.setAttribute('aria-pressed', String(motionPaused));
    motion.textContent = motionPaused ? 'Resume motion' : 'Pause motion';
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    resetFace(); seeds.removeAttribute('transform'); eyes.forEach(eye => eye.removeAttribute('transform'));
    schedule();
  });
  audio.addEventListener('ended', () => { active = null; finish('Another sound is waiting.'); });
  audio.addEventListener('error', () => { if (active) { active = null; finish('Sound unavailable. Tap to try again.'); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopSound(); cancelAnimationFrame(frame); frame = 0; previous = 0; }
    else schedule();
  });
  reduced.addEventListener('change', () => { resetFace(); seeds.removeAttribute('transform'); eyes.forEach(eye => eye.removeAttribute('transform')); schedule(); });
  root.hidden = false;
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) schedule();
    else { cancelAnimationFrame(frame); frame = 0; previous = 0; }
  }, {threshold:0}).observe(root);
})();
