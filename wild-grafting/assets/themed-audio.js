(() => {
  'use strict';
  // The ink changes; the recording still plays through its ordinary HTML audio element.
  const icons = {
    play: '<path d="M8 5v14l12-7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="5"/>',
    sound: '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" stroke="none"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    muted: '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" stroke="none"/><path d="m16 9 6 6m0-6-6 6"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
  const clock = time => Number.isFinite(time) ? Math.floor(Math.max(0, time) / 60) + ':' + String(Math.floor(Math.max(0, time) % 60)).padStart(2, '0') : '–:––';

  function enhance(audio) {
    const media = audio.gardenTransport || audio;
    const box = document.createElement('div');
    box.className = 'garden-audio';
    box.setAttribute('role', 'group');
    box.innerHTML = '<button class="garden-audio-play" type="button"></button><div class="garden-audio-timeline"><input class="garden-audio-seek" type="range" min="0" max="1" step="0.1" value="0"><div class="garden-audio-times" aria-hidden="true"><span class="garden-audio-elapsed">0:00</span><span class="garden-audio-duration">–:––</span></div></div><button class="garden-audio-mute" type="button"></button><input class="garden-audio-volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"><span class="garden-audio-message" role="status"></span>';
    const play = box.querySelector('.garden-audio-play');
    const mute = box.querySelector('.garden-audio-mute');
    const seek = box.querySelector('.garden-audio-seek');
    const volume = box.querySelector('.garden-audio-volume');
    const elapsed = box.querySelector('.garden-audio-elapsed');
    const length = box.querySelector('.garden-audio-duration');
    const message = box.querySelector('.garden-audio-message');
    let pendingSeek = null;

    function duration() {
      if (audio.gardenTransport) return media.duration;
      if (audio.readyState >= 1 && Number.isFinite(audio.duration)) return audio.duration;
      const filename = decodeURIComponent((audio.dataset.fieldFile || audio.getAttribute('src') || '').split('/').pop());
      return window.WG_FIELD_CATALOG?.audio?.[filename]?.duration || 0;
    }
    function update() {
      const name = audio.dataset.title || audio.getAttribute('aria-label') || 'Listening excerpt';
      const playing = !media.paused && !media.ended;
      const end = duration();
      const time = pendingSeek ?? media.currentTime;
      box.setAttribute('aria-label', name + ' audio player');
      box.dataset.playing = String(playing);
      play.innerHTML = icon(playing ? 'pause' : 'play');
      play.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + name);
      play.title = playing ? 'Pause' : 'Play';
      mute.innerHTML = icon(media.muted || media.volume === 0 ? 'muted' : 'sound');
      mute.setAttribute('aria-label', media.muted ? 'Unmute' : 'Mute');
      mute.setAttribute('aria-pressed', String(media.muted));
      volume.value = String(media.volume);
      volume.style.setProperty('--audio-progress', (media.muted ? 0 : media.volume * 100) + '%');
      seek.max = String(end || 1);
      seek.disabled = !end;
      seek.value = String(Math.min(time, end || 0));
      seek.setAttribute('aria-label', 'Seek within ' + name);
      seek.setAttribute('aria-valuetext', clock(time) + ' of ' + clock(end || NaN));
      seek.style.setProperty('--audio-progress', (end ? Math.min(100, time / end * 100) : 0) + '%');
      elapsed.textContent = clock(time);
      length.textContent = clock(end || NaN);
    }
    function applySeek() {
      if (pendingSeek === null || audio.readyState < 1) return;
      const target = pendingSeek;
      pendingSeek = null;
      try { if (media.seek) media.seek(Math.min(target, duration())); else audio.currentTime = Math.min(target, duration()); }
      catch (_) { message.textContent = 'The position is not ready yet. Try again after playback starts.'; }
      update();
    }
    play.addEventListener('click', () => {
      if (!media.paused && !media.ended) { media.pause(); return; }
      message.textContent = '';
      if (!audio.gardenTransport && audio.error) audio.load();
      // Called directly from the tap so mobile browsers can authorize playback.
      const result = media.play();
      if (result) result.catch(error => {
        if (error.name !== 'AbortError') message.textContent = 'Press Play to try again, or use the recording link below.';
        update();
      });
    });
    seek.addEventListener('input', () => {
      pendingSeek = Number(seek.value);
      if (media.seek) { media.seek(pendingSeek); pendingSeek = null; }
      else if (audio.readyState >= 1) applySeek();
      else {
        // Seeking is an explicit request; merely opening the page still fetches no audio.
        audio.preload = 'metadata';
        if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY || audio.networkState === HTMLMediaElement.NETWORK_IDLE) audio.load();
      }
      update();
    });
    mute.addEventListener('click', () => { media.muted = !media.muted; });
    volume.addEventListener('input', () => { media.volume = Number(volume.value); media.muted = false; });
    ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'volumechange', 'gardenvolumechange', 'gardenstatechange', 'gardentimeupdate', 'seeked'].forEach(event => audio.addEventListener(event, update));
    audio.addEventListener('loadedmetadata', () => { applySeek(); update(); });
    audio.addEventListener('playing', () => { message.textContent = ''; update(); });
    audio.addEventListener('error', () => { if (audio.gardenTransport) return; message.textContent = 'This recording could not load. Try Play again or use its recording link.'; update(); });
    audio.addEventListener('albumtrackchange', () => { pendingSeek = null; message.textContent = ''; update(); });
    audio.addEventListener('emptied', update);
    update();
    audio.before(box);
    box.prepend(audio);
    audio.controls = false;
    audio.classList.add('garden-audio-native');
    audio.setAttribute('tabindex', '-1');
    audio.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('audio[controls]').forEach(audio => {
    try { enhance(audio); }
    catch (_) { audio.controls = true; audio.classList.remove('garden-audio-native'); audio.removeAttribute('aria-hidden'); }
  });
})();
