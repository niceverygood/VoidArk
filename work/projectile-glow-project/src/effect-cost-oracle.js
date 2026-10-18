import {coalesceHitPresentation} from './hit-presentation.js';
import {propagateVisibleMatrices} from './hidden-world-matrices.js';
// Invoked only through the qa=1 API: synchronous A/B prevents camera/LOD/async
// material changes from invalidating paired scene counts. No simulation writes.
export function compareEffectCosts(scene,camera,effects,events,draw,repeats=6){
 const rawHits=events.filter(e=>e.type==='hit'),merged=coalesceHitPresentation(events),pairs=[];
 const render=optimized=>{
  effects.clear();let seed=19171;const random=Math.random;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const start=performance.now();
  try{for(const e of optimized?coalesceHitPresentation(events):events){if(e.type==='hit')effects.impact(e,{x:0,y:0,z:0});if(e.type==='chain')effects.chain(e.points);if(e.type==='beam')effects.beam(e.from,e.to,e.color,e.width,e.life);if(e.type==='warning')effects.warning(e.position,e.target,e.life);if(e.type==='explosion')effects.explosion(e.position,e.size,e.color);if(e.type==='bossfire')effects.burst(e.position,'#ff6954',2.5,18);}}finally{Math.random=random;}
  const emitMs=performance.now()-start;effects.update(0,0,camera,720);if(!optimized)effects.beamField.mesh.count=effects.beamField.capacity;propagateVisibleMatrices(scene);
  const counts={emitMs,hits:(optimized?merged:events).filter(e=>e.type==='hit').length,items:effects.items.length,beams:effects.beamField.active,submittedBeams:effects.beamField.mesh.count,beamTriangles:effects.beamField.mesh.count*effects.beamField.geometry.index.count/3,atlas:effects.atlas.slots.filter(s=>s.life>0).length,particles:effects.particles.filter(s=>s.life>0).length};return {...counts,...draw()};
 };
 render(false);render(true);for(let i=0;i<repeats;i++){let before,after;if(i%2){after=render(true);before=render(false);}else{before=render(false);after=render(true);}pairs.push({before,after});}render(true);
 return {rawHits:rawHits.length,mergedHits:merged.filter(e=>e.type==='hit').length,damageBefore:rawHits.reduce((n,e)=>n+e.damage,0),damageAfter:merged.filter(e=>e.type==='hit').reduce((n,e)=>n+e.damage,0),pairs};
}

