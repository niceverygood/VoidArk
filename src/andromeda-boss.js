import {moveEnemy} from './enemy-motion.js';
import {beamDistance} from './titan.js';
const copy=p=>({...p}),norm=p=>{const n=Math.hypot(p.x,p.y,p.z)||1;return {x:p.x/n,y:p.y/n,z:p.z/n};};
export const BOSS_DOCTRINES={
 veil:{name:'공명 방어막',counter:'방전·펄스로 방어막 파괴',weak:['chain','pulse'],reduction:.28,color:'#b596ff'},
 forge:{name:'반응 장갑',counter:'유도탄·관통포로 장갑 파괴',weak:['missile','laser','lance'],reduction:.4,color:'#ff995e'},
 crown:{name:'추격 제어장',counter:'기관포·요격기로 제어장 파괴',weak:['cannon','fighter'],reduction:.55,color:'#ff6688'}
};
export function configureAndromedaBoss(e,stage){const maxGuard=e.maxHp*.45;e.tactics={doctrine:stage.system.id,guard:maxGuard,maxGuard,exposed:0,attack:null,cooldown:.6,cycle:0,breaks:0,attacks:0};}
function expose(sim,e,interrupt=false){sim.sortieRecorder?.opening(e,interrupt?'interrupt':'device');const t=e.tactics;t.guard=0;t.exposed=4.5;t.breaks++;t.attack=null;t.cooldown=4.5;sim.emit('announce',{title:interrupt?'충전 차단 · 코어 노출':'방어 장치 파괴 · 코어 노출',sub:'4.5초간 피해 ×1.6 · 과충전·선단 돌격으로 집중 공격'});}
export function bossDamageFactor(sim,e,amount,source){const t=e.tactics;if(!t)return 1;if(t.exposed>0)return 1.6;const d=BOSS_DOCTRINES[t.doctrine];
 // Every loadout can wear down the device; matching weapons break it sooner.
 t.guard=Math.max(0,t.guard-Math.min(t.maxGuard*.08,amount*(d.weak.includes(source)?1.4:.35)));
 if(t.guard<=0){expose(sim,e);return 1.6;}return d.reduction;
}
export function bossStatus(e){const t=e.tactics;if(!t)return null;const d=BOSS_DOCTRINES[t.doctrine];return t.exposed>0?`코어 노출 ${t.exposed.toFixed(1)}초 · 피해 ×1.6`:t.attack?`${t.attack.label} · ${t.attack.remaining.toFixed(1)}초 · ${t.attack.counter}`:`${d.name} ${Math.ceil(t.guard/t.maxGuard*100)}% · ${d.counter}`;}
export function updateAndromedaBoss(sim,e,dt){const t=e.tactics,p=sim.player,d=BOSS_DOCTRINES[t.doctrine],delta={x:p.position.x-e.position.x,y:p.position.y-e.position.y,z:p.position.z-e.position.z},distance=Math.hypot(delta.x,delta.y,delta.z),dir=norm(delta);
 if(e.stun>0&&t.attack){expose(sim,e,true);return;}
 const wasExposed=t.exposed>0;t.exposed=Math.max(0,t.exposed-dt);t.cooldown-=dt;
 if(wasExposed&&!t.exposed){t.guard=t.maxGuard*.65;t.cooldown=.7;}
 if(e.stun>0)return;
 const radial=Math.max(-1,Math.min(1,(distance-58)/16));moveEnemy(e,norm({x:dir.x*radial+dir.z*.25*e.side,y:dir.y*.6,z:dir.z*radial-dir.x*.25*e.side}),e.speed,dt);
 for(const other of sim.enemies){if(other.id>=e.id||other.hp<=0||other.kind==='planetBase')continue;const gap={x:e.position.x-other.position.x,y:e.position.y-other.position.y,z:e.position.z-other.position.z},n=Math.hypot(gap.x,gap.y,gap.z);if(n>.01&&n<e.radius+other.radius){const correction=Math.min((e.radius+other.radius-n)*.5,dt*9);for(const axis of ['x','y','z']){e.position[axis]+=gap[axis]/n*correction;other.position[axis]-=gap[axis]/n*correction;}}}
 if(t.attack){const a=t.attack;a.remaining-=dt;if(a.remaining>0)return;const aim=norm({x:a.target.x-a.from.x,y:a.target.y-a.from.y,z:a.target.z-a.from.z});
  if(a.kind==='beam'){const end={x:a.from.x+aim.x*180,y:a.from.y+aim.y*180,z:a.from.z+aim.z*180};sim.emit('beam',{from:a.from,to:end,color:d.color,width:2.1,life:.45});if(beamDistance(p.position,a.from,end)<3+p.radius)sim.damagePlayer(e.damage*2.6,'andromedaBeam',a.from,'laser');let hits=0;for(const ship of sim.fleet)if(ship.hp>0&&beamDistance(ship.position,a.from,end)<3+ship.radius){sim.damageFleet(ship,e.damage*2.6,'laser');if(++hits===3)break;}}
  else if(a.kind==='missile'){for(const side of [-1,0,1]){const q=sim.shot({...e.position,x:e.position.x+side*4},null,e.damage*1.2,'enemyMissile',false,aim);if(q){q.speed=30;q.life=6;q.velocity={x:aim.x*30,y:aim.y*30,z:aim.z*30};}}sim.emit('missileAlert',{position:copy(e.position)});}
  else sim.addHazard(copy(a.target),10);
  t.attacks++;sim.sortieRecorder?.opening(e,'attack');sim.emit('bossfire',{position:copy(e.position)});t.attack=null;t.exposed=3;t.guard=0;t.cooldown=3;return;
 }
 if(t.exposed<=0&&t.cooldown<=0&&distance<175){const patterns=t.doctrine==='veil'?['beam','gravity','missile']:t.doctrine==='forge'?['beam','missile','gravity']:['missile','beam','gravity'],kind=patterns[t.cycle++%3],label=kind==='beam'?'주포 조준':kind==='missile'?'추적 유도탄 충전':'중력 봉쇄 예고',counter=kind==='beam'?'Z/C·상하 회피':kind==='missile'?'1 펄스·회피':'예고 지점 이탈';
  const remaining=e.hp<e.maxHp*.5?1.15:1.5,target={x:p.position.x+p.velocity.x*remaining*.8,y:p.position.y+p.velocity.y*remaining*.8,z:p.position.z+p.velocity.z*remaining*.8};t.attack={kind,label,counter,target,from:copy(e.position),remaining};sim.emit('warning',{position:copy(e.position),target,life:remaining});sim.emit('announce',{title:label+' · '+counter,sub:'1 펄스로 충전 차단 가능 · 공격 뒤 3초 코어 노출'});
 }
 if(distance<e.radius+p.radius&&e.contact<=0){e.contact=1.2;sim.damagePlayer(e.damage,'contact',e.position);}
}
