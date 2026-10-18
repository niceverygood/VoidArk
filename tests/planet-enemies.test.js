import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {CAMPAIGN_STAGES,updateSolarCampaign,beginAndromedaStage} from '../src/solar-campaign.js';
import {createPlanetEnemy,animateShip} from '../src/models.js';
test('all campaign fleets, reinforcements, fortresses and bosses retain their planet identity',()=>{
 for(const stage of CAMPAIGN_STAGES){
  const sim=new Simulation({campaign:{cleared:8,andromedaCleared:9}});
  assert.ok(stage.index<8?sim.startCampaign(stage.index):beginAndromedaStage(sim,stage.localIndex));
  assert.ok(sim.enemies.every(e=>e.planetTheme===stage.id));
  const leader=sim.enemies.find(e=>e.fleetRole==='flagship');
  const launched=sim.spawnEnemyOfficer(leader,'striker',99);assert.equal(launched.planetTheme,stage.id);
  sim.enemies=sim.enemies.filter(e=>e===leader);sim.campaign.spawnTimer=0;updateSolarCampaign(sim,.05);
  assert.ok(sim.enemies.every(e=>e.planetTheme===stage.id));
  sim.campaign.combatKills=stage.kills;sim.level=4;updateSolarCampaign(sim,.05);
  assert.ok(sim.enemies.some(e=>e.campaignBase));assert.ok(sim.enemies.some(e=>e.campaignBoss));
  assert.ok(sim.enemies.every(e=>e.planetTheme===stage.id));
 }
});
test('planet hull silhouettes differ, reuse cached buffers and survive disposal of siblings',()=>{
 const signatures=new Set();
 for(const stage of CAMPAIGN_STAGES){
  const e={planetTheme:stage.id,kind:'interceptor',fleetRole:'striker',radius:3};
  const a=createPlanetEnemy(e),b=createPlanetEnemy(e);animateShip(a,1,{thrust:1});
  const hulls=[];a.traverse(o=>{if(o.name==='baked-armor')hulls.push(o);});
  const others=[];b.traverse(o=>{if(o.name==='baked-armor')others.push(o);});
  assert.ok(hulls.length>0);assert.equal(hulls[0].geometry,others[0].geometry);
  signatures.add(hulls.map(o=>Array.from(o.geometry.attributes.position.array).join(',')).join('|'));
  a.userData.dispose();animateShip(b,2,{thrust:1});b.userData.dispose();
 }
 assert.equal(signatures.size,17);
});

