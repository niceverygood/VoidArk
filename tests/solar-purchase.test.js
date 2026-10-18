import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {createSolarPurchase,solarPurchaseQuote} from '../src/solar-purchase.js';
function ready(){const s=new Simulation({bank:10000,campaign:{cleared:8},spaceBase:{initialized:true}});s.openCampaignBase('sun');return s;}
const snapshot=s=>JSON.stringify([s.meta,s.scrap,s.player,s.fleet,s.events]);
test('solar quote and cancellation leave resources, ship, events and saved metadata unchanged',()=>{
 const s=ready(),before=snapshot(s),t=createSolarPurchase(s,'solar','foundation');
 assert.equal(t.quote.cost,400);assert.equal(t.quote.remaining,9600);assert.equal(snapshot(s),before);t.cancel();assert.equal(t.commit(),false);assert.equal(snapshot(s),before);
});
test('each construction, capital and fleet confirmation charges exactly once and quotes actual outcomes',()=>{
 const s=ready();for(const [kind,id,cost] of [['solar','foundation',400],['solar','command',180],['solar','shipyard',220],['capital','helios',650],['fleet','frigate',120]]){
  const before=snapshot(s),bank=s.meta.bank,t=createSolarPurchase(s,kind,id);assert.equal(t.quote.eligible,true);assert.equal(t.quote.cost,cost);assert.equal(snapshot(s),before);assert.ok(t.quote.effect.length);assert.equal(t.commit(),true);assert.equal(s.meta.bank,bank-cost);assert.equal(t.commit(),false);assert.equal(s.meta.bank,bank-cost);
  if(kind==='fleet')assert.deepEqual(t.quote.afterConfiguration,s.fleet.at(-1).configuration);
 }
 assert.equal(s.meta.bank,8430);assert.equal(s.fleet.length,1);assert.equal(s.meta.spaceBase.capital,'helios');
 assert.match(solarPurchaseQuote(s,'solar','shield').effect,/最大|최대 실드/);
});
test('insufficient funds, prerequisites, capacity, owned and stale confirmations never spend',()=>{
 const s=ready();for(const [kind,id] of [['capital','helios'],['fleet','frigate'],['solar','shipyard'],['solar','bad'],['bad','bad']]){const before=snapshot(s),t=createSolarPurchase(s,kind,id);assert.equal(t.quote.eligible,false);assert.equal(t.commit(),false);assert.equal(snapshot(s),before);}
 s.meta.bank=399;assert.equal(createSolarPurchase(s,'solar','foundation').commit(),false);s.meta.bank=10000;
 const stale=createSolarPurchase(s,'solar','foundation');s.meta.bank--;const before=snapshot(s);assert.equal(stale.commit(),false);assert.equal(snapshot(s),before);
 s.buildSolar('foundation');s.buildSolar('command');s.buildSolar('shipyard');s.buildCapital('helios');
 assert.equal(createSolarPurchase(s,'capital','helios').commit(),false);for(let i=0;i<4;i++)s.buildFleetShip('frigate');const full=snapshot(s);assert.equal(createSolarPurchase(s,'fleet','support').commit(),false);assert.equal(snapshot(s),full);
});
test('scrap and bank split charge matches quote and concurrent confirmations reject stale second action',()=>{
 const s=ready();s.scrap=250;const a=createSolarPurchase(s,'solar','foundation'),b=createSolarPurchase(s,'solar','foundation');assert.equal(a.quote.remaining,9850);assert.equal(a.commit(),true);assert.equal(s.scrap,0);assert.equal(s.meta.bank,9850);assert.equal(b.commit(),false);
});
