import {moveEnemy} from './enemy-motion.js';
import {beamDistance} from './titan.js';

// Solar attack windows use existing projectiles, warnings and effects. Base HP,
// damage formulas and equipment affinity stay unchanged; cooling is the opening.
export const SOLAR_BOSS_PATTERNS=Object.freeze({
 mercury:{name:'태양 주포',patterns:['beam','volley'],windup:1.6,opening:3.4,range:175,counter:'주포 조준선에서 Z/C·Q/E로 이탈',color:'#ffbc79'},
 venus:{name:'폭풍 봉쇄',patterns:['cloud','volley'],windup:1.8,opening:4,range:150,counter:'예고된 구름 두 곳을 피해 빈 방향으로 이동',color:'#d9b4ff'},
 mars:{name:'돌격 일제사격',patterns:['volley','missile'],windup:1.1,opening:2.6,range:135,counter:'정면에서 옆으로 회피 · 유도탄은 펄스/Z/C',color:'#ff8c73'},
 jupiter:{name:'대적점 중장포',patterns:['missile','beam'],windup:1.7,opening:3.5,range:165,counter:'유도탄은 펄스/Z/C · 주포는 상하 기동',color:'#ffb670'},
 saturn:{name:'고리 방어포',patterns:['ring','gravity'],windup:1.9,opening:3.6,range:155,counter:'고리 탄막은 Q/E로 고도를 바꾸세요',color:'#f3db97'},
 uranus:{name:'입체 교차포',patterns:['cross','volley'],windup:1.6,opening:3.2,range:160,counter:'두 조준선의 교차점에서 Z/C·상하 이탈',color:'#83e5f2'},
 neptune:{name:'중력 봉쇄',patterns:['gravity','cross'],windup:1.8,opening:3.8,range:155,counter:'예고된 중력 지점에서 XYZ로 이탈',color:'#85aaff'},
 pluto:{name:'혼성 관문포',patterns:['missile','gravity','beam'],windup:1.5,opening:3,range:165,counter:'유도탄·중력·주포 예고를 확인하고 기동',color:'#d3b0ef'},
});
const copy=p=>({x:p.x,y:p.y,z:p.z});
const norm=p=>{const n=Math.hypot(p.x,p.y,p.z)||1;return {x:p.x/n,y:p.y/n,z:p.z/n};};
const towards=(a,b)=>norm({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z});
const add=(a,b,n)=>({x:a.x+b.x*n,y:a.y+b.y*n,z:a.z+b.z*n});

