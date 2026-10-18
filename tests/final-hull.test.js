import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,STAGES} from '../src/sim.js';
import {hullDisplayName} from '../src/ship-growth.js';
import {SOLAR_CAPITALS} from '../src/space-bases.js';

test('victory and defeat retain the combat hull after temporary equipment is reset at base',()=>{
 for(const victory of [true,false]){
  const s=new Simulation({bank:100,campaign:{cleared:6},spaceBase:{initialized:true}});
  s.startCampaign(6);Object.assign(s.upgrades,{cannon:5,chain:5,laser:5});
  const name=hullDisplayName(s.snapshot()),stage=s.stage;
  assert.equal(name,'무장 프리깃');s.finish(victory);
  const result=s.result;assert.equal(result.finalHullName,name);assert.equal(result.stage,stage);
  const bank=s.meta.bank;s.finish(!victory);assert.equal(s.meta.bank,bank);assert.equal(s.result,result);
  s.openCampaignBase('earth');assert.equal(s.upgrades.laser,0);
  assert.notEqual(hullDisplayName(s.snapshot()),name);assert.equal(result.finalHullName,name);
 }
});

test('an owned selected capital keeps its actual hull name before growth',()=>{
 const capital=SOLAR_CAPITALS.find(d=>d.id==='helios');
 const s=new Simulation({ship:capital.ship,campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,owned:[capital.id],capital:capital.id}});
 s.startCampaign(7);assert.equal(s.stage,2);assert.equal(s.snapshot().growth.tier,0);
 const name=hullDisplayName(s.snapshot());assert.equal(name,capital.name);s.finish(false);
 assert.equal(s.result.finalHullName,name);assert.equal(s.result.stage,2);assert.equal(s.vessel.name,capital.name);
});

test('all selected capitals retain their names through combat growth, settlement and base reset',()=>{
 for(const capital of SOLAR_CAPITALS)for(const victory of [true,false]){
  const s=new Simulation({ship:capital.ship,campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,owned:[capital.id],capital:capital.id}});
  s.startCampaign(7);Object.assign(s.upgrades,{cannon:5,chain:5,laser:5});
  const snapshot=s.snapshot();assert(snapshot.growth.tier>0);assert.equal(snapshot.capitalName,capital.name);
  assert.equal(hullDisplayName(snapshot),capital.name);s.finish(victory);
  const result=s.result,bank=s.meta.bank;assert.equal(result.finalHullName,capital.name);
  s.finish(!victory);assert.equal(s.meta.bank,bank);assert.equal(s.result,result);
  s.openCampaignBase('sun');assert.equal(s.upgrades.laser,0);
  assert.equal(hullDisplayName(s.snapshot()),capital.name);assert.equal(result.finalHullName,capital.name);
  s.reset();assert.equal(s.snapshot().capitalName,null);assert.equal(result.finalHullName,capital.name);
 }
});

test('unowned or mismatched capital metadata does not override ordinary hull growth',()=>{
 const capital=SOLAR_CAPITALS.find(d=>d.id==='helios');
 for(const meta of [
  {ship:capital.ship,spaceBase:{initialized:true,sunBuilt:true,owned:[],capital:capital.id}},
  {ship:'scout',spaceBase:{initialized:true,sunBuilt:true,owned:[capital.id],capital:capital.id}},
  {ship:capital.ship,spaceBase:{initialized:true,sunBuilt:false,owned:[capital.id],capital:capital.id}}
 ]){
  const s=new Simulation({...meta,campaign:{cleared:8}});s.startCampaign(7);
  assert.equal(s.snapshot().capitalName,null);assert.equal(hullDisplayName(s.snapshot()),STAGES[s.stage]);
  Object.assign(s.upgrades,{cannon:5,chain:5,laser:5});assert.equal(hullDisplayName(s.snapshot()),'무장 프리깃');
  s.finish(false);assert.equal(s.result.finalHullName,'무장 프리깃');
 }
 assert.equal(hullDisplayName({stage:2}),'전투모함');
 assert.equal(hullDisplayName({stageName:'구형 함체'}),'구형 함체');
});
