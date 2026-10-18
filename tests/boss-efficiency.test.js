import test from 'node:test';
import assert from 'node:assert/strict';
import {runEncounter,prepareInvestment,fixtureMeta} from '../work/boss-efficiency.js';
import {bossInvestmentReport} from '../src/boss-investments.js';
import {preparationState} from '../src/base-preparation.js';

const outcomes=r=>{const {stepMs,...rest}=r;return rest;};
test('controlled boss replay uses reproducible actual rules and preserves input metadata',()=>{
 const options={index:14,profile:'novice',policy:'novice',category:'escort',seed:101};
 const a=runEncounter(options),b=runEncounter(options);assert.deepEqual(outcomes(a),outcomes(b));assert.equal(a.metaPreserved,true);assert.ok(a.intercepts>0);assert.ok(a.incoming>0);
});
test('investment envelopes respect actual prices; maximum loadouts are identical zero-cost replays',()=>{
 for(const category of ['weapon','survival','escort']){const p=prepareInvestment(fixtureMeta(3),101,category,200);assert.ok(p.spent<=200);assert.equal(p.spent,p.purchases.reduce((n,q)=>n+q.cost,0));}
 const before=runEncounter({index:16,profile:'maximum',limit:10});const after=runEncounter({index:16,profile:'maximum',category:'weapon',budget:200,limit:10});
 for(const key of ['elapsed','incoming','bossDamage','hp','shield','kill','survived'])assert.equal(after[key],before[key]);assert.equal(after.spent,0);assert.equal(after.purchases.length,0);
});
test('survival capacity increases actual time alive without pretending to reduce incoming hit damage',()=>{
 const options={index:3,profile:'novice',policy:'novice',seed:101};const base=runEncounter(options),after=runEncounter({...options,category:'survival'});
 assert.equal(base.kill,false);assert.equal(after.kill,false);assert.ok(after.elapsed>base.elapsed);assert.ok(after.hullDamage>base.hullDamage);
});
test('max device hits and disabled escorts receive accurate contextual advice',()=>{
 const meta=fixtureMeta(11);meta.campaignShip.gear.missile=4;meta.campaignShip.gear.laser=5;meta.campaignShip.gear.reactor=4;meta.spaceBase.fleetHealth=[0,1];const {sim}=prepareInvestment(meta,101);const rows=bossInvestmentReport(sim,preparationState(sim)).rows;
 assert.equal(rows[0].id,'missile');assert.match(rows[0].reason,/단발 장치 피해는 늘지/);assert.match(rows[2].load,/개조만으로 즉시 부활하지/);
});
