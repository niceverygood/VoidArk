// Merge only simultaneous nearby impacts from the same weapon on the same target.
// Simulation damage and original events are never modified.
export function coalesceHitPresentation(events){
 const result=[],last=new Map();
 for(const e of events){
  if(e.type!=='hit'||e.enemyId==null){result.push(e);continue;}
  const key=e.enemyId+':'+e.source,p=last.get(key);
  if(p&&Math.hypot(p.position.x-e.position.x,p.position.y-e.position.y,p.position.z-e.position.z)<=3){
   p.damage+=e.damage;p.critical||=e.critical;p.killed||=e.killed;p.position={...e.position};p.visualHits++;continue;
  }
  const copy={...e,position:{...e.position},visualHits:1};last.set(key,copy);result.push(copy);
 }
 return result;
}
