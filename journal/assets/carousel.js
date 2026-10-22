(() => {
  const track = document.querySelector('.notes-track');
  if (!track) return;
  const slides = [...track.querySelectorAll('.note-slide')];
  const previous = document.querySelector('[data-notes-previous]');
  const next = document.querySelector('[data-notes-next]');
  const position = document.getElementById('notes-position');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  const perPage = () => Math.max(1, Number(getComputedStyle(track).getPropertyValue('--cards-per-page')) || 1);
  const step = () => slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
  const first = () => Math.max(0, Math.min(slides.length - perPage(), Math.round(track.scrollLeft / step())));
  function update() {
    const start = first();
    const end = Math.min(slides.length, start + perPage());
    const label = perPage() === 1 ? `${start + 1} of ${slides.length}` : `${start + 1}–${end} of ${slides.length}`;
    if (position.textContent !== label) position.textContent = label;
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
  }
  function go(index, moveFocus = false) {
    const target = Math.max(0, Math.min(slides.length - perPage(), index));
    const focusTarget = Math.max(0, Math.min(slides.length - 1, index));
    if (moveFocus) slides[focusTarget].querySelector('a').focus({preventScroll:true});
    track.scrollTo({left:target * step(), behavior:reducedMotion.matches ? 'instant' : 'smooth'});
    requestAnimationFrame(update);
  }
  previous.addEventListener('click', () => go(first() - perPage()));
  next.addEventListener('click', () => go(first() + perPage()));
  track.addEventListener('scroll', () => {cancelAnimationFrame(frame);frame=requestAnimationFrame(update)}, {passive:true});
  track.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const focused = slides.findIndex(slide => slide.contains(document.activeElement));
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : focused >= 0 ? focused + direction : first() + direction * perPage();
    go(index, focused >= 0);
  });
  new ResizeObserver(update).observe(track);
  update();
})();
