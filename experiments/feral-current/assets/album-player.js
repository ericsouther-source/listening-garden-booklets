(() => {
  const root = document.querySelector('[data-album-player]');
  if (!root) return;
  const audio = root.querySelector('.album-audio');
  const tracks = [...root.querySelectorAll('[data-album-track]')];
  const controls = root.querySelector('.album-controls');
  const toggle = root.querySelector('.album-toggle');
  const previous = root.querySelector('.album-previous');
  const next = root.querySelector('.album-next');
  const mute = root.querySelector('.album-mute');
  const seek = root.querySelector('.album-seek');
  const error = root.querySelector('.album-error');
  const title = root.querySelector('#album-track-title');
  let index = 0, request = 0, scrubbing = false;
  const time = seconds => {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  function clock() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : Number(tracks[index].dataset.duration);
    seek.max = duration;
    if (!scrubbing) seek.value = audio.currentTime;
    seek.setAttribute('aria-valuetext', `${time(audio.currentTime)} of ${time(duration)}`);
    root.querySelector('.album-elapsed').textContent = time(audio.currentTime);
    root.querySelector('.album-duration').textContent = time(duration);
  }
  function state() {
    const playing = !audio.paused && !audio.ended;
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${tracks[index].dataset.title}`);
    toggle.querySelector('.play-label').textContent = playing ? 'Pause' : 'Play';
    toggle.querySelector('.play-symbol').textContent = playing ? 'Ⅱ' : '▶';
    root.classList.toggle('is-playing', playing);
  }
  function showError() {
    error.textContent = 'This track could not play. Try again, choose another track, or listen on SoundCloud below.';
    error.hidden = false;
    state();
  }
  function play() {
    const token = ++request;
    error.hidden = true;
    if (audio.error) { audio.load(); seek.disabled = true; }
    if (audio.ended) audio.currentTime = 0;
    // Keep play() inside the click gesture, including on mobile browsers.
    audio.play().catch(problem => {
      if (token === request && problem.name !== 'AbortError') showError();
    });
  }
  function select(nextIndex) {
    if (nextIndex < 0 || nextIndex >= tracks.length) return;
    ++request;
    audio.pause();
    index = nextIndex;
    audio.src = tracks[index].href;
    audio.load();
    seek.disabled = true;
    seek.value = 0;
    title.textContent = tracks[index].dataset.title;
    root.querySelector('.now-number').textContent = String(index + 1).padStart(2, '0');
    seek.setAttribute('aria-label', `Seek within ${tracks[index].dataset.title}`);
    tracks.forEach((track, i) => {
      if (i === index) track.setAttribute('aria-current', 'true');
      else track.removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.disabled = index === tracks.length - 1;
    clock();
    state();
    play();
  }
  toggle.addEventListener('click', () => {
    if (audio.paused) play();
    else { ++request; audio.pause(); }
  });
  previous.addEventListener('click', () => select(index - 1));
  next.addEventListener('click', () => select(index + 1));
  mute.addEventListener('click', () => { audio.muted = !audio.muted; });
  audio.addEventListener('volumechange', () => {
    mute.setAttribute('aria-pressed', String(audio.muted));
    mute.setAttribute('aria-label', audio.muted ? 'Unmute audio' : 'Mute audio');
    mute.textContent = audio.muted ? 'Muted' : 'Sound on';
  });
  tracks.forEach((track, i) => track.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (i !== index) select(i);
    else if (audio.paused) play();
    else { ++request; audio.pause(); }
  }));
  seek.addEventListener('pointerdown', () => { scrubbing = true; });
  document.addEventListener('pointerup', () => { scrubbing = false; });
  document.addEventListener('pointercancel', () => { scrubbing = false; });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) { audio.currentTime = Number(seek.value); clock(); }
  });
  audio.addEventListener('loadedmetadata', () => { seek.disabled = false; clock(); });
  audio.addEventListener('timeupdate', clock);
  audio.addEventListener('play', state);
  audio.addEventListener('pause', state);
  audio.addEventListener('error', showError);
  audio.addEventListener('ended', () => {
    if (index < tracks.length - 1) select(index + 1);
    else { state(); clock(); }
  });
  // A cast preview and the album should never play over one another.
  document.addEventListener('play', event => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    document.querySelectorAll('audio').forEach(other => {
      if (other !== event.target && !other.paused) other.pause();
    });
  }, true);
  // Native controls and direct track links remain usable if JavaScript is unavailable.
  audio.controls = false;
  audio.hidden = true;
  controls.hidden = false;
  state();
  clock();
})();
