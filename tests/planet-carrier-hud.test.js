import test from 'node:test';import assert from 'node:assert/strict';import {Simulation} from '../src/sim.js';import {CAMPAIGN_STAGES,beginAndromedaStage} from '../src/solar-campaign.js';
test('hostile carrier HUD uses solar planetary identity and preserves Andromeda captains',()=>{
 for(const stage of CAMPAIGN_STAGES){const sim=new Simulation({campaign:{cleared:8,andromedaCleared:9}});assert.ok(stage.index<8?sim.startCampaign(stage.index):beginAndromedaStage(sim,stage.localIndex));const leader=sim.enemies.find(e=>e.fleetRole==='flagship');sim.player.position={...leader.position};leader.fleetPlan='engage';const before=JSON.stringify(leader.captain),hud=sim.snapshot().hostileFleet;
 assert.equal(hud.hp,leader.hp);assert.equal(hud.maxHp,leader.maxHp);assert.ok(hud.ships>0);assert.match(hud.trait,/측면 협공/);
 if(stage.index<8){assert.equal(hud.name,leader.planetEnemyLabel);assert.equal(hud.title,'지휘 항모');assert.match(hud.trait,/행성 봉쇄 전단/);}else{assert.equal(hud.name,leader.captain.name);assert.equal(hud.title,leader.captain.title);assert.equal(hud.color,leader.captain.color);}assert.equal(JSON.stringify(leader.captain),before);
 }
});