export function configureSolarBoss(enemy,stage){
 if(stage.chapter==='andromeda'||!SOLAR_BOSS_PATTERNS[stage.id]||!enemy.campaignBoss)return false;
 enemy.solarBoss={planet:stage.id,attack:null,cooldown:2,exposed:0,cycle:0,attacks:0,interrupts:0};return true;
}
export function solarBossStatus(enemy){
 const t=enemy?.solarBoss,d=t&&SOLAR_BOSS_PATTERNS[t.planet];if(!d)return null;
 if(t.attack)return `${t.attack.label} · ${t.attack.remaining.toFixed(1)}초 · ${t.attack.counter}`;
 return t.exposed>0?`추진·무장 냉각 ${t.exposed.toFixed(1)}초 · 집중 공격`:`${d.name} · ${d.counter}`;
}
export function solarBossGuide(enemy){const d=SOLAR_BOSS_PATTERNS[enemy.solarBoss?.planet];return d?`${d.counter} · 1 펄스로 충전 차단 · 공격 뒤 ${d.opening}초 집중 공격`:'';}
function openWindow(sim,e,interrupted=false){
 const t=e.solarBoss,d=SOLAR_BOSS_PATTERNS[t.planet];t.attack=null;t.exposed=d.opening;t.cooldown=d.opening+.8;
 if(interrupted)t.interrupts++;sim.sortieRecorder?.opening(e,interrupted?'interrupt':'attack');
 sim.emit('announce',{title:interrupted?'충전 차단 · 반격 기회':'보스 무장 냉각 · 반격 기회',sub:`${d.opening}초간 공격 중지 · 과충전·선단 돌격으로 집중 공격`});
}
function planAttack(sim,e,d,kind){
 const windup=d.windup*(e.hp<e.maxHp*.5?.85:1),p=sim.player,from=copy(e.position),target=add(p.position,p.velocity,windup*.6),aim=towards(from,target);
 const label={beam:'주포 조준',volley:'정면 일제사격',missile:'유도탄 충전',cloud:'폭풍 구름 예고',gravity:'중력 지점 예고',ring:'고리 탄막 예고',cross:'입체 교차포 조준'}[kind];
 const counter={beam:'옆·상하 회피',volley:'정면 조준선 이탈',missile:'1 펄스·Z/C 회피',cloud:'구름 두 곳에서 이탈',gravity:'예고 지점 이탈',ring:'Q/E로 고도 변경',cross:'교차점에서 이탈'}[kind];
 const lines=[];
 if(kind==='cross')for(const side of [-1,1])lines.push({from:{x:from.x+side*10,y:from.y+side*7,z:from.z},target:copy(target)});
 else if(kind==='cloud')for(const side of [-1,1])lines.push({from:copy(from),target:{x:target.x+side*10,y:target.y,z:target.z}});
 else if(kind==='ring')for(let i=0;i<8;i++){const angle=i*Math.PI/4;lines.push({from:copy(from),target:{x:from.x+Math.sin(angle)*90,y:from.y,z:from.z+Math.cos(angle)*90}});}
 else lines.push({from,target});
 for(const line of lines)sim.emit('warning',{position:line.from,target:line.target,life:windup});
 sim.emit('announce',{title:d.name+' · '+label,sub:counter+` · 1 펄스로 충전 차단 · 공격 뒤 ${d.opening}초 반격`});
 return {kind,label,counter,remaining:windup,from,target,aim,lines};
}
function fireAttack(sim,e,a,d){
 if(a.kind==='beam'||a.kind==='cross'){
  for(const line of a.lines){const end=add(line.from,towards(line.from,line.target),180);sim.emit('beam',{from:line.from,to:end,color:d.color,width:1.3,life:.4});
   if(beamDistance(sim.player.position,line.from,end)<2+sim.player.radius){sim.damagePlayer(e.damage*1.6,'solarBeam',line.from,'laser');if(sim.phase!=='playing')return false;}
   let hits=0;for(const ship of sim.fleet)if(ship.hp>0&&beamDistance(ship.position,line.from,end)<2+ship.radius){sim.damageFleet(ship,e.damage*1.6,'laser');if(++hits===3)break;}
  }
 }else if(a.kind==='gravity'||a.kind==='cloud')for(const line of a.lines)sim.addHazard(copy(line.target),a.kind==='cloud'?8:10);
 else{
  const count=a.kind==='ring'?8:3;
  for(let i=0;i<count;i++){const offset=i-(count-1)/2,angle=a.kind==='ring'?i*Math.PI/4:offset*.15,c=Math.cos(angle),s=Math.sin(angle);
   const direction=a.kind==='ring'?{x:Math.sin(angle),y:0,z:Math.cos(angle)}:norm({x:a.aim.x*c-a.aim.z*s,y:a.aim.y,z:a.aim.x*s+a.aim.z*c});
   const missile=a.kind==='missile',shot=sim.shot(a.from,null,e.damage,missile?'enemyMissile':'boss',false,direction);
   if(missile&&shot){shot.speed=30;shot.life=6;shot.velocity={x:direction.x*30,y:direction.y*30,z:direction.z*30};}
  }
  if(a.kind==='missile')sim.emit('missileAlert',{position:copy(a.from)});
 }
 sim.emit('bossfire',{position:copy(e.position)});return true;
}
export function updateSolarBoss(sim,e,dt){
 const t=e.solarBoss,d=t&&SOLAR_BOSS_PATTERNS[t.planet];if(!d||sim.phase!=='playing')return;
 if(e.hp<=0){t.attack=null;return;}
 if(e.stun>0&&t.attack){openWindow(sim,e,true);return;}
 t.exposed=Math.max(0,t.exposed-dt);t.cooldown-=dt;if(e.stun>0)return;
 const p=sim.player,dir=towards(e.position,p.position),distance=Math.hypot(p.position.x-e.position.x,p.position.y-e.position.y,p.position.z-e.position.z);
 const holding=!!t.attack||t.exposed>0,radial=Math.max(-1,Math.min(1,(distance-58)/16));
 moveEnemy(e,holding?{x:0,y:0,z:0}:norm({x:dir.x*radial+dir.z*.22*e.side,y:dir.y*.6,z:dir.z*radial-dir.x*.22*e.side}),e.speed,dt);
 // Keep the same body separation and contact damage independently of the weapon window.
 for(const other of sim.enemies){if(other.id>=e.id||other.hp<=0||other.kind==='planetBase')continue;const delta={x:e.position.x-other.position.x,y:e.position.y-other.position.y,z:e.position.z-other.position.z},gap=Math.hypot(delta.x,delta.y,delta.z);if(gap>.01&&gap<e.radius+other.radius){const correction=Math.min((e.radius+other.radius-gap)*.5,dt*9);for(const axis of ['x','y','z']){e.position[axis]+=delta[axis]/gap*correction;other.position[axis]-=delta[axis]/gap*correction;}}}
 if(t.attack){const attack=t.attack;attack.remaining-=dt;if(attack.remaining<=0){t.attack=null;if(!fireAttack(sim,e,attack,d))return;t.attacks++;openWindow(sim,e);}}
 else if(t.exposed<=0&&t.cooldown<=0&&distance<d.range)t.attack=planAttack(sim,e,d,d.patterns[t.cycle++%d.patterns.length]);
 if(sim.phase==='playing'&&distance<e.radius+p.radius&&e.contact<=0){e.contact=1.2;sim.damagePlayer(e.damage,'contact',e.position);}
}
