(() => {
  'use strict';
  const root = document.getElementById('garden-voices');
  const audio = document.getElementById('comparison-player');
  if (!root || !audio) return;
  const tracks = [...root.querySelectorAll('button[data-track-index][data-album-side]')];
  const switches = [...root.querySelectorAll('[data-select-album]')];
  const panels = [...root.querySelectorAll('[data-album-panel]')];
  const title = document.getElementById('comparison-track-title');
  const origin = document.getElementById('comparison-track-origin');
  const status = document.getElementById('comparison-status');
  const previous = document.getElementById('comparison-previous');
  const next = document.getElementById('comparison-next');
  const play = document.getElementById('comparison-play');
  const buddy = document.createElement('audio');
  buddy.id = 'comparison-partner';
  buddy.dataset.comparisonBuddy = 'true';
  buddy.preload = 'none';
  buddy.hidden = true;
  buddy.muted = true;
  buddy.setAttribute('aria-hidden', 'true');
  root.append(buddy);
  const pair = [audio, buddy];
  const find = (index, albumSide) => tracks.find(button => Number(button.dataset.trackIndex) === index && button.dataset.albumSide === albumSide);
  const label = albumSide => albumSide === 'original' ? 'Wild Grafting' : 'Garden Voices';
  let selected = 0, side = 'original', ticket = 0;
  let wantedPlay = false, started = false, preparing = false, releasing = false, heldPosition = 0;
  let preparation = null, pendingStart = null;
  const internalPauses = new Map();
  let userMuted = audio.muted, userVolume = audio.volume;
  const targets = new Map();

  // Keep the listener's clock still while either recording loads or seeks.
  // Both sources stay attached, so switching casts only changes which is audible.
  function position() { return started && !preparing ? audio.currentTime : heldPosition; }
  function ink() {
    const audible = !userMuted && wantedPlay && (started || releasing) ? (side === 'original' ? audio : buddy) : null;
    pair.forEach(p => { const muted = p !== audible; if (p.muted !== muted) p.muted = muted; });
  }
  function pauseMedia(p) {
    if (!p.paused) { internalPauses.set(p, (internalPauses.get(p) || 0) + 1); p.pause(); }
  }
  function cancelPreparation() {
    ++ticket;
    preparation?.abort(); preparation = null; pendingStart = null;
  }
  function waitUntil(predicate, signal) {
    return new Promise((resolve, reject) => {
      const finish = error => { clearInterval(timer); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
      const abort = () => finish(new DOMException('Playback request replaced.', 'AbortError'));
      const check = () => { if (signal.aborted) abort(); else if (predicate()) finish(); };
      const timer = setInterval(check, 40);
      signal.addEventListener('abort', abort, { once: true }); check();
    });
  }
  function draw() {
    switches.forEach(button => {
      const active = button.dataset.selectAlbum === side;
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('.comparison-selection').textContent = active ? 'Selected' : 'Switch to this cast';
    });
    panels.forEach(panel => {
      const active = panel.dataset.albumPanel === side;
      panel.dataset.selected = String(active);
      panel.querySelector('.comparison-panel-state').textContent = active ? 'Selected cast' : 'Other cast';
    });
    tracks.forEach(button => {
      const sameTrack = Number(button.dataset.trackIndex) === selected;
      const active = sameTrack && button.dataset.albumSide === side;
      button.dataset.paired = String(sameTrack);
      if (active) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
      button.querySelector('.comparison-track-action').textContent = active && wantedPlay ? 'Playing' : active ? 'Selected' : 'Play';
    });
    previous.disabled = selected === 0;
    next.disabled = selected === 5;
    play.textContent = wantedPlay ? 'Pause' : 'Play';
    audio.dispatchEvent(new Event('gardenstatechange'));
  }
  function publishSelection() {
    const track = find(selected, side);
    audio.dataset.trackIndex = String(selected);
    audio.dataset.albumSide = side;
    audio.dataset.fieldFile = track.dataset.file;
    audio.dataset.title = label(side) + ' · ' + track.dataset.title;
    audio.setAttribute('aria-label', audio.dataset.title);
    title.textContent = String(selected + 1).padStart(2, '0') + ' / ' + track.dataset.title;
    origin.textContent = track.dataset.window || (side === 'voices' ? 'from ' + track.dataset.original : 'Wild Grafting · released album');
    draw();
    audio.dispatchEvent(new CustomEvent('albumtrackchange', { bubbles: true, detail: { trackIndex: selected, albumSide: side, title: track.dataset.title, source: track.dataset.file } }));
  }
  function setPosition(p, time) {
    targets.set(p, time);
    if (p.readyState < 1) return;
    const end = Number.isFinite(p.duration) ? p.duration : time;
    try { p.currentTime = Math.min(time, end); targets.delete(p); } catch (_) { /* Apply after metadata. */ }
  }
  function align() {
    if (!wantedPlay || !started || preparing || pair.some(p => p.seeking || p.readyState < 2)) return;
    const drift = audio.currentTime - buddy.currentTime;
    if (Math.abs(drift) > .12) {
      // Stop both clocks before a substantial correction. Never chase a moving
      // clock with repeated seeks: slower decoders can otherwise stay silent.
      prepare(position(), false, 'Aligning both casts…');
      return;
    }
    const rate = audio.playbackRate * (Math.abs(drift) > .06 ? (drift > 0 ? 1.03 : .97) : 1);
    if (Math.abs(buddy.playbackRate - rate) > .001) buddy.playbackRate = rate;
  }
  function pause() {
    heldPosition = position(); wantedPlay = false; started = false; preparing = false; releasing = false;
    cancelPreparation(); pair.forEach(pauseMedia); buddy.playbackRate = audio.playbackRate; status.textContent = ''; ink(); draw();
  }
  function prepare(time, prime, message) {
    cancelPreparation(); const request = ticket;
    preparation = new AbortController(); const signal = preparation.signal;
    heldPosition = Math.max(0, Number(time) || 0); preparing = true; started = false; releasing = false;
    pair.forEach(pauseMedia); buddy.playbackRate = audio.playbackRate; ink();
    pair.forEach(p => { p.preload = 'auto'; });
    status.textContent = message; draw();
    const current = () => request === ticket && wantedPlay && !signal.aborted;
    // Prime both elements directly in the tap. Pause each as soon as its play
    // promise resolves, so the quicker download cannot consume the passage.
    let authorization;
    try {
      authorization = prime ? Promise.all(pair.map(p => {
        if (targets.has(p)) setPosition(p, targets.get(p));
        return p.play().then(() => { if (current()) pauseMedia(p); });
      })) : Promise.resolve();
    } catch (error) { authorization = Promise.reject(error); }
    pendingStart = authorization.then(async () => {
      if (!current()) return;
      await waitUntil(() => pair.every(p => p.readyState >= 1), signal);
      if (!current()) return;
      pair.forEach(p => setPosition(p, heldPosition));
      await waitUntil(() => pair.every(p => p.readyState >= 3 && !p.seeking && !targets.has(p)), signal);
      if (!current()) return;
      // Configure the audible sink while paused, before restarting the clocks.
      // Unmuting only after play can otherwise add a large device startup delay.
      releasing = true; ink();
      await Promise.all(pair.map(p => p.play()));
      if (!current()) return;
      preparing = false; releasing = false; started = true; preparation = null; pendingStart = null;
      status.textContent = ''; ink(); draw(); align();
    }).catch(error => {
      if (!current()) return;
      pause();
      status.textContent = error.name === 'NotAllowedError' ? 'Tap Play to start both casts together.' : 'The paired recordings could not start. Try Play again.';
    });
    return pendingStart;
  }
  function start() {
    if (wantedPlay && preparing) return pendingStart || Promise.resolve();
    if (wantedPlay && started) return Promise.resolve();
    const time = audio.ended || buddy.ended ? 0 : position();
    pair.forEach(p => { if (p.error) p.load(); });
    wantedPlay = true;
    return prepare(time, true, 'Preparing both casts…');
  }
  function seek(time) {
    const target = Math.max(0, Number(time) || 0);
    if (wantedPlay) { prepare(target, false, 'Finding the same moment in both casts…'); return; }
    heldPosition = target;
    pair.forEach(p => {
      setPosition(p, target);
      if (p.readyState < 1) { p.preload = 'metadata'; if (p.networkState === 0 || p.networkState === 1) p.load(); }
    });
    draw();
  }
  // The themed player and floating transport share these controls, while the
  // public audio element remains the single playback/field event source.
  audio.gardenTransport = {
    play: start, pause, seek,
    get paused() { return !wantedPlay; },
    get ended() { return audio.ended; },
    get currentTime() { return position(); },
    get muted() { return userMuted; },
    set muted(value) { userMuted = Boolean(value); ink(); audio.dispatchEvent(new Event('gardenvolumechange')); },
    get volume() { return userVolume; },
    set volume(value) { userVolume = Math.max(0, Math.min(1, Number(value))); pair.forEach(p => { p.volume = userVolume; }); ink(); audio.dispatchEvent(new Event('gardenvolumechange')); }
  };
  function select(index, albumSide, shouldPlay = true) {
    if (!find(index, albumSide)) return;
    pause(); selected = index; side = albumSide; targets.clear(); heldPosition = 0;
    audio.preload = buddy.preload = 'none';
    audio.src = find(index, 'original').dataset.file;
    buddy.src = find(index, 'voices').dataset.file;
    publishSelection(); status.textContent = '';
    if (shouldPlay) start();
  }
  function switchCast(albumSide) {
    if (albumSide === side) return;
    side = albumSide;
    if (wantedPlay && started && Math.abs(audio.currentTime - buddy.currentTime) > .10) prepare(position(), false, 'Aligning both casts…');
    else ink();
    publishSelection();
    if (started) status.textContent = 'Same passage, same position. ' + label(side) + ' selected.';
  }
  switches.forEach(button => button.addEventListener('click', () => switchCast(button.dataset.selectAlbum)));
  tracks.forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.trackIndex), albumSide = button.dataset.albumSide;
    if (index !== selected) select(index, albumSide);
    else if (albumSide !== side) { switchCast(albumSide); if (!wantedPlay) start(); }
    else if (wantedPlay) pause(); else start();
  }));
  play.addEventListener('click', () => wantedPlay ? pause() : start());
  previous.addEventListener('click', () => select(selected - 1, side));
  next.addEventListener('click', () => select(selected + 1, side));
  pair.forEach(p => {
    p.addEventListener('loadedmetadata', () => { if (targets.has(p)) setPosition(p, targets.get(p)); });
    p.addEventListener('seeked', align);
    p.addEventListener('canplay', align);
    p.addEventListener('waiting', () => {
      if (wantedPlay && started && !preparing) prepare(position(), false, 'Buffering both casts…');
    });
    p.addEventListener('pause', () => {
      const ignored = internalPauses.get(p) || 0;
      if (ignored) { internalPauses.set(p, ignored - 1); return; }
      if (p.paused && wantedPlay && !p.ended) {
        pause(); status.textContent = '';
      }
      draw();
    });
    p.addEventListener('error', () => { pause(); status.textContent = 'A comparison could not load. Choose the passage again to retry.'; });
  });
  audio.addEventListener('play', () => { if (!wantedPlay) start(); draw(); });
  audio.addEventListener('seeking', () => {
    if (preparing) return;
    if (wantedPlay && started) prepare(audio.currentTime, false, 'Finding the same moment in both casts…');
    else { heldPosition = audio.currentTime; if (buddy.readyState >= 1 && Math.abs(audio.currentTime - buddy.currentTime) > .02) setPosition(buddy, audio.currentTime); }
  });
  audio.addEventListener('timeupdate', align);
  buddy.addEventListener('timeupdate', align);
  audio.addEventListener('ratechange', () => { buddy.playbackRate = audio.playbackRate; });
  audio.addEventListener('ended', () => {
    if (selected < 5) select(selected + 1, side);
    else { pause(); status.textContent = 'The garden has come full circle.'; }
  });
  window.addEventListener('pagehide', pause);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) align(); });
  select(0, 'original', false);
})();
