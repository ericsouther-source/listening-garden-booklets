(() => {
  'use strict';
  const album=document.getElementById('garden-player');
  const tracks=[...document.querySelectorAll('.garden-tracks button')];
  const title=document.getElementById('garden-track-title');
  const previous=document.getElementById('garden-previous');
  const next=document.getElementById('garden-next');
  const status=document.getElementById('garden-status');
  let selected=0;
  function draw(){
    tracks.forEach((track,i)=>{
      if(i===selected)track.setAttribute('aria-current','true');else track.removeAttribute('aria-current');
      track.querySelector('.garden-play-label').textContent=i===selected&&!album.paused?'Playing':'Play';
    });
    previous.disabled=selected===0;next.disabled=selected===tracks.length-1;
  }
  async function select(index){
    if(index<0||index>=tracks.length)return;
    selected=index;
    album.pause();
    const track=tracks[index];
    album.src='assets/garden-voices/'+track.dataset.file;
    album.dataset.title='Garden Voices · '+track.dataset.title;
    title.textContent=String(index+1).padStart(2,'0')+' / '+track.dataset.title;
    document.getElementById('garden-track-origin').textContent='from '+track.dataset.original;
    status.textContent='';draw();
    try{await album.play();}catch(error){
      if(error.name!=='AbortError')status.textContent='Press Play in the player to begin this track.';
    }
  }
  tracks.forEach((track,i)=>track.addEventListener('click',()=>select(i)));
  previous.addEventListener('click',()=>select(selected-1));
  next.addEventListener('click',()=>select(selected+1));
  document.getElementById('garden-play-album').addEventListener('click',()=>select(0));
  album.addEventListener('play',draw);album.addEventListener('pause',draw);
  album.addEventListener('ended',()=>{
    if(selected<tracks.length-1)select(selected+1);
    else{status.textContent='The garden has come full circle.';draw();}
  });
  album.addEventListener('error',()=>{status.textContent='This track could not load. Try it again, or listen from the downloaded folder.';});

})();
