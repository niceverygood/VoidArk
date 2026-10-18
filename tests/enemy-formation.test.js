import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,dist,v} from '../src/sim.js';
import {PLANETS} from '../src/galaxy.js';
import {formationPosition,fleetDestination,updateFleetPlan} from '../src/enemy-formation.js';
const setup=()=>{const s=new Simulation();s.start('galaxy');s.enemies=[];const l=s.spawnEnemyFleet(PLANETS[0]);return {s,l};};
test('approach holds offensive escorts near carrier and waits for a coherent formation',()=>{
 const {s,l}=setup();l.age=1;l.planAge=0;
 for(const e of s.enemies){e.cooldown=0;assert.ok(dist(fleetDestination(e,l,s.player),l.position)<45);}
 s.updateEnemies(.1);assert.equal(s.shots.length,0);assert.equal(l.fleetPlan,'approach');
 l.planAge=4;updateFleetPlan(l,s.enemies,s.player,.1);assert.equal(l.fleetPlan,'engage');
 for(const e of s.enemies)if(e!==l)e.position=v(900,0,900);
 updateFleetPlan(l,s.enemies,s.player,.1);assert.equal(l.fleetPlan,'regroup');
});
test('screen stays within protection radius while support remains behind the carrier in 3D',()=>{
 const {s,l}=setup();l.position=v(40,30,20);s.player.position=v(-10,70,-30);
 const guard=formationPosition(l,'guard',0,s.player),support=formationPosition(l,'support',1,s.player);
 const dot=p=>(p.x-l.position.x)*(s.player.position.x-l.position.x)+(p.y-l.position.y)*(s.player.position.y-l.position.y)+(p.z-l.position.z)*(s.player.position.z-l.position.z);
 assert.ok(dist(guard,l.position)<22);assert.ok(dot(guard)>0);assert.ok(dot(support)<0);
});
test('damaged carrier retreats with escorts and survivors withdraw instead of rushing player',()=>{
 const {s,l}=setup();l.hp=l.maxHp*.2;updateFleetPlan(l,s.enemies,s.player,.1);assert.equal(l.fleetPlan,'retreat');
 assert.ok(dist(fleetDestination(l,l,s.player),s.player.position)>dist(l.position,s.player.position));
 const escort=s.enemies.find(e=>e.leaderId===l.id),before=dist(escort.position,s.player.position);l.hp=0;
 s.updateEnemies(.1);assert.ok(dist(escort.position,s.player.position)>before);assert.equal(escort.orphaned,true);
});
test('combat fighters stagger flanking passes and return to carrier rather than occupying identical targets',()=>{
 const {s,l}=setup();l.fleetPlan='engage';l.planAge=0;
 const a=s.spawnEnemyOfficer(l,'striker',0),b=s.spawnEnemyOfficer(l,'striker',1);
 assert.ok(dist(fleetDestination(a,l,s.player),fleetDestination(b,l,s.player))>60);
 l.planAge=13;assert.deepEqual(fleetDestination(a,l,s.player),formationPosition(l,'striker',0,s.player));
});
