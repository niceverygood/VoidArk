import {PLANETS} from './galaxy.js';
import {civilizationForOwner} from './civilizations.js';
import {civilizationCaptain} from './civilization-captains.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function spawnPoliticalBattles(sim){
 sim.politicalVisits??=new Set();
 for(const w of sim.war.wars){const p=PLANETS.find(p=>p.id===w.target);if(!civilizationForOwner(w.attacker)||!civilizationForOwner(w.defender)||p.galaxy!==sim.galaxyId||distance(p.position,sim.player.position)>320||sim.politicalVisits.has(w.id)||sim.enemies.length+w.strength+4>72)continue;
  sim.politicalVisits.add(w.id);
  for(const side of ['attacker','defender']){const owner=w[side],c=civilizationCaptain(p,owner),sign=side==='attacker'?-1:1;
   for(let i=0;i<(side==='attacker'?w.strength-w.kills:4);i++){const e=sim.spawn(i===0?'carrier':'interceptor',{x:p.position.x+sign*(75+i*6),y:p.position.y+(i-1.5)*12,z:p.position.z+(i%2?35:-35)});Object.assign(e,{enemyFleet:true,fleetRole:i?'striker':'flagship',politicalWarId:w.id,politicalSide:side,nationOwner:owner,planetId:p.id,warId:side==='attacker'?w.id:undefined,name:c.title+' / '+(i?'호위함':'기함'),hp:180+i*25,maxHp:180+i*25,speed:c.tactic==='flank'?15:9,damage:20,captain:c,enemyAppearance:{ship:c.ship,stage:i?1:2,scale:i?.55:.85,gear:{cannon:2,shield:2},color:c.color}});}
  }
 }
 for(const id of sim.politicalVisits)if(!sim.war.wars.some(w=>w.id===id))sim.politicalVisits.delete(id);
}
export function updatePoliticalShip(sim,e,dt){
 const war=sim.war.wars.find(w=>w.id===e.politicalWarId);if(!war){e.hp=0;return;}
 const targets=sim.enemies.filter(q=>q.hp>0&&q.politicalWarId===e.politicalWarId&&q.politicalSide!==e.politicalSide),target=targets.sort((a,b)=>distance(e.position,a.position)-distance(e.position,b.position))[0];
 if(!target){if(e.politicalSide==='defender')while(sim.war.wars.includes(war))sim.war.kill(war.id);else sim.war.claim(war.target,war.attacker);return;}
 const d=distance(e.position,target.position),stride=Math.min(Math.max(0,d-42),e.speed*dt);if(d>0)for(const axis of ['x','y','z'])e.position[axis]+=(target.position[axis]-e.position[axis])/d*stride;e.heading=Math.atan2(e.position.x-target.position.x,e.position.z-target.position.z);
 if(e.captain.tactic==='restore')e.hp=Math.min(e.maxHp,e.hp+2*dt);
 if(e.cooldown<=0&&d<110){e.cooldown=e.captain.fire;sim.emit('beam',{from:{...e.position},to:{...target.position},color:e.captain.color,width:.25,life:.2});target.hp-=e.damage;target.hit=.15;sim.emit('hit',{position:{...target.position},damage:e.damage,kind:target.kind,radius:target.radius,killed:target.hp<=0});if(target.hp<=0){sim.emit('explosion',{position:{...target.position},size:5,color:target.captain.color});if(target.warId)sim.war.kill(target.warId);}}
}
