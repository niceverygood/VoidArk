import {ENEMY_CAPTAINS,ENEMY_OFFICERS} from '../../src/enemy-captains.js';
import {formationPosition} from '../../src/enemy-formation.js';

export function denseAIBattle(Simulation,count=120,layout='spread',fleets=true){
 const sim=new Simulation({},31627);sim.start();sim.enemies=[];sim.shots=[];sim.pickups=[];sim.allies=[];sim.fleet=[];sim.events=[];
 sim.time=220;sim.level=30;sim.stage=2;sim.meta.fleetRank=5;sim.player.hp=sim.player.maxHp=1e9;sim.player.shield=0;
 sim.upgrades.fighter=4;sim.tech.extraEscort=10;sim.upgrades.cannon=3;sim.upgrades.missile=2;sim.upgrades.laser=2;sim.upgrades.chain=2;sim.upgrades.cannonPierce=2;sim.tech.critChance=.2;
 sim.syncAllies();sim.syncFleet();
 const leaders=[],roles=['guard','gunner','striker','support'];
 if(fleets)for(let i=0;i<4;i++){
  const captain=ENEMY_CAPTAINS[i*2],a=i*Math.PI*.5,position={x:Math.cos(a)*55,y:i*5-8,z:Math.sin(a)*55};
  const leader=sim.spawn('carrier',position);Object.assign(leader,{enemyFleet:true,fleetRole:'flagship',captain,leaderId:null,slot:0,fleetPlan:'engage',planAge:4,launchTimer:2,sorties:2,ingress:{x:Math.cos(a),y:0,z:Math.sin(a)},hp:1e9,maxHp:1e9,radius:7});leaders.push(leader);
 }
 while(sim.enemies.length<count){
  const i=sim.enemies.length,a=i*2.39996,r=layout==='spread'?48+(i%17)*3:8+(i%9)*2,position={x:Math.cos(a)*r,y:(i%7-3)*(layout==='spread'?8:2),z:Math.sin(a)*r};
  if(fleets&&i%7){const leader=leaders[i%leaders.length],role=roles[i%roles.length],def=ENEMY_OFFICERS[role],enemy=sim.spawn(def.kind,position);Object.assign(enemy,{enemyFleet:true,fleetRole:role,leaderId:leader.id,captain:leader.captain,slot:i,hp:1e9,maxHp:1e9,speed:def.speed,damage:def.damage,radius:role==='guard'?3.5:2.8});if(layout==='crowded')enemy.position=formationPosition(leader,role,i,sim.player);}
  else {const kind=['swarm','interceptor','sniper','gravity','carrier'][i%5],enemy=sim.spawn(kind,position);enemy.hp=enemy.maxHp=1e9;}
 }
 sim.drainEvents();return sim;
}
export function advanceDenseAI(sim,frame,combat=false){
 const dt=1/60;sim.time=220+frame*dt;sim.player.position.x=Math.sin(frame*.007)*7;sim.player.position.y=Math.cos(frame*.011)*3;sim.player.heading=frame*.003;
 sim.updateEnemies(dt);if(combat){sim.updateWeapons(dt);sim.updateShots(dt);}sim.updateAllies(dt);sim.updateFleet(dt);
}
export const denseAIState=sim=>JSON.parse(JSON.stringify(sim,(_key,value)=>value instanceof Set?[...value]:value));
