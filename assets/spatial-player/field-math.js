/* Direction-only reconstruction of the saved renderer's 32-frame geometry clock. */
(function(scope){
 const vector=(az,el)=>[Math.cos(el)*Math.cos(az),Math.cos(el)*Math.sin(az),Math.sin(el)];
 const pair=g=>[vector(g[0]+g[2],g[1]),vector(g[0]-g[2],g[1])];
 const mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
 const norm=v=>{const n=Math.hypot(...v);return n?v.map(x=>x/n):[1,0,0]};
 const blend=(a,b,u)=>a.map((v,i)=>norm(mix(v,b[i],u)));
 function grainGeometry(event,age){const m=event[3];let u=Math.min(1,Math.max(0,age/Math.max(1,event[2]-1)));u=u*u*(3-2*u);return [m[0]+u*(m[1]-m[0]),m[2]+u*(m[3]-m[2]),m[4]+u*(m[5]-m[4])];}
 function grain(event,age,tick){const a=Math.floor(age/tick)*tick,b=Math.min(a+tick,event[2]-1);return blend(pair(grainGeometry(event,a)),pair(grainGeometry(event,b)),(age-a)/tick);}
 function roleGeometry(data,w,frame,geometry={valuesKey:'motifControls',startFrameKey:'motifControlStartFrame'}){const tick=data.tickFrames,f=Math.floor(frame/tick)*tick,i=(f-w[geometry.startFrameKey])/tick;return blend(pair(w[geometry.valuesKey][Math.max(0,i-1)]),pair(w[geometry.valuesKey][i]),(frame-f)/tick);}
 function state(data,w,time){const frame=Math.min(w.endFrame-1,Math.max(w.startFrame,Math.floor(time*data.sampleRate)));const active=w.events.filter(e=>frame>=e[1]+data.sourceDelayFrames&&frame<e[1]+e[2]+data.sourceDelayFrames);const groups=[];for(const role of data.roles){const events=active.filter(e=>e[0]===role.id);if(!events.length)continue;const geometry=role.geometry;
  if(geometry.kind==='event-smoothstep'){for(const e of events)groups.push({role:role.id,points:grain(e,frame-data.sourceDelayFrames-e[1],data.tickFrames)});}
  else groups.push({role:role.id,points:geometry.kind==='fixed'?pair(geometry.value):roleGeometry(data,w,frame,geometry)});
 }
 return {frame,groups,activeRoles:[...new Set(active.map(e=>e[0]))],grainPairs:groups.filter(g=>data.roles.find(r=>r.id===g.role).geometry.kind==='event-smoothstep').length};}
 const api={vector,pair,mix,norm,blend,grainGeometry,grain,roleGeometry,state};if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.SpatialFieldMath=api;
})(typeof window==='undefined'?globalThis:window);
