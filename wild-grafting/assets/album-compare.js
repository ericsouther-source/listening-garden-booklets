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
  buddy.setAttribute('aria-hidden', 'true');
  root.append(buddy);
  const pair = [audio, buddy];
  const find = (index, albumSide) => tracks.find(button => Number(button.dataset.trackIndex) === index && button.dataset.albumSide === albumSide);
  const label = albumSide => albumSide === 'original' ? 'Wild Grafting' : 'Garden Voices';
  let selected = 0, side = 'original', ticket = 0;
  let wantedPlay = false, heldPosition = 0, pendingTarget = null, pendingStart = null;
  let userMuted = audio.muted, userVolume = audio.volume;
  const active = () => side === 'original' ? audio : buddy;
  const emit = name => audio.dispatchEvent(new Event(name));

  // A phone plays one cast at a time. The other may preload, but its clock stays
  // paused. Only a listener's switch or seek changes position; ordinary playback
  // never chases another decoder, changes its rate, or stops to realign.
  function duration() {
    const p = active();
    if (p.readyState >= 1 && Number.isFinite(p.duration)) return p.duration;
    const file = find(selected, side).dataset.file.split('/').pop();
    return window.WG_FIELD_CATALOG?.audio?.[file]?.duration || 0;
  }
  function position() { return pendingTarget === null ? (active().currentTime || heldPosition) : heldPosition; }
  function ink() { pair.forEach(p => { p.muted = userMuted; p.volume = userVolume; }); }
  function draw() {
    switches.forEach(button => {
      const selectedCast = button.dataset.selectAlbum === side;
      button.setAttribute('aria-pressed', String(selectedCast));
      button.querySelector('.comparison-selection').textContent = selectedCast ? 'Selected' : 'Switch to this cast';
    });
    panels.forEach(panel => {
      const selectedCast = panel.dataset.albumPanel === side;
      panel.dataset.selected = String(selectedCast);
      panel.querySelector('.comparison-panel-state').textContent = selectedCast ? 'Selected cast' : 'Other cast';
    });
    tracks.forEach(button => {
      const sameTrack = Number(button.dataset.trackIndex) === selected;
      const selectedTrack = sameTrack && button.dataset.albumSide === side;
      button.dataset.paired = String(sameTrack);
      if (selectedTrack) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
      button.querySelector('.comparison-track-action').textContent = selectedTrack && wantedPlay ? 'Playing' : selectedTrack ? 'Selected' : 'Play';
    });
    previous.disabled = selected === 0;
    next.disabled = selected === 5;
    play.textContent = wantedPlay ? 'Pause' : 'Play';
    emit('gardenstatechange');
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
  function applyTarget() {
    const p = active();
    if (pendingTarget === null || p.readyState < 1) return;
    const target = Math.min(pendingTarget, Number.isFinite(p.duration) ? p.duration : pendingTarget);
    heldPosition = target;
    // Metadata can arrive after the tap. Apply its held target before any audio
    // becomes playable, rather than starting at zero and correcting it later.
    if (Math.abs(p.currentTime - target) > .015) {
      try { p.currentTime = target; } catch (_) { return; }
    }
    pendingTarget = null;
  }
  function preloadAlternate() {
    const other = active() === audio ? buddy : audio;
    if (other.preload !== 'auto') {
      other.preload = 'auto';
      if (other.readyState === 0) other.load();
    }
  }
  function pause() {
    heldPosition = position(); ++ticket; wantedPlay = false; pendingStart = null;
    pair.forEach(p => p.pause());
    status.textContent = ''; draw(); emit('gardentimeupdate');
  }
  function begin(time) {
    const request = ++ticket, p = active();
    pair.forEach(other => { if (other !== p) other.pause(); });
    heldPosition = Math.max(0, Number(time) || 0);
    pendingTarget = heldPosition;
    wantedPlay = true;
    p.preload = 'auto';
    if (p.error) p.load();
    ink(); applyTarget();
    status.textContent = p.readyState < 3 || p.seeking ? 'Preparing ' + label(side) + '…' : '';
    draw(); emit('gardenplay'); emit('gardentimeupdate');
    // Invoke play in the tap itself, including when metadata is still loading.
    // loadedmetadata applies the pending seek before the first playable frame.
    let result;
    try { result = p.play(); } catch (error) { result = Promise.reject(error); }
    pendingStart = Promise.resolve(result).then(() => {
      if (request !== ticket || p !== active() || !wantedPlay) return;
      applyTarget(); status.textContent = ''; pendingStart = null;
      preloadAlternate(); draw();
    }).catch(error => {
      if (request !== ticket || p !== active() || !wantedPlay) return;
      pause();
      status.textContent = error.name === 'NotAllowedError' ? 'Tap Play to continue this cast.' : 'This passage could not start. Try Play again.';
    });
    return pendingStart;
  }
  function start() {
    if (wantedPlay) return pendingStart || Promise.resolve();
    return begin(active().ended ? 0 : position());
  }
  function seek(time) {
    heldPosition = Math.max(0, Number(time) || 0);
    pendingTarget = heldPosition;
    const p = active();
    applyTarget();
    if (p.readyState < 1) {
      p.preload = wantedPlay ? 'auto' : 'metadata';
      if (!wantedPlay && (p.networkState === 0 || p.networkState === 1)) p.load();
    }
    emit('gardentimeupdate'); draw();
  }
  // The stable public element owns the UI and field. Its virtual transport
  // follows whichever physical element is selected, including pending seeks.
  audio.gardenTransport = {
    play: start, pause, seek,
    get paused() { return !wantedPlay; },
    get ended() { return pendingTarget === null && active().ended; },
    get currentTime() { return position(); },
    get duration() { return duration(); },
    get muted() { return userMuted; },
    set muted(value) { userMuted = Boolean(value); ink(); emit('gardenvolumechange'); },
    get volume() { return userVolume; },
    set volume(value) { userVolume = Math.max(0, Math.min(1, Number(value))); ink(); emit('gardenvolumechange'); }
  };
  function select(index, albumSide, shouldPlay = true) {
    if (!find(index, albumSide)) return;
    pause(); selected = index; side = albumSide; heldPosition = 0; pendingTarget = 0;
    audio.preload = buddy.preload = 'none';
    audio.src = find(index, 'original').dataset.file;
    buddy.src = find(index, 'voices').dataset.file;
    publishSelection();
    if (shouldPlay) start();
  }
  function switchCast(albumSide) {
    if (albumSide === side) return;
    const time = position(), resume = wantedPlay;
    pause(); side = albumSide; heldPosition = time; pendingTarget = time;
    publishSelection();
    if (resume) begin(time);
    else { applyTarget(); emit('gardentimeupdate'); }
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
    p.addEventListener('loadedmetadata', () => {
      if (p !== active()) return;
      applyTarget(); draw(); emit('gardentimeupdate');
    });
    p.addEventListener('play', () => { if (p !== active() || !wantedPlay) p.pause(); });
    p.addEventListener('playing', () => {
      if (p !== active() || !wantedPlay) return;
      status.textContent = ''; preloadAlternate(); draw();
    });
    p.addEventListener('waiting', () => {
      if (p === active() && wantedPlay) status.textContent = 'Loading this passage…';
    });
    p.addEventListener('timeupdate', () => {
      if (p !== active()) return;
      if (pendingTarget === null) heldPosition = p.currentTime;
      emit('gardentimeupdate');
    });
    p.addEventListener('seeked', () => {
      if (p !== active()) return;
      if (wantedPlay && !p.paused) status.textContent = '';
      emit('gardentimeupdate'); draw();
    });
    p.addEventListener('pause', () => {
      // Old queued pause events cannot cancel a newly started cast.
      if (p === active() && p.paused && wantedPlay && !p.ended) pause();
    });
    p.addEventListener('error', () => {
      // A failed background preload must never stop the audible cast.
      if (p !== active()) return;
      pause(); status.textContent = 'This comparison could not load. Try Play again.';
    });
    p.addEventListener('ended', () => {
      if (p !== active() || !wantedPlay) return;
      if (selected < 5) select(selected + 1, side);
      else { pause(); status.textContent = 'The garden has come full circle.'; }
    });
  });
  window.addEventListener('pagehide', pause);
  select(0, 'original', false);
})();
