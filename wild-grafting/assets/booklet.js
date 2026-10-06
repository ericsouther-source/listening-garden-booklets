/* An offline reading companion: HTML media plays finished files; drawings inspect score relations. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const mono = '"Courier New", Courier, monospace';
  const ink = '#201a22', paper = '#faf8f0', pink = '#df1d7c', purple = '#54218e';
  const fmt = (seconds, decimals = 0) => {
    const factor = Math.pow(10, decimals), ticks = decimals ? Math.round(Math.max(0, seconds) * factor) : Math.floor(Math.max(0, seconds));
    const minutes = Math.floor(ticks / (60 * factor));
    return minutes + ':' + ((ticks / factor) % 60).toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0');
  };
  const ns = 'http://www.w3.org/2000/svg';
  function el(tag, attributes, text) {
    const n = document.createElementNS(ns, tag);
    Object.entries(attributes || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function svgText(svg, x, y, text, size = 15, fill = ink, anchor = 'start', weight = 'normal') {
    svg.appendChild(el('text', { x, y, fill, 'font-family': mono, 'font-size': size, 'text-anchor': anchor, 'font-weight': weight }, text));
  }
  function setupAudio() {
    document.querySelectorAll('audio').forEach(audio => {
      audio.addEventListener('play', () => {
        document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
        const existing = audio.id === 'field-audio' ? $('field-audio-error') : audio.parentElement.querySelector('.wg-audio-error');
        if (existing) existing.hidden = true;
      });
      audio.addEventListener('error', () => {
        let error = audio.id === 'field-audio' ? $('field-audio-error') : audio.parentElement.querySelector('.wg-audio-error');
        if (!error) { error = document.createElement('p'); error.className = 'wg-audio-error'; error.setAttribute('role', 'status'); audio.insertAdjacentElement('afterend', error); }
        error.replaceChildren(document.createTextNode('This browser could not play the excerpt. Keep the entire booklet folder together, or '));
        const link = document.createElement('a'); link.href = audio.getAttribute('src') || audio.querySelector('source')?.getAttribute('src') || '#'; link.textContent = 'open the audio file'; error.append(link, document.createTextNode(' in your music player.')); error.hidden = false;
      });
    });
  }
  function setupField() {
    const data = window.WG_SPATIAL, canvas = $('field-canvas'), audio = $('field-audio');
    if (!canvas || !audio) return;
    if (!data || !data.frames || data.frames.length < 2) {
      const error = $('field-audio-error'); error.textContent = 'The spatial drawing data could not be opened. Keep the assets folder beside this document. The audio excerpt remains available.'; error.hidden = false; return;
    }
    const ctx = canvas.getContext('2d'), scrub = $('field-scrub'), follow = $('field-follow');
    const hiddenRoles = new Set(), labels = [], rate = data.sampleRate || 48000;
    let az = Math.PI / 4, elev = 25 * Math.PI / 180, time = 0, raf = null, cssWidth = 0, cssHeight = 0;
    let dragging = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) { follow.checked = false; $('field-follow-note').textContent = 'Reduced motion: the drawing starts still. Scrub to inspect a moment, or enable Follow playback.'; }
    reduced.addEventListener?.('change', event => { if (event.matches) { follow.checked = false; stop(); $('field-follow-note').textContent = 'Reduced motion: the drawing is held still. Scrub to inspect a moment, or enable Follow playback.'; } });
    data.roleLabels.forEach((role, i) => {
      const label = document.createElement('label'); label.className = 'wg-role'; label.style.setProperty('--role-ink', data.roleColors[i]);
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.setAttribute('aria-label', 'Show ' + role + ' in the drawing');
      input.addEventListener('change', () => { input.checked ? hiddenRoles.delete(i) : hiddenRoles.add(i); draw(); queueMiniatures(); });
      const dot = document.createElement('span'); dot.className = 'wg-role-dot'; dot.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.textContent = role; const status = document.createElement('small'); name.append(status);
      label.append(input, dot, name); $('field-roles').append(label); labels.push({ label, status });
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
      if (!cssWidth || !cssHeight) return;
      renderSphere(ctx, cssWidth, cssHeight, time);
      data.roleLabels.forEach((role, i) => {
        const active = activeAt(time, i); labels[i].label.dataset.active = String(active);
        const status = active ? 'note active' : 'rest';
        if (labels[i].status.textContent !== status) labels[i].status.textContent = status;
      });
    }
    const snapshotDetails = $('field-snapshots'), snapshotGrid = $('field-snapshot-grid'), snapshots = [];
    let miniatureFrame = null;
    if (snapshotGrid) for (let second = 0; second < 16; second++) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wg-snapshot';
      button.setAttribute('aria-label', 'Go to ' + fmt(data.origin + second) + ' in Stutter Botany');
      const mini = document.createElement('canvas'); mini.width = 180; mini.height = 180; mini.setAttribute('aria-hidden', 'true');
      const caption = document.createElement('span'); caption.textContent = fmt(data.origin + second);
      button.append(mini, caption); snapshotGrid.append(button); snapshots.push({ button, mini, second });
      button.addEventListener('click', () => { scrub.value = String(second); scrub.dispatchEvent(new Event('input', { bubbles: true })); });
    }
    function highlightSnapshot(t) {
      const chosen = Math.floor(t);
      snapshots.forEach(({button, second}) => {
        if (second === chosen) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
      });
    }
    function renderMiniatures() {
      miniatureFrame = null;
      if (!snapshotDetails?.open) return;
      snapshots.forEach(({mini, second}) => {
        const width = mini.getBoundingClientRect().width, ratio = Math.min(window.devicePixelRatio || 1, 2);
        mini.width = Math.round(width * ratio); mini.height = Math.round(width * ratio);
        const context = mini.getContext('2d'); context.setTransform(ratio, 0, 0, ratio, 0, 0);
        renderSphere(context, width, width, second, true);
      });
      highlightSnapshot(audio.currentTime);
    }
    function queueMiniatures() { if (snapshotDetails?.open && miniatureFrame === null) miniatureFrame = requestAnimationFrame(renderMiniatures); }
    snapshotDetails?.addEventListener('toggle', queueMiniatures);
    function resize() {
      const box = canvas.getBoundingClientRect(); cssWidth = box.width; cssHeight = box.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); queueMiniatures();
    }
    function updateTransport() {
      const t = clamp(Number.isFinite(audio.currentTime) ? audio.currentTime : 0, 0, data.duration);
      scrub.value = String(t); highlightSnapshot(t); $('field-time').textContent = fmt(data.origin + t); scrub.setAttribute('aria-valuetext', fmt(data.origin + t) + ' in the full track');
    }
    function stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; }
    function tick() {
      raf = null; updateTransport();
      if (follow.checked) { time = clamp(audio.currentTime, 0, data.duration); draw(); }
      if (!audio.paused && !audio.ended && follow.checked && !document.hidden) raf = requestAnimationFrame(tick);
    }
    function start() { stop(); tick(); }
    audio.addEventListener('play', start);
    audio.addEventListener('pause', () => { stop(); updateTransport(); if (follow.checked) { time = clamp(audio.currentTime, 0, data.duration); draw(); } });
    audio.addEventListener('ended', () => { stop(); updateTransport(); if (follow.checked) { time = data.duration; draw(); } });
    audio.addEventListener('timeupdate', () => { updateTransport(); if (follow.checked && (audio.paused || raf === null)) { time = clamp(audio.currentTime, 0, data.duration); draw(); } });
    audio.addEventListener('seeked', () => { updateTransport(); if (follow.checked || audio.paused) { time = clamp(audio.currentTime, 0, data.duration); draw(); } });
    scrub.addEventListener('input', () => {
      time = clamp(Number(scrub.value), 0, data.duration); highlightSnapshot(time); $('field-time').textContent = fmt(data.origin + time); scrub.setAttribute('aria-valuetext', fmt(data.origin + time) + ' in the full track');
      try { audio.currentTime = time; } catch (_) { /* The still drawing can be inspected before media metadata arrives. */ }
      draw();
    });
    follow.addEventListener('change', () => { if (follow.checked) start(); else stop(); });
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    function rotate(horizontal, vertical) { az += horizontal; elev = clamp(elev + vertical, -Math.PI * .47, Math.PI * .47); draw(); queueMiniatures(); }
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; dragging = { x: e.clientX, y: e.clientY }; canvas.classList.add('wg-dragging'); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!dragging) return; rotate((e.clientX - dragging.x) * .008, (e.clientY - dragging.y) * .008); dragging = { x: e.clientX, y: e.clientY }; });
    function release() { dragging = null; canvas.classList.remove('wg-dragging'); }
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    function reset() { az = Math.PI / 4; elev = 25 * Math.PI / 180; draw(); queueMiniatures(); }
    canvas.addEventListener('keydown', e => {
      const commands = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, .12], ArrowDown: [0, -.12] };
      if (commands[e.key]) { e.preventDefault(); rotate(...commands[e.key]); } else if (e.key === 'Home') { e.preventDefault(); reset(); }
    });
    document.querySelectorAll('[data-field-turn]').forEach(button => button.addEventListener('click', () => { const commands = { left: [-.2, 0], right: [.2, 0], up: [0, .2], down: [0, -.2] }; rotate(...commands[button.dataset.fieldTurn]); }));
    $('field-reset').addEventListener('click', reset);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize(); updateTransport();
  }
  function setupStutter() {
    const svg = $('stutter-chart'), slider = $('stutter-statement'); if (!svg || !slider) return;
    // Selected phrase shapes are display coordinates, not a playable score.
    const shapes = [[.333333,.583333,.5,.916667,.75],[.333333,.5,.416667,.833333,.666667],[.333333,.5,.25,.833333,.5],[.333333,.416667,.083333,.75,.416667],[.333333,.583333,.166667,.916667,.583333]];
    const positions = [0,.1875,.4375,.6875,.875];
    function draw() {
      const chosen = Number(slider.value), shape = shapes[chosen], width = Math.max(240, svg.parentElement.clientWidth), height = width < 500 ? 260 : 300;
      const left = 18, right = width - 18, x = p => left + p * (right - left), y = p => height - 46 - p * (height - 100);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.replaceChildren(el('title', { id: 'stutter-chart-title' }, 'Phrase ' + (chosen + 1) + ' of five'), el('desc', { id: 'stutter-chart-desc' }, 'Five connected notes rise, fall, rise and fall. Pale lines show the other phrases on the same pitch scale.'));
      svgText(svg, left, 23, 'higher', 14, purple); svgText(svg, left, height - 25, 'lower', 14, purple);
      [.25,.5,.75].forEach(level => svg.appendChild(el('line', {x1:left,x2:right,y1:y(level),y2:y(level),stroke:'#d2c7ce','stroke-width':.8,'stroke-dasharray':'2 5'})));
      shapes.forEach((points,i) => { if (i!==chosen) svg.appendChild(el('polyline', {points:points.map((v,j)=>x(positions[j])+','+y(v)).join(' '),fill:'none',stroke:'#c7bac4','stroke-width':1,'stroke-dasharray':'3 5'})); });
      svg.appendChild(el('polyline', {points:shape.map((v,j)=>x(positions[j])+','+y(v)).join(' '),fill:'none',stroke:pink,'stroke-width':3}));
      shape.forEach((v,j)=>svg.appendChild(el('circle',{cx:x(positions[j]),cy:y(v),r:5.5,fill:pink,stroke:paper,'stroke-width':1.5})));
      svgText(svg,right,height-25,'phrase →',14,purple,'end');
      $('stutter-number').textContent=(chosen+1)+' of 5'; slider.setAttribute('aria-valuetext','Phrase '+(chosen+1)+' of five');
      $('stutter-observation').textContent = chosen===4 ? 'The same turns, in half the time.' : ['The first shape takes root.','The leaps draw closer together.','One dip reaches below the first note.','The dip reaches deeper.'][chosen];
      $('stutter-previous').disabled=chosen===0; $('stutter-next').disabled=chosen===4;
    }
    slider.addEventListener('input',draw);
    $('stutter-previous').addEventListener('click',()=>{slider.value=String(Math.max(0,Number(slider.value)-1));draw();});
    $('stutter-next').addEventListener('click',()=>{slider.value=String(Math.min(4,Number(slider.value)+1));draw();});
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(svg.parentElement); else window.addEventListener('resize',draw); draw();
  }
  function setupGutter() {
    const svg=$('gutter-chart'), slider=$('gutter-scale'); if (!svg||!slider) return;
    const pattern=[0,.375,.5,.8125,1];
    function draw() {
      const scale=Number(slider.value), width=Math.max(240,svg.parentElement.clientWidth), height=270, left=18, right=width-18, span=right-left;
      const opening=p=>left+p*span/5.25, expanded=p=>left+p*span*scale/5.25;
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg.replaceChildren(el('title',{id:'gutter-chart-title'},'One rhythm, opened out'),el('desc',{id:'gutter-chart-desc'},'The upper five dots hold the opening rhythm. The lower five dots open its spacing out, keeping the pattern of gaps.'));
      svgText(svg,left,28,'Opening',16,purple);svgText(svg,left,147,'Opened out',16,purple);
      [65,183].forEach(y=>svg.appendChild(el('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#b6a7b3','stroke-width':1})));
      pattern.forEach(p=>{
        svg.appendChild(el('line',{x1:opening(p),x2:expanded(p),y1:70,y2:177,stroke:'#c7b7c4','stroke-width':.8,'stroke-dasharray':'2 5'}));
        svg.appendChild(el('circle',{cx:opening(p),cy:65,r:width<400?2.6:4,fill:purple}));
        svg.appendChild(el('circle',{cx:expanded(p),cy:183,r:scale<2&&width<400?2.6:5,fill:pink}));
      });
      svgText(svg,left,233,'begin',14,purple);svgText(svg,right,233,'time →',14,purple,'end');
      const label=scale>=5.24?'ending':scale<=1.01?'opening':'in between';
      $('gutter-scale-value').textContent=label; slider.setAttribute('aria-valuetext',label==='ending'?'The spacing in the ending':label==='opening'?'The compact opening spacing':'Spacing between opening and ending');
      $('gutter-observation').textContent=scale>=5.24?'The ending gives this pattern room to breathe.':scale<=1.01?'Back at the opening’s compact spacing.':'The gaps open together; their uneven pattern stays.';
    }
    slider.addEventListener('input',draw);$('gutter-recorded').addEventListener('click',()=>{slider.value='5.25';draw();});
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(svg.parentElement); else window.addEventListener('resize',draw); draw();
  }
  function init() { setupAudio(); setupField(); setupStutter(); setupGutter(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
}());
