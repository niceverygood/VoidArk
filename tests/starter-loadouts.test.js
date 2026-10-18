import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {loadoutQuote,STARTER_LOADOUTS} from '../src/starter-loadouts.js';
test('three different starter plans fit supplies and spend only missing upgrades through existing purchases',()=>{
 for(const def of STARTER_LOADOUTS){const s=new Simulation();s.openCampaignBase('earth');const before=structuredClone(s.meta),q=loadoutQuote(s,def.id);assert.ok(q.affordable);assert.equal(q.cost,def.id==='focus'?70:80);assert.deepEqual(s.meta,before);for(const [id,level] of q.needed)while(s.upgrades[id]<level)assert.equal(s.installEquipment(id),true);assert.equal(s.meta.bank,80-q.cost);assert.equal(loadoutQuote(s,def.id).complete,true);const loaded=new Simulation(JSON.parse(JSON.stringify(s.meta)));loaded.openCampaignBase('earth');assert.equal(loadoutQuote(loaded,def.id).cost,0);assert.equal(loaded.meta.bank,s.meta.bank);}
});
test('owned advanced weapons are never downgraded or charged again and partial plans use real discounts',()=>{
 const s=new Simulation({bank:100,spaceBase:{initialized:true},campaignShip:{gear:{cannon:5,chain:2}},base:{arsenal:2}});s.openCampaignBase('earth');const before=structuredClone(s.meta);assert.equal(loadoutQuote(s,'focus').cost,0);const q=loadoutQuote(s,'spread');assert.deepEqual(q.needed,[['missile',1]]);assert.equal(q.cost,s.equipmentCost('missile'));assert.equal(q.cost,32);assert.deepEqual(s.meta,before);assert.equal(s.installEquipment(q.nextId),true);assert.equal(s.upgrades.chain,2);assert.equal(s.upgrades.cannon,5);
});
test('insufficient and damaged budgets remain visible without granting resources or hiding alternatives',()=>{
 const s=new Simulation({bank:12,spaceBase:{initialized:true},campaignShip:{hp:.25,shield:0}});s.openCampaignBase('earth');for(const d of STARTER_LOADOUTS){const q=loadoutQuote(s,d.id);assert.equal(q.affordable,false);assert.equal(q.reserve,12);assert.ok(q.remaining<0);}assert.equal(s.meta.bank,12);assert.equal(loadoutQuote(s,'unknown'),null);
});
