const vec=(x=0,y=0,z=0)=>({x,y,z});

export function hotpathBattle(Simulation) {
  const sim=new Simulation({},41031);sim.start();sim.enemies=[];sim.shots=[];sim.fleet=[];sim.allies=[];sim.drainEvents();return sim;
}
export function body(sim,x,y=0,z=0,hp=1000) {
  const enemy=sim.spawn('swarm',vec(x,y,z));Object.assign(enemy,{radius:1,hp,maxHp:hp,armor:'neutral',heading:0});return enemy;
}
export function stationaryShot(sim,type='cannon',position=vec(),damage=20) {
  const shot=sim.shot(position,null,damage,type,true,vec());shot.radius=1;shot.velocity=vec();return shot;
}
export function hotpathState(sim) {
  return {phase:sim.phase,nextId:sim.nextId,kills:sim.kills,xp:sim.xp,scrap:sim.scrap,player:sim.player,enemies:sim.enemies,shots:sim.shots.map(s=>({...s,hitIds:[...s.hitIds]})),fleet:sim.fleet,allies:sim.allies,pickups:sim.pickups,events:sim.drainEvents(),nextRandom:sim.random()};
}
export function sequentialPierce(Simulation) {
  const sim=hotpathBattle(Simulation),far=body(sim,8),near=body(sim,2),tie=body(sim,2);
  sim.upgrades.cannonPierce=2;const shot=sim.shot(vec(),null,20,'cannon',true,vec(1));shot.velocity=vec(200);shot.radius=.1;
  sim.updateShots(.05);return {sim,near,far,tie,shot};
}
export function missileBlast(Simulation) {
  const sim=hotpathBattle(Simulation),primary=body(sim,5,0,0,10),overlap=body(sim,6,0,0,10),splash=body(sim,11.999,0,0,100),tangent=body(sim,12,0,0,100);
  stationaryShot(sim,'missile',vec(5));sim.updateShots(0);return {sim,primary,overlap,splash,tangent};
}
export function coolingAllies(Simulation) {
  const sim=hotpathBattle(Simulation);sim.upgrades.fighter=2;sim.syncAllies();body(sim,25);sim.allies.forEach((a,i)=>a.cooldown=.1+i*.1);
  for(let i=0;i<30;i++)sim.updateAllies(1/60);return sim;
}
export function collisionBenchmark(Simulation) {
  const sim=hotpathBattle(Simulation);
  for(let i=0;i<72;i++){const a=i*Math.PI*2/72;body(sim,Math.cos(a)*65,(i%5-2)*7,Math.sin(a)*65,1e9);}
  for(let i=0;i<200;i++){const shot=sim.shot(vec((i%7)-3,(i%5)-2,(i%11)-5),null,1,'cannon',true,vec(1,0,0));shot.velocity=vec(.5,0,.25);}
  sim.drainEvents();return sim;
}
export function allyBenchmark(Simulation) {
  const sim=hotpathBattle(Simulation);sim.stage=2;sim.upgrades.fighter=4;sim.tech.extraEscort=10;sim.syncAllies();
  for(let i=0;i<72;i++){const a=i*Math.PI*2/72;body(sim,Math.cos(a)*40,(i%5-2)*4,Math.sin(a)*40,1e9);}
  sim.drainEvents();return sim;
}
