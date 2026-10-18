import {beamDistance} from './titan.js';
export const COSMIC_TYPES={blackhole:{name:'흑점 붕괴 · 소형 블랙홀',hint:'흡인 반경에서 이탈 · SHIFT 부스트 / R 회피 · 탄도 왜곡',radius:30,life:24},storm:{name:'코로나 방출 · 태양 폭풍',hint:'주황 전하 구역 이탈 · 실드와 추진 에너지 소모',radius:25,life:16},meteor:{name:'초고속 유성우',hint:'예고 궤적에서 옆이나 위아래로 회피 · 적에게도 충돌',radius:2.8,life:9}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),towards=(a,b)=>{const d=distance(a,b)||1;return {x:(b.x-a.x)/d,y:(b.y-a.y)/d,z:(b.z-a.z)/d};};
export function spawnCosmic(sim,type,position){
 if(!COSMIC_TYPES[type]||sim.hazards.filter(h=>h.cosmic).length>=6)return null;
 const def=COSMIC_TYPES[type],r=sim.cosmicRandom,angle=r()*Math.PI*2,p=sim.player.position;
 const center=position||{x:p.x+Math.cos(angle)*24,y:p.y+(r()-.5)*18,z:p.z+Math.sin(angle)*24};
 const h={id:sim.nextId++,cosmic:type,position:{...center},radius:def.radius,warning:type==='meteor'?2:3,life:def.life,tick:0,velocity:null};
 if(type==='meteor'){const dir={x:Math.cos(angle),y:(r()-.5)*.7,z:Math.sin(angle)};h.position={x:center.x-dir.x*80,y:center.y-dir.y*80,z:center.z-dir.z*80};h.velocity={x:dir.x*38,y:dir.y*38,z:dir.z*38};h.end={x:center.x+dir.x*180,y:center.y+dir.y*180,z:center.z+dir.z*180};}
 sim.hazards.push(h);sim.emit('cosmic',{position:{...h.position},type,name:def.name,hint:def.hint,radius:h.radius});if(h.end)sim.emit('warning',{position:{...h.position},target:h.end,life:h.warning});return h;
}
export function updateCosmic(sim,dt){
 if(sim.phase!=='playing')return;
 sim.cosmicTimer-=dt;if(sim.cosmicTimer<=0){const types=['blackhole','storm','meteor'];const type=types[sim.cosmicIndex++%3];spawnCosmic(sim,type);if(type==='meteor')for(let i=0;i<2;i++)spawnCosmic(sim,type);sim.cosmicTimer=38+sim.cosmicRandom()*18;}
 for(const h of sim.hazards){if(!h.cosmic||h.warning>0)continue;const tick=h.tick<=0,old={...h.position};if(h.velocity)for(const axis of ['x','y','z'])h.position[axis]+=h.velocity[axis]*dt;
 const entities=[{position:sim.player.position,player:true},...sim.enemies.filter(e=>e.hp>0&&e.kind!=='rival')];
 for(const e of entities){const d=distance(e.position,h.position);if(h.cosmic==='meteor'){if(!h.hitIds)h.hitIds=[];const id=e.player?'player':e.id;if(!h.hitIds.includes(id)&&beamDistance(e.position,old,h.position)<h.radius+(e.player?sim.player.radius:e.radius)){h.hitIds.push(id);if(e.player)sim.damagePlayer(32,'meteor',h.position,'neutral');else sim.damageEnemy(e,80,'reactor');sim.emit('explosion',{position:{...e.position},size:6,color:'#ffb061',kind:'meteor'});}}
 else if(d<h.radius){if(h.cosmic==='blackhole'){const dir=towards(e.position,h.position),force=14+26*(1-d/h.radius);if(e.player){if(sim.evadeTimer<=0)for(const axis of ['x','y','z'])sim.player.velocity[axis]+=dir[axis]*force*dt;}else if(e.kind!=='planetBase')for(const axis of ['x','y','z'])e.position[axis]+=dir[axis]*force*.4*dt;}
 if(tick){const damage=h.cosmic==='blackhole'?(d<7?22:4):12;if(e.player){sim.damagePlayer(damage,h.cosmic,h.position,'neutral');if(h.cosmic==='storm')sim.player.boost=Math.max(0,sim.player.boost-12);}else sim.damageEnemy(e,damage*2,'reactor');}}
 if(sim.phase!=='playing')return;
 }
 if(h.cosmic==='blackhole')for(const shot of sim.shots){if(distance(shot.position,h.position)>h.radius)continue;const dir=towards(shot.position,h.position);for(const axis of ['x','y','z'])shot.velocity[axis]+=dir[axis]*35*dt;const speed=Math.hypot(shot.velocity.x,shot.velocity.y,shot.velocity.z)||1;for(const axis of ['x','y','z'])shot.direction[axis]=shot.velocity[axis]/speed;}
 if(tick)h.tick=.8;
 }
}
