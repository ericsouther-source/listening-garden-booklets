// The public oEmbed endpoint resolves the playlist; no playlist ID is stored here.
const albumUrl = 'https://soundcloud.com/eric-souther/sets/feralcurrent';
const player = document.querySelector('[data-soundcloud-player]');

if (player) {
  const showFallback = () => {
    player.innerHTML = '<div class="player-offline"><span class="eyebrow">SOUNDCLOUD / 6 TRACKS</span><span class="player-symbol" aria-hidden="true">▶</span><strong>Feral Current</strong><span>32:15 · Listening Garden / Eric Souther</span><a href="https://soundcloud.com/eric-souther/sets/feralcurrent">Listen on SoundCloud ↗</a></div>';
    document.querySelector('.player-fallback').hidden = true;
  };
  if (location.protocol === 'file:') {
    showFallback();
  } else {
  const endpoint = new URL('https://soundcloud.com/oembed');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('url', albumUrl);
  endpoint.searchParams.set('auto_play', 'false');
  endpoint.searchParams.set('show_comments', 'false');
  endpoint.searchParams.set('maxheight', '450');

  fetch(endpoint, { mode: 'cors' })
    .then(response => {
      if (!response.ok) throw new Error('SoundCloud oEmbed unavailable');
      return response.json();
    })
    .then(data => {
      const template = document.createElement('template');
      template.innerHTML = data.html || '';
      const returnedFrame = template.content.querySelector('iframe');
      if (!returnedFrame) throw new Error('SoundCloud oEmbed had no player');
      const src = new URL(returnedFrame.getAttribute('src'), location.href);
      if (src.protocol !== 'https:' || src.hostname !== 'w.soundcloud.com' || src.pathname !== '/player/') {
        throw new Error('Unexpected player origin');
      }
      src.searchParams.set('auto_play', 'false');
      src.searchParams.set('show_artwork', 'true');
      src.searchParams.set('color', 'c8ed65');
      const frame = document.createElement('iframe');
      frame.title = 'Listen to Feral Current on SoundCloud';
      frame.src = src.href;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      player.replaceChildren(frame);
    })
    .catch(showFallback);
  }
}
