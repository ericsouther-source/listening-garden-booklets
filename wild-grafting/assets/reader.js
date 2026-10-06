(() => {
'use strict';
if(location.protocol==='file:') document.querySelectorAll('.download-link').forEach(link=>link.remove());
const players=[...document.querySelectorAll('audio')], bar=document.querySelector('.now-playing'), title=document.getElementById('now-title'), toggle=document.getElementById('now-toggle'), returnButton=document.getElementById('now-return');
let current=null;
function update(){if(!current)return; title.textContent=current.dataset.title||'Listening excerpt';toggle.textContent=current.paused?'Play':'Pause';bar.hidden=current.ended;}
players.forEach(p=>{
 p.addEventListener('play',()=>{players.forEach(other=>{if(other!==p)other.pause();});current=p;bar.hidden=false;update();});
 p.addEventListener('pause',update);p.addEventListener('ended',update);
 p.addEventListener('error',()=>{const host=p.closest('.sound,.wg-transport')||p.parentElement;if(!host.querySelector('.media-error')){const msg=document.createElement('p');msg.className='media-error';msg.setAttribute('role','status');msg.textContent='This excerpt could not load. Use its download link, or try the web edition.';host.append(msg);}});
});
toggle?.addEventListener('click',()=>{if(!current)return;if(current.paused)current.play().catch(()=>{});else current.pause();});
returnButton?.addEventListener('click',()=>{if(current){let parent=current.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}current.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});current.focus();}});
})();
