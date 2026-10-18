// The iframe URL comes from SoundCloud's public oEmbed response for this album.
// A file:// preview uses the direct listening link because remote frames cannot
// be reliably reviewed from a local file.
if (location.protocol === 'file:') {
  document.querySelector('[data-soundcloud-player] iframe').hidden = true;
  document.querySelector('.player-offline').hidden = false;
  document.querySelector('.player-fallback').hidden = true;
}
