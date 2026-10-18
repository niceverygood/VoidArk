import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {beginAndromedaStage,updateSolarCampaign} from '../src/solar-campaign.js';

test('campaign replenishment restores lost repair escorts with planet identity and bounded population',()=>{
 const sim=new Simulation({bank:900,campaign:{cleared:8,andromedaCleared:9}});
 assert.equal(beginAndromedaStage(sim,1),true);
 const leader=sim.enemies.find(e=>e.fleetRole==='flagship');
 const rolesBefore=[...leader.captain.roles],metaBefore=JSON.stringify(sim.meta);
 const repairShips=sim.enemies.filter(e=>e.leaderId===leader.id&&e.fleetRole==='support');
 assert.equal(repairShips.length,3);
 for(const e of repairShips)e.hp=0;
 const previous=sim.nextId,aliveBefore=sim.enemies.filter(e=>e.hp>0).length;
 sim.campaign.spawnTimer=0;updateSolarCampaign(sim,.05);
 const added=sim.enemies.filter(e=>e.id>=previous);
 assert.equal(added.length,1);assert.equal(added[0].fleetRole,'support');
 assert.equal(added[0].leaderId,leader.id);assert.equal(added[0].planetTheme,'nereid');
 assert.equal(added[0].campaignUnit,true);assert.equal(added[0].captain,leader.captain);
 assert.equal(sim.enemies.filter(e=>e.hp>0).length,aliveBefore+1);
 assert.equal(sim.campaign.spawnTimer,1.2);assert.deepEqual(leader.captain.roles,rolesBefore);
 assert.equal(JSON.stringify(sim.meta),metaBefore);
});

test('solar replacement restores a lost shield role and never joins a retreating carrier',()=>{
 const sim=new Simulation({campaign:{cleared:8}});assert.equal(sim.startCampaign(0),true);
 const leader=sim.enemies.find(e=>e.fleetRole==='flagship');
 assert.ok(leader.captain.roles.includes('guard'));
 for(const e of sim.enemies.filter(e=>e.leaderId===leader.id&&e.fleetRole==='guard'))e.hp=0;
 let previous=sim.nextId;sim.campaign.spawnTimer=0;updateSolarCampaign(sim,.05);
 const replacement=sim.enemies.find(e=>e.id>=previous);
 assert.equal(replacement.fleetRole,'guard');assert.equal(replacement.leaderId,leader.id);
 assert.equal(replacement.planetTheme,'mercury');
 leader.fleetPlan='retreat';previous=sim.nextId;sim.campaign.spawnTimer=0;
 updateSolarCampaign(sim,.05);
 assert.ok(sim.enemies.filter(e=>e.id>=previous).every(e=>e.leaderId!==leader.id));
});
