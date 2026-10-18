import test from 'node:test';import assert from 'node:assert/strict';import {Simulation} from '../src/sim.js';import {jupiterPlan} from '../src/jupiter-preparation.js';import {followupQuotes} from '../src/followup-loadouts.js';
test('Mars completion removes repair caps and Jupiter goals use remaining real facility costs without mutating saves',()=>{
 const s=new Simulation({bank:520,campaign:{cleared:3},spaceBase:{initialized:true},campaignShip:{hp:.25,shield:0}});s.openCampaignBase('earth');const before=structuredClone(s.meta),p=jupiterPlan(s);
 assert.equal(p.reserve,s.baseServices().repair+s.baseServices().shield);assert.ok(s.baseServices().repair>8);assert.equal(p.capitalTotal,1450);assert.equal(p.fleetTotal,920);assert.equal(p.free,520-p.reserve);assert.equal(followupQuotes(s,3).length,3);assert.deepEqual(s.meta,before);
});
test('owned facilities and capitals are subtracted and level fleet unlock is not a paid purchase',()=>{
 const s=new Simulation({bank:1000,fleetRank:2,campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,facilities:{command:1,shipyard:1},owned:['helios']}});s.openCampaignBase('sun');const p=jupiterPlan(s);assert.equal(p.capitalTotal,0);assert.equal(p.fleetTotal,120);assert.equal(p.tier.count,3);assert.equal(p.next.level,15);assert.equal(p.next.count,5);
});
