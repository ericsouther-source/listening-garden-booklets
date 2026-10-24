/* Wild Grafting's five-voice renderer, reused from booklet.js.
   Geometry and sample-based note activity retain the companion's data contract. */
(() => {
  'use strict';
  const root = document.querySelector('[data-stutter-field]');
  if (!root) return;
  const $ = id => root.querySelector('#' + id);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const mono = '"Courier New", Courier, monospace';
  const ink = '#201a22', paper = '#faf8f0', purple = '#54218e';
  const fmt = seconds => {
    const ticks = Math.floor(Math.max(0, seconds));
    return Math.floor(ticks / 60) + ':' + (ticks % 60).toString().padStart(2, '0');
  };
  let visible = false, loading = false, wake = () => {};
  const audio = $('ag-field-audio');
  document.addEventListener('play', event => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    if (event.target === audio) document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
    else audio.pause();
  }, true);
  audio.addEventListener('error', () => {
    $('ag-field-audio-error').textContent = 'The recording could not load. Try the direct excerpt link.';
    $('ag-field-audio-error').hidden = false;
  });
  function setupField() {
    const data = window.WG_SPATIAL, canvas = $('ag-field-canvas'), audio = $('ag-field-audio');
    if (!canvas || !audio) return;
    if (!data || !data.frames || data.frames.length < 2) {
      const error = $('ag-field-audio-error'); error.textContent = 'The drawing could not load. The recording remains available above.'; error.hidden = false; return;
    }
    const ctx = canvas.getContext('2d'), scrub = $('ag-field-scrub'), follow = $('ag-field-follow');
    const hiddenRoles = new Set(), labels = [], rate = data.sampleRate || 48000;
    let az = Math.PI / 4, elev = 25 * Math.PI / 180, time = 0, raf = null, cssWidth = 0, cssHeight = 0;
    let dragging = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) { follow.checked = false; $('ag-field-follow-note').textContent = 'Reduced motion: the drawing starts still. Scrub to inspect a moment, or enable Follow playback.'; }
    reduced.addEventListener?.('change', event => { if (event.matches) { follow.checked = false; stop(); $('ag-field-follow-note').textContent = 'Reduced motion: the drawing is held still. Scrub to inspect a moment, or enable Follow playback.'; } });
    data.roleLabels.forEach((role, i) => {
      const label = document.createElement('label'); label.className = 'wg-role'; label.style.setProperty('--role-ink', data.roleColors[i]);
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.setAttribute('aria-label', 'Show ' + role + ' in the drawing');
      input.addEventListener('change', () => { input.checked ? hiddenRoles.delete(i) : hiddenRoles.add(i); draw(); });
      const dot = document.createElement('span'); dot.className = 'wg-role-dot'; dot.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.textContent = role; const status = document.createElement('small'); name.append(status);
      label.append(input, dot, name); $('ag-field-roles').append(label); labels.push({ label, status });
    });
    function normal(v) { const n = Math.hypot(...v); return n > 0 ? v.map(x => x / n) : [1, 0, 0]; }
    function vectorAt(t, role, offset = 0) {
      const f = clamp(t * data.fps, 0, data.frames.length - 1), lower = Math.floor(f), upper = Math.min(lower + 1, data.frames.length - 1), q = f - lower;
      const a = data.frames[lower][role + 1], b = data.frames[upper][role + 1];
      return normal([0, 1, 2].map(j => a[offset + j] + q * (b[offset + j] - a[offset + j])));
    }
    function activeAt(t, role) {
      const sample = Math.floor(clamp(t, 0, data.duration) * rate);
      return data.activity[role].some(interval => interval[0] <= sample && sample < interval[1]);
    }
    function basis() {
      const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(elev), se = Math.sin(elev);
      return { right: [sa, -ca, 0], up: [-se * ca, -se * sa, ce], eye: [ce * ca, ce * sa, se] };
    }
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    function spherePath(ctx, points, project, color, width, dashed = false) {
      if (!points.length) return;
      ctx.beginPath(); points.forEach((p, i) => { const q = project(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dashed ? [1.5, 4] : []); ctx.stroke(); ctx.setLineDash([]);
    }
    const grid = [];
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const e = latitude * Math.PI / 180, line = [];
      for (let i = 0; i <= 120; i++) { const a = i * Math.PI / 60; line.push([Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)]); } grid.push(line);
    }
    for (let longitude = 0; longitude < 180; longitude += 30) {
      const a = longitude * Math.PI / 180, line = [];
      for (let i = 0; i <= 120; i++) { const e = i * Math.PI / 60; line.push([Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)]); } grid.push(line);
    }
    function renderSphere(ctx, width, height, moment, small = false) {
      const centerX = width / 2, centerY = height * (small ? .5 : .53), radius = Math.min(width * (small ? .43 : .37), height * (small ? .43 : .365)), base = basis();
      const project = p => ({ x: centerX + radius * dot(p, base.right), y: centerY - radius * dot(p, base.up), depth: dot(p, base.eye) });
      ctx.clearRect(0, 0, width, height); ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height);
      if (!small) { ctx.font = `14px ${mono}`; ctx.fillStyle = purple; ctx.textAlign = 'left'; ctx.fillText('STUTTER BOTANY', 6, 22); ctx.textAlign = 'right'; ctx.fillStyle = ink; ctx.fillText(fmt(data.origin + moment), width - 6, 22); }
      // Construction marks stay registered to a single unit sphere.
      ctx.lineWidth = .6; ctx.strokeStyle = '#bdb6b7'; ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(centerX - radius * 1.12, centerY); ctx.lineTo(centerX + radius * 1.12, centerY); ctx.moveTo(centerX, centerY - radius * 1.12); ctx.lineTo(centerX, centerY + radius * 1.12); ctx.stroke(); ctx.setLineDash([]);
      grid.forEach((line, gridIndex) => {
        if (small && gridIndex % 2) return;
        for (let i = 1; i < line.length; i++) {
          const a = project(line[i - 1]), b = project(line[i]), back = (a.depth + b.depth) < 0;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = back ? .45 : .65; ctx.strokeStyle = back ? '#c9c1c3' : '#aaa0a5'; ctx.setLineDash(back ? [1.4, 2.8] : []); ctx.stroke();
        }
      }); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = ink; ctx.stroke();
      if (!small) [[1, 0, 0, 'front'], [0, 1, 0, 'left'], [0, 0, 1, 'up']].forEach(axis => {
        const p = project(axis.slice(0, 3).map(v => v * 1.12)); ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#564a54'; ctx.lineWidth = .8; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); ctx.font = `14px ${mono}`; ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.fillText(axis[3], p.x + 6 * Math.sign(p.x - centerX), p.y + (p.y < centerY ? -9 : 16));
      });
      const endpoints = [];
      data.roleLabels.forEach((role, i) => {
        const active = activeAt(moment, i);
        if (hiddenRoles.has(i)) return;
        const color = data.roleColors[i], trail = [];
        for (let t = Math.max(0, moment - 2); t < moment; t += 1 / 30) trail.push(vectorAt(t, i)); trail.push(vectorAt(moment, i));
        spherePath(ctx, trail, project, color, small ? 1 : 1.6, true);
        const left = vectorAt(moment, i, 3), right = vectorAt(moment, i, 6), angle = Math.acos(clamp(dot(left, right), -1, 1));
        const pair = [];
        const isStringPair = role === 'Violin II';
        const centerVector = vectorAt(moment, i), pairElevation = Math.asin(clamp(centerVector[2], -1, 1));
        const leftAzimuth = Math.atan2(left[1], left[0]), rightAzimuth = Math.atan2(right[1], right[0]);
        const azimuthSpan = Math.atan2(Math.sin(rightAzimuth - leftAzimuth), Math.cos(rightAzimuth - leftAzimuth));
        for (let n = 0; n <= 32; n++) {
          const q = n / 32;
          if (isStringPair) {
            // The string lane's native spread is an azimuth arc at fixed elevation.
            const a = leftAzimuth + q * azimuthSpan, ce = Math.cos(pairElevation);
            pair.push([ce * Math.cos(a), ce * Math.sin(a), Math.sin(pairElevation)]);
          } else {
            // Percussion uses a great-circle pair around its direction and roll.
            pair.push(angle < .000001 ? left : normal(left.map((v, j) => (Math.sin((1 - q) * angle) * v + Math.sin(q * angle) * right[j]) / Math.sin(angle))));
          }
        }
        spherePath(ctx, pair, project, color, small ? 1 : (active ? 2.15 : 1.4));
        const center = project(vectorAt(moment, i)); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(center.x - 3.5, center.y); ctx.lineTo(center.x + 3.5, center.y); ctx.moveTo(center.x, center.y - 3.5); ctx.lineTo(center.x, center.y + 3.5); ctx.stroke();
        [left, right].forEach(v => endpoints.push({ ...project(v), color, active }));
      });
      endpoints.sort((a, b) => a.depth - b.depth).forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, small ? 2.5 : (width < 420 ? 4 : 5), 0, Math.PI * 2); ctx.fillStyle = p.active ? p.color : paper; ctx.strokeStyle = p.color; ctx.lineWidth = 1.6; ctx.fill(); ctx.stroke(); });
    }
    function draw() {
      if (!visible || document.hidden || !cssWidth || !cssHeight) return;
      renderSphere(ctx, cssWidth, cssHeight, time);
      data.roleLabels.forEach((role, i) => {
        const active = activeAt(time, i); labels[i].label.dataset.active = String(active);
        const status = active ? 'note active' : 'rest';
        if (labels[i].status.textContent !== status) labels[i].status.textContent = status;
      });
    }
    function resize() {
      const box = canvas.getBoundingClientRect(); cssWidth = box.width; cssHeight = box.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
    }
    function updateTransport() {
      const t = clamp(Number.isFinite(audio.currentTime) ? audio.currentTime : 0, 0, data.duration);
      scrub.value = String(t); $('ag-field-time').textContent = fmt(data.origin + t); scrub.setAttribute('aria-valuetext', fmt(data.origin + t) + ' in the full track');
    }
    function stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; }
    function tick() {
      raf = null;
      if (!visible || document.hidden) return;
      updateTransport();
      if (follow.checked) { time = clamp(audio.currentTime, 0, data.duration); draw(); }
      if (visible && !audio.paused && !audio.ended && follow.checked && !document.hidden) raf = requestAnimationFrame(tick);
    }
    function start() { stop(); if (visible && !document.hidden) tick(); }
    wake = () => {
      if (!visible) { stop(); return; }
      if (follow.checked) time = clamp(audio.currentTime, 0, data.duration);
      draw(); start();
    };
    audio.addEventListener('play', start);
    audio.addEventListener('pause', () => { stop(); updateTransport(); if (follow.checked) { time = clamp(audio.currentTime, 0, data.duration); draw(); } });
    audio.addEventListener('ended', () => { stop(); updateTransport(); if (follow.checked) { time = data.duration; draw(); } });
    audio.addEventListener('timeupdate', () => { updateTransport(); if (follow.checked && (audio.paused || raf === null)) { time = clamp(audio.currentTime, 0, data.duration); draw(); } });
    audio.addEventListener('seeked', () => { updateTransport(); if (follow.checked || audio.paused) { time = clamp(audio.currentTime, 0, data.duration); draw(); } });
    scrub.addEventListener('input', () => {
      time = clamp(Number(scrub.value), 0, data.duration); $('ag-field-time').textContent = fmt(data.origin + time); scrub.setAttribute('aria-valuetext', fmt(data.origin + time) + ' in the full track');
      try { audio.currentTime = time; } catch (_) { /* The still drawing can be inspected before media metadata arrives. */ }
      draw();
    });
    follow.addEventListener('change', () => { if (follow.checked) start(); else stop(); });
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    function rotate(horizontal, vertical) { az += horizontal; elev = clamp(elev + vertical, -Math.PI * .47, Math.PI * .47); draw(); }
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; dragging = { x: e.clientX, y: e.clientY }; canvas.classList.add('wg-dragging'); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!dragging) return; rotate((e.clientX - dragging.x) * .008, (e.clientY - dragging.y) * .008); dragging = { x: e.clientX, y: e.clientY }; });
    function release() { dragging = null; canvas.classList.remove('wg-dragging'); }
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    function reset() { az = Math.PI / 4; elev = 25 * Math.PI / 180; draw(); }
    canvas.addEventListener('keydown', e => {
      const commands = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, .12], ArrowDown: [0, -.12] };
      if (commands[e.key]) { e.preventDefault(); rotate(...commands[e.key]); } else if (e.key === 'Home') { e.preventDefault(); reset(); }
    });
    root.querySelectorAll('[data-field-turn]').forEach(button => button.addEventListener('click', () => { const commands = { left: [-.2, 0], right: [.2, 0], up: [0, .2], down: [0, -.2] }; rotate(...commands[button.dataset.fieldTurn]); }));
    $('ag-field-reset').addEventListener('click', reset);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    root.querySelector('.sf-interactive').hidden = false;
    root.dataset.ready = 'true';
    resize(); updateTransport();
    time = clamp(audio.currentTime, 0, data.duration); draw();
    if (!audio.paused) start();
  }

  function load() {
    if (loading) return;
    loading = true;
    if (window.WG_SPATIAL) { setupField(); return; }
    const script = document.createElement('script');
    script.src = root.dataset.spatialSrc;
    script.onload = setupField;
    script.onerror = () => {
      $('ag-field-audio-error').textContent = 'The drawing could not load. The recording remains available above.';
      $('ag-field-audio-error').hidden = false;
    };
    document.head.append(script);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) load();
    }, { rootMargin: '300px' }).observe(root);
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) load();
      wake();
    }).observe(root);
  } else { visible = true; load(); }
})();
