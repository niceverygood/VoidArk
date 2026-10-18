const copy=p=>({...p}),length=p=>Math.hypot(p.x,p.y,p.z),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),norm=p=>{const n=length(p)||1;return {x:p.x/n,y:p.y/n,z:p.z/n};};
export function configureTitan(e,final){Object.assign(e,{titan:true,radius:16,speed:5,hp:e.hp*1.15,maxHp:e.maxHp*1.15,cooldown:4,exposed:0,titanAttack:null});}
export function beamDistance(point,from,to){const d=sub(to,from),p=sub(point,from),n=d.x*d.x+d.y*d.y+d.z*d.z;const t=Math.max(0,Math.min(1,n?(p.x*d.x+p.y*d.y+p.z*d.z)/n:0));return length({x:p.x-d.x*t,y:p.y-d.y*t,z:p.z-d.z*t});}
export function updateTitan(sim,e,dt){
 const p=sim.player,delta=sub(p.position,e.position),distance=length(delta);e.exposed=Math.max(0,e.exposed-dt);
 if(!e.titanAttack){const dir=norm(delta),radial=Math.max(-1,Math.min(1,(distance-64)/15));e.velocity={x:(dir.x*radial+dir.z*.18)*e.speed,y:dir.y*e.speed,z:(dir.z*radial-dir.x*.18)*e.speed};for(const axis of ['x','y','z'])e.position[axis]+=e.velocity[axis]*dt;}
 if(e.titanAttack){const attack=e.titanAttack;attack.remaining-=dt;if(attack.remaining>0)return;
   const aim=norm(sub(attack.target,attack.from));
   if(attack.kind===0){const end={x:attack.from.x+aim.x*180,y:attack.from.y+aim.y*180,z:attack.from.z+aim.z*180};sim.emit('beam',{from:attack.from,to:end,color:'#ff5544',width:3.6,life:.65});if(beamDistance(p.position,attack.from,end)<4+p.radius)sim.damagePlayer(e.damage*2.2,'titanBeam',attack.from,'laser');}
   if(attack.kind===1){for(const side of [-1,0,1]){const shot=sim.shot({...e.position,x:e.position.x+side*8},null,e.damage*.8,'enemyMissile',false,aim);if(shot){shot.life=6;shot.speed=27;shot.velocity={x:aim.x*27,y:aim.y*27,z:aim.z*27};}}sim.emit('missileAlert',{position:copy(e.position)});}
   if(attack.kind===2){for(const offset of [-12,0,12])sim.addHazard({...attack.target,x:attack.target.x+offset,y:attack.target.y+offset*.3},8);}
   sim.emit('bossfire',{position:copy(e.position)});e.titanAttack=null;e.exposed=4;e.cooldown=e.hp<e.maxHp*.5?5:6;sim.emit('titanExposed',{position:copy(e.position)});return;
 }
 if(e.cooldown<=0&&distance<155){const kind=e.phase++%3,label=['멸성 주포 · 옆/상하 회피','추적 유도탄 · 펄스/교란','중력 봉쇄 · 범위 이탈'][kind],target=copy(p.position),from=copy(e.position);e.titanAttack={kind,label,target,from,remaining:kind===0?1.6:1.2};sim.emit('warning',{position:from,target,life:e.titanAttack.remaining});sim.emit('announce',{title:label,sub:'공격 뒤 코어가 4초간 노출됩니다 · 스킬 집중 공격'});}
 if(distance<e.radius+p.radius&&e.contact<=0){e.contact=1.2;sim.damagePlayer(e.damage,'contact',e.position);}
}
export function titanReward(sim,e){
 const bank=e.final?1500:650,xp=e.final?100:55;sim.meta.bank+=bank;sim.xp+=xp;sim.player.hp=sim.player.maxHp;sim.player.shield=sim.player.maxShield;sim.player.boost=100;
 for(const id of Object.keys(sim.skillTimers))sim.skillTimers[id]=0;
 const eligible=['missile','laser','fighter','chain','cannon'].filter(id=>sim.upgrades[id]<(id==='fighter'?4:5));const id=eligible[0];
 if(id){sim.upgrades[id]++;if(id==='fighter')sim.syncAllies();sim.emit('upgrade',{id,level:sim.upgrades[id]});}
 sim.emit('titanReward',{position:copy(e.position),bank,xp,weapon:id?({missile:'유도탄',laser:'관통포',fighter:'격납고',chain:'방전기',cannon:'기관포'}[id])+' +1':'무장 최대 강화 완료'});
}
