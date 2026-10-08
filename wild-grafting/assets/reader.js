(() => {
'use strict';
if(location.protocol==='file:') document.querySelectorAll('.download-link').forEach(link=>link.remove());
const players=[...document.querySelectorAll('audio:not([data-comparison-buddy])')], bar=document.querySelector('.now-playing'), title=document.getElementById('now-title'), toggle=document.getElementById('now-toggle'), returnButton=document.getElementById('now-return');
let current=null;
const transport=p=>p.gardenTransport||p;
function reservePlayerSpace(){
 const clearance=bar.hidden?'0px':`calc(${Math.ceil(bar.getBoundingClientRect().height)+16}px + var(--now-playing-offset))`;
 document.documentElement.style.setProperty('--now-playing-clearance',clearance);
}
if('ResizeObserver' in window)new ResizeObserver(reservePlayerSpace).observe(bar);
window.addEventListener('resize',reservePlayerSpace);
function update(){if(!current)return; title.textContent=current.dataset.title||'Listening excerpt';toggle.textContent=transport(current).paused?'Play':'Pause';bar.hidden=transport(current).ended;reservePlayerSpace();}
players.forEach(p=>{
 const takeFocus=()=>{players.forEach(other=>{if(other!==p)transport(other).pause();});current=p;bar.hidden=false;update();};
 p.addEventListener('play',()=>{if(!p.gardenTransport)takeFocus();});
 p.addEventListener('gardenplay',takeFocus);
 p.addEventListener('pause',update);p.addEventListener('ended',update);p.addEventListener('albumtrackchange',update);p.addEventListener('gardenstatechange',update);
 p.addEventListener('error',()=>{if(p.gardenTransport)return;const host=p.closest('.sound,.wg-transport')||p.parentElement;if(!host.querySelector('.media-error')){const msg=document.createElement('p');msg.className='media-error';msg.setAttribute('role','status');msg.textContent='This excerpt could not load. Use its download link, or try the web edition.';host.append(msg);}});
});
toggle?.addEventListener('click',()=>{if(!current)return;if(transport(current).paused)transport(current).play().catch(()=>{});else transport(current).pause();});
returnButton?.addEventListener('click',()=>{if(current){let parent=current.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}const control=current.closest('.garden-audio')||current;control.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});(control.querySelector?.('.garden-audio-play')||current).focus({preventScroll:true});}});
})();
