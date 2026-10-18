// Carrier-local, full 3D formations; no renderer or global world axes.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function basis(leader,player){
 const dx=player.position.x-leader.position.x,dy=player.position.y-leader.position.y,dz=player.position.z-leader.position.z;
 const n=Math.hypot(dx,dy,dz)||1,h=Math.hypot(dx,dz)||1;
 return {front:{x:dx/n,y:dy/n,z:dz/n},side:{x:-dz/h,y:0,z:dx/h}};
}
function offset(origin,b,front,side,height=0){return {x:origin.x+b.front.x*front+b.side.x*side,y:origin.y+b.front.y*front+height,z:origin.z+b.front.z*front+b.side.z*side};}
export function formationPosition(leader,role,slot,player){
 const b=basis(leader,player),sign=slot%2?1:-1,row=Math.floor(slot/4)%3;
 return offset(leader.position,b,role==='guard'?12:role==='support'?-18:-7,sign*(role==='guard'?8:role==='support'?7:20+row*4),(slot%3-1)*6);
}
export function updateFleetPlan(leader,enemies,player,dt){
 leader.planAge=(leader.planAge||0)+dt;
 const escorts=enemies.filter(e=>e.hp>0&&e.leaderId===leader.id),cohesive=escorts.filter(e=>distance(e.position,leader.position)<48).length;
 const gap=distance(leader.position,player.position);
 let next=leader.fleetPlan||'approach';
 if(leader.hp/leader.maxHp<.3)next='retreat';
 else if(next==='retreat'&&leader.hp/leader.maxHp>.5)next='regroup';
 else if(next==='engage'&&(gap>145||cohesive<Math.min(2,escorts.length)))next='regroup';
 else if((next==='approach'||next==='regroup')&&leader.planAge>3&&gap<105&&escorts.length>=2&&cohesive>=Math.ceil(escorts.length*.6))next='engage';
 if(next!==leader.fleetPlan){leader.fleetPlan=next;leader.planAge=0;}
}
export function fleetDestination(ship,leader,player){
 const b=basis(leader,player),phase=leader.fleetPlan;
 if(ship===leader){
  if(phase==='retreat')return offset(leader.position,b,-90,0,8);
  const range=phase==='regroup'?75:leader.captain.tactic==='assault'?38:leader.captain.tactic==='siege'?64:48;
  // Fixed ingress preserves separate attack sectors; gentle lateral repositioning in combat.
  const ingress=leader.ingress||{x:-b.front.x,y:-b.front.y,z:-b.front.z};
  return {x:player.position.x+ingress.x*range+b.side.x*Math.sin(leader.age*.12)*12,y:player.position.y+ingress.y*range,z:player.position.z+ingress.z*range+b.side.z*Math.sin(leader.age*.12)*12};
 }
 if(phase!=='engage'||ship.fleetRole==='guard'||ship.fleetRole==='support')return formationPosition(leader,ship.fleetRole,ship.slot,player);
 const sign=ship.slot%2?1:-1;
 if(ship.fleetRole==='gunner')return offset(leader.position,b,20,sign*32,10);
 // Staggered flank -> rear attack -> return cycles prevent every fighter diving together.
 const cycle=(leader.planAge+ship.slot*2)%18;
 if(cycle<6)return offset(player.position,b,-18,sign*40,sign*12);
 if(cycle<11){const f={x:-Math.sin(player.heading),z:-Math.cos(player.heading)};return {x:player.position.x-f.x*24+b.side.x*sign*10,y:player.position.y+sign*8,z:player.position.z-f.z*24+b.side.z*sign*10};}
 return formationPosition(leader,ship.fleetRole,ship.slot,player);
}
