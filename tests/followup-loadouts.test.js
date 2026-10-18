import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';import {followupQuotes} from '../src/followup-loadouts.js';
test('followup recommendations quote existing purchase and repair budgets without changing saved equipment',()=>{
 const s=new Simulation({bank:100,campaign:{cleared:1},spaceBase:{initialized:true},campaignShip:{gear:{cannon:3,missile:1},hp:.25,shield:0},base:{arsenal:2}});s.openCampaignBase('earth');
 const before=structuredClone(s.meta),rows=followupQuotes(s,1);assert.equal(rows.length,3);assert.deepEqual(s.meta,before);
 for(const r of rows){assert.equal(r.cost,s.equipmentCost(r.id));assert.equal(r.reserve,12);assert.equal(r.repairSafe,r.remaining>=12);}
 const q=rows[0];assert.equal(s.installEquipment(q.id),true);assert.equal(s.upgrades.missile,2);assert.equal(s.upgrades.cannon,3);assert.equal(s.meta.bank,100-q.cost);
 const reload=new Simulation(JSON.parse(JSON.stringify(s.meta)));reload.openCampaignBase('earth');assert.equal(followupQuotes(reload,1)[0].level,2);
});
test('followup gating and max levels never suggest a downgrade or unaffordable purchase',()=>{
 const fresh=new Simulation();fresh.openCampaignBase('earth');assert.deepEqual(followupQuotes(fresh,1),[]);
 const s=new Simulation({bank:0,campaign:{cleared:2},spaceBase:{initialized:true},campaignShip:{gear:{missile:5,laser:5,chain:5}}});s.openCampaignBase('earth');
 assert.ok(followupQuotes(s,2).every(r=>r.max&&!r.affordable));assert.deepEqual(followupQuotes(s,4),[]);
});

