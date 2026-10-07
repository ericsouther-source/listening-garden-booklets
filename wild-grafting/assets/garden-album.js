(() => {
  'use strict';
  const audio = document.getElementById('garden-album-player');
  if (!audio) return;
  const tracks = [...document.querySelectorAll('[data-garden-track]')];
  const title = document.getElementById('garden-full-now');
  let selected = 0;
  function draw() {
    tracks.forEach((button, index) => {
      const active = index === selected;
      if (active) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
      button.querySelector('.garden-track-action').textContent = active && !audio.paused ? 'Playing' : active ? 'Selected' : 'Play';
    });
  }
  function select(index) {
    if (!tracks[index]) return;
    audio.pause(); selected = index;
    const track = tracks[index];
    audio.src = track.dataset.file;
    audio.dataset.title = 'Garden Voices · ' + track.dataset.title;
    audio.setAttribute('aria-label', audio.dataset.title);
    title.textContent = String(index + 1).padStart(2, '0') + ' / ' + track.dataset.title;
    audio.dispatchEvent(new CustomEvent('albumtrackchange', { bubbles: true }));
    audio.play().catch(() => {}); draw();
  }
  tracks.forEach((button, index) => button.addEventListener('click', () => {
    if (index !== selected || audio.error) select(index);
    else if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }));
  audio.addEventListener('play', draw);
  audio.addEventListener('pause', draw);
  audio.addEventListener('ended', () => selected < tracks.length - 1 ? select(selected + 1) : draw());
  draw();
})();
