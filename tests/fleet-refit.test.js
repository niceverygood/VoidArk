import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {createFleetRefit,fleetRefitQuote} from '../src/fleet-refit.js';
import {fleetRefitCost} from '../src/space-bases.js';
function ready(){
 const s=new Simulation({bank:1000,campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,facilities:{command:1,shipyard:1},roster:['frigate','support']},fleetUpgrades:[{weapon:2,armor:1,engine:1,special:2}]});
 s.openCampaignBase('sun');s.openCarrier();s.fleet[0].hp=s.fleet[0].maxHp*.4;return s;
}
const snapshot=s=>JSON.stringify([s.meta,s.scrap,s.player,s.fleet,s.events]);
test('refit quote and cancellation preserve the damaged fleet, upgrades, events and money',()=>{
 const s=ready(),before=snapshot(s),t=createFleetRefit(s,0,'destroyer');
 assert.equal(t.quote.cost,144);assert.equal(t.quote.remaining,856);assert.equal(t.quote.eligible,true);
 assert.match(t.quote.effect,/40% 유지 · 수리는 별도/);assert.equal(snapshot(s),before);
 t.cancel();assert.equal(t.commit(),false);assert.equal(snapshot(s),before);
});
test('every role quote matches the real refit and each confirmation spends once',()=>{
 for(const role of ['destroyer','support','interceptor','cruiser']){
  const s=ready(),t=createFleetRefit(s,'0',role),other=structuredClone(s.fleet[1]),upgrades=structuredClone(s.fleet[0].upgrades);
  assert.equal(t.commit(),true);assert.equal(s.meta.bank,1000-fleetRefitCost(role));
  assert.deepEqual(t.quote.afterConfiguration,s.fleet[0].configuration);assert.deepEqual(s.fleet[0].upgrades,upgrades);
  assert.ok(Math.abs(s.fleet[0].hp/s.fleet[0].maxHp-.4)<1e-12);assert.deepEqual(s.fleet[1],other);
  assert.equal(s.meta.spaceBase.roster[0],role);assert.ok(Math.abs(s.meta.spaceBase.fleetHealth[0]-.4)<1e-12);
  const once=snapshot(s);assert.equal(t.commit(),false);assert.equal(snapshot(s),once);
 }
});
test('prerequisites, invalid selections, current role and insufficient money reject without spending',()=>{
 for(const mutate of [s=>s.phase='base',s=>s.carrierPrevious='playing',s=>s.campaignDock='earth',s=>s.meta.spaceBase.sunBuilt=false,s=>s.meta.spaceBase.facilities.shipyard=0,s=>s.meta.bank=143]){
  const s=ready();mutate(s);const before=snapshot(s),t=createFleetRefit(s,0,'destroyer');assert.equal(t.quote.eligible,false);assert.equal(t.commit(),false);assert.equal(snapshot(s),before);
 }
 const s=ready();for(const [slot,role] of [[10,'destroyer'],[.5,'destroyer'],['bad','destroyer'],[0,'bad'],[0,'frigate']]){
  const before=snapshot(s),t=createFleetRefit(s,slot,role);assert.equal(t.quote.eligible,false);assert.equal(t.commit(),false);assert.equal(snapshot(s),before);
 }
});
test('changed balance, damage, upgrades, phase or selection invalidates an old confirmation',()=>{
 for(const mutate of [s=>s.meta.bank--,s=>s.fleet[0].hp--,s=>s.upgradeFleet('0','weapon'),s=>s.closeCarrier(),s=>s.refitFleetShip(0,'support')]){
  const s=ready(),t=createFleetRefit(s,0,'destroyer');mutate(s);const after=snapshot(s);
  assert.equal(t.commit(),false);assert.equal(snapshot(s),after);
 }
});
test('refit uses combat scrap before the bank and rejects a concurrent quote',()=>{
 const s=ready();s.scrap=100;const a=createFleetRefit(s,0,'destroyer'),b=createFleetRefit(s,1,'destroyer');
 assert.equal(a.quote.remaining,956);assert.equal(a.commit(),true);assert.equal(s.scrap,0);assert.equal(s.meta.bank,956);assert.equal(b.commit(),false);
});
test('refitting a disabled ship preserves zero health and does not grant free repairs',()=>{
 const s=ready();s.fleet[0].hp=0;s.fleet[0].disabled=45;const t=createFleetRefit(s,0,'support');
 assert.match(t.quote.effect,/0% 유지/);assert.equal(t.commit(),true);assert.equal(s.fleet[0].hp,0);assert.equal(s.fleet[0].disabled,45);
});
