import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {SOLAR_STAGES,updateSolarCampaign} from '../src/solar-campaign.js';
import {ANDROMEDA_STAGES} from '../src/andromeda-campaign.js';
import {civilizationCaptain} from '../src/civilization-captains.js';
import {ENEMY_OFFICERS} from '../src/enemy-captains.js';
import {PLANETS} from '../src/galaxy.js';

const solarRoles=[{gunner:6,guard:3},{support:6,guard:2,striker:1},{guard:4,striker:5},{guard:4,gunner:3,striker:1,support:1},{guard:5,support:2,gunner:2},{striker:4,gunner:3,support:2},{guard:3,gunner:4,support:2},{guard:3,striker:2,gunner:2,support:2}];
const counts=units=>units.reduce((r,e)=>(r[e.fleetRole]=(r[e.fleetRole]||0)+1,r),{});

test('eight solar campaigns create unique authored commanders and complete role-weighted fleets before recording',()=>{
 const names=new Set(),tactics=new Set(),quotes=new Set();
 for(const stage of SOLAR_STAGES){
  const s=new Simulation({bank:77,campaign:{cleared:8}}),born=[];const spawn=s.spawn.bind(s);s.spawn=(...args)=>{const e=spawn(...args);born.push(e);return e;};
  const proxy={id:'planet-'+stage.index,index:stage.index,level:1+stage.index,name:stage.name,campaignFleet:false},prior=civilizationCaptain(proxy,s.war.owners[proxy.id]);
  assert.equal(s.startCampaign(stage.index),true);assert.equal(s.meta.bank,77);assert.equal(s.meta.campaign.cleared,8);assert.equal(born.length,30);assert.ok(born.every(e=>s.enemies.includes(e)));
  const leaders=s.enemies.filter(e=>e.fleetRole==='flagship');assert.equal(leaders.length,3);names.add(leaders[0].captain.name);tactics.add(leaders[0].captain.tactic);quotes.add(leaders[0].captain.quote);
  for(const leader of leaders){
   const escorts=s.enemies.filter(e=>e.leaderId===leader.id);assert.equal(escorts.length,9);assert.deepEqual(counts(escorts),solarRoles[stage.index]);assert.equal(leader.captain.roles.length,9);assert.equal(leader.captain.hp,prior.hp);assert.equal(leader.captain.fire,prior.fire);
   for(const escort of escorts){assert.equal(escort.captain,leader.captain);assert.equal(escort.kind,ENEMY_OFFICERS[escort.fleetRole].kind);assert.ok(Object.values(escort.position).every(Number.isFinite));const factor=escort.slot<prior.roles.length?1+(1+stage.index)*.07:1+stage.index*.09;assert.ok(Math.abs(escort.maxHp-ENEMY_OFFICERS[escort.fleetRole].hp*factor*(.75+stage.index*.05))<1e-8);}
  }
  if(stage.id==='jupiter'){const live=s.enemies.filter(e=>e.fleetRole==='support'||e.fleetRole==='guard');assert.equal(s.battleRecorder.spawned.support+s.battleRecorder.spawned.guard,live.length);}
 }
 assert.equal(names.size,8);assert.equal(tactics.size,8);assert.equal(quotes.size,8);
});

test('Andromeda creates final faction and nine officers directly without discarded or falsely recorded units',()=>{
 for(let index=0;index<9;index++){
  const stage=ANDROMEDA_STAGES[index],s=new Simulation({campaign:{cleared:8,andromedaCleared:8}}),born=[],captured=[];
  const spawn=s.spawn.bind(s),officer=s.spawnEnemyOfficer.bind(s);s.spawn=(...args)=>{const e=spawn(...args);born.push(e);return e;};s.spawnEnemyOfficer=(leader,...args)=>{captured.push({leaderId:leader.id,name:leader.captain.name,roles:[...leader.captain.roles]});return officer(leader,...args);};
  assert.equal(s.startExpedition(index),true);assert.equal(born.length,40);assert.equal(captured.length,36);assert.ok(born.every(e=>s.enemies.includes(e)));assert.ok(captured.every(c=>c.name===stage.system.faction&&c.roles.length===9));
  for(const leader of s.enemies.filter(e=>e.fleetRole==='flagship')){const escorts=s.enemies.filter(e=>e.leaderId===leader.id),expected=stage.system.id==='veil'?{guard:3,support:3,gunner:3}:stage.system.id==='forge'?{guard:3,gunner:6}:{striker:6,guard:3};assert.deepEqual(counts(escorts),expected);for(const e of escorts)assert.ok(Math.abs(e.maxHp-ENEMY_OFFICERS[e.fleetRole].hp*(1+stage.index*.09)*(.75+stage.index*.05))<1e-8);}
 }
});

test('solar repair doctrine replenishes its lost authored role and connects to the existing repair and gravity tactics',()=>{
 const s=new Simulation({campaign:{cleared:8}});s.startCampaign(1);const leader=s.enemies.find(e=>e.fleetRole==='flagship'),support=s.enemies.filter(e=>e.leaderId===leader.id&&e.fleetRole==='support');
 for(const e of support.slice(0,2))s.damageEnemy(e,1e6);s.campaign.spawnTimer=0;const before=s.enemies.length;updateSolarCampaign(s,.01);assert.equal(s.enemies.length,before+1);assert.equal(s.enemies.at(-1).fleetRole,'support');assert.equal(s.enemies.at(-1).captain,leader.captain);
 leader.hp-=20;leader.position={x:60,y:15,z:40};for(const e of s.enemies.filter(e=>e.leaderId===leader.id))e.position={x:62,y:15,z:40};leader.fleetPlan='engage';leader.planAge=1;leader.cooldown=1;s.updateEnemyFleetShip(leader,.1);assert.ok(leader.hp>leader.maxHp-20);
 const n=new Simulation({campaign:{cleared:8}});n.startCampaign(6);const gravity=n.enemies.find(e=>e.fleetRole==='flagship');gravity.position={x:60,y:15,z:40};for(const e of n.enemies.filter(e=>e.leaderId===gravity.id))e.position={x:62,y:15,z:40};gravity.fleetPlan='engage';gravity.planAge=1;gravity.cooldown=0;const hazards=n.hazards.length;n.updateEnemyFleetShip(gravity,.01);assert.equal(n.hazards.length,hazards+1);
});

test('ordinary political fleets retain civilization command and their original formation without campaign options',()=>{
 const s=new Simulation(),planet=PLANETS[0],captain=civilizationCaptain(planet,s.war.owners[planet.id]),leader=s.spawnEnemyFleet(planet);assert.deepEqual(leader.captain,captain);assert.deepEqual(counts(s.enemies.filter(e=>e.leaderId===leader.id)),captain.roles.reduce((r,role)=>(r[role]=(r[role]||0)+1,r),{}));
});
