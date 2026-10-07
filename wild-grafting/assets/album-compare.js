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
  let wantedPlay = false, started = false, bufferHold = false, ignoredPauses = 0;
  let userMuted = audio.muted, userVolume = audio.volume;
  const targets = new Map();

  // One clock and two stable recordings: switching casts never replaces a source.
  function position() { return targets.get(audio) ?? audio.currentTime; }
  function ready() { return pair.every(p => p.readyState >= 2 && !p.seeking) && Math.abs(audio.currentTime - buddy.currentTime) < .12; }
  function ink() {
    pair.forEach(p => { p.muted = true; });
    if (!userMuted && wantedPlay && !bufferHold && started && ready()) (side === 'original' ? audio : buddy).muted = false;
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
    if (!wantedPlay || !started || bufferHold || audio.seeking || targets.has(audio) || buddy.readyState < 1) { ink(); return; }
    if (!buddy.seeking && Math.abs(audio.currentTime - buddy.currentTime) > .08) setPosition(buddy, audio.currentTime);
    ink();
  }
  function pause() {
    wantedPlay = false; bufferHold = false; started = false; ++ticket;
    pair.forEach(p => p.pause()); ink(); draw();
  }
  function start() {
    if (audio.ended || buddy.ended) seek(0);
    wantedPlay = true; bufferHold = false; started = false;
    const request = ++ticket;
    pair.forEach(p => { p.preload = 'auto'; p.muted = true; });
    status.textContent = 'Preparing both casts…';
    // Both play calls run in the user's gesture, including on phones.
    const attempts = pair.map(p => {
      if (targets.has(p)) setPosition(p, targets.get(p));
      return p.play();
    });
    draw();
    return Promise.all(attempts).then(() => {
      if (request !== ticket || !wantedPlay) return;
      started = true; align(); status.textContent = ''; draw();
    }).catch(error => {
      if (request !== ticket) return;
      pause();
      status.textContent = error.name === 'NotAllowedError' ? 'Tap Play to start both casts together.' : 'The paired recordings could not start. Try Play again.';
    });
  }
  function seek(time) {
    const target = Math.max(0, Number(time) || 0);
    pair.forEach(p => { p.muted = true; setPosition(p, target); });
    pair.forEach(p => {
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
    pause(); selected = index; side = albumSide; targets.clear();
    audio.preload = buddy.preload = 'none';
    audio.src = find(index, 'original').dataset.file;
    buddy.src = find(index, 'voices').dataset.file;
    publishSelection(); status.textContent = '';
    if (shouldPlay) start();
  }
  function switchCast(albumSide) {
    if (albumSide === side) return;
    side = albumSide; ink(); publishSelection();
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
    p.addEventListener('canplay', () => {
      if (wantedPlay && bufferHold && pair.every(q => q.readyState >= 3)) start(); else align();
    });
    p.addEventListener('waiting', () => {
      if (!wantedPlay || !started || pair.some(q => q.seeking) || bufferHold) return;
      bufferHold = true;
      if (!audio.paused) ++ignoredPauses;
      pair.forEach(q => q.pause()); ink();
      status.textContent = 'Buffering both casts…';
    });
    p.addEventListener('error', () => { pause(); status.textContent = 'A comparison could not load. Choose the passage again to retry.'; });
  });
  audio.addEventListener('play', () => { if (!wantedPlay) start(); draw(); });
  audio.addEventListener('pause', () => {
    if (ignoredPauses) { --ignoredPauses; return; }
    if (audio.paused && wantedPlay && !audio.ended) pause();
    draw();
  });
  audio.addEventListener('seeking', () => {
    if (buddy.readyState >= 1 && Math.abs(audio.currentTime - buddy.currentTime) > .02) setPosition(buddy, audio.currentTime);
    ink();
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
