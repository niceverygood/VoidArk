import test from 'node:test';import assert from 'node:assert/strict';import {Simulation} from '../src/sim.js';import {CAMPAIGN_STAGES,beginAndromedaStage} from '../src/solar-campaign.js';import {ENEMY_OFFICERS} from '../src/enemy-captains.js';
test('carrier-launched planetary officers retain solar labels and Andromeda captain names without stat changes',()=>{
 for(const stage of CAMPAIGN_STAGES){const sim=new Simulation({campaign:{cleared:8,andromedaCleared:9}});assert.ok(stage.index<8?sim.startCampaign(stage.index):beginAndromedaStage(sim,stage.localIndex));const leader=sim.enemies.find(e=>e.fleetRole==='flagship');
  for(const role of ['guard','gunner','striker','support']){const officer=sim.spawnEnemyOfficer(leader,role,99);assert.equal(officer.planetTheme,stage.id);assert.equal(officer.enemyAppearance.planetTheme,stage.id);assert.equal(officer.captain,leader.captain);assert.equal(officer.damage,ENEMY_OFFICERS[role].damage);assert.equal(officer.maxHp,ENEMY_OFFICERS[role].hp);if(stage.index<8)assert.ok(officer.name.startsWith(stage.name+' · '),officer.name);else assert.ok(officer.name.startsWith(leader.captain.name+' / '),officer.name);}
 }
});
test('real carrier timer path launches one themed officer and preserves sortie accounting',()=>{
 for(const stage of CAMPAIGN_STAGES){
  const sim=new Simulation({campaign:{cleared:8,andromedaCleared:9}});assert.ok(stage.index<8?sim.startCampaign(stage.index):beginAndromedaStage(sim,stage.localIndex));const leader=sim.enemies.find(e=>e.fleetRole==='flagship');
  sim.player.position={x:leader.position.x+60,y:leader.position.y,z:leader.position.z};leader.fleetPlan='engage';leader.launchTimer=0;leader.sorties=2;sim.drainEvents();const ids=new Set(sim.enemies.map(e=>e.id));
  sim.updateEnemyFleetShip(leader,.01);const launched=sim.enemies.filter(e=>!ids.has(e.id));assert.equal(launched.length,1,stage.id);const officer=launched[0];assert.equal(officer.leaderId,leader.id);assert.equal(officer.fleetRole,'striker');assert.equal(officer.planetTheme,stage.id);assert.equal(officer.enemyAppearance.planetTheme,stage.id);assert.equal(leader.sorties,1);assert.equal(leader.launchTimer,12);assert.equal(sim.drainEvents().filter(e=>e.type==='launch').length,1);assert.ok(officer.name.startsWith(stage.index<8?stage.name+' · ':leader.captain.name+' / '));
  const count=sim.enemies.length;sim.updateEnemyFleetShip(leader,.01);assert.equal(sim.enemies.length,count);assert.equal(leader.sorties,1);assert.equal(sim.drainEvents().filter(e=>e.type==='launch').length,0);
 }
});
test('officers from an unthemed carrier keep their original captain labels',()=>{
 const sim=new Simulation();sim.startCampaign(0);const leader=sim.enemies.find(e=>e.fleetRole==='flagship');delete leader.planetTheme;delete leader.planetEnemyLabel;const officer=sim.spawnEnemyOfficer(leader,'support',99);assert.equal(officer.planetTheme,undefined);assert.equal(officer.enemyAppearance.planetTheme,undefined);assert.equal(officer.name,leader.captain.name+' / '+ENEMY_OFFICERS.support.name);
});
