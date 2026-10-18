import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,UPGRADE_DEFS} from '../src/sim.js';import {GrowthPreparation} from '../src/growth-preparation.js';
function selected(){const s=new Simulation({bank:500});s.start();s.time=17;s.level=4;s.phase='upgrade';s.choices=[UPGRADE_DEFS.find(d=>d.id==='armor')];assert.equal(s.chooseUpgrade('armor'),true);return s;}
const state=s=>structuredClone({time:s.time,hp:s.player.hp,shield:s.player.shield,maxHp:s.player.maxHp,maxShield:s.player.maxShield,gear:s.upgrades,bank:s.meta.bank});

test('a selected real upgrade stays applied while preparation holds combat until two actual render reports',()=>{
 const s=selected(),after=state(s),gate=new GrowthPreparation(s,()=>100);assert.equal(s.phase,'paused');s.step(1,{x:1});gate.sample(s);assert.deepEqual(state(s),after);
 assert.equal(gate.finish(s),false);assert.equal(gate.texturesReady(),false);gate.painted();gate.built();gate.assetsReady([]);gate.texturesReady();assert.equal(gate.rendered(),false);assert.equal(gate.finish(s),false);assert.equal(s.phase,'paused');assert.equal(gate.rendered(),true);assert.equal(gate.finish(s),true);
 assert.equal(s.phase,'playing');assert.deepEqual(state(s),after);assert.equal(gate.metrics.violations,0);assert.equal(gate.finish(s),false);assert.equal(gate.metrics.steps.filter(s=>s.name==='input-ready').length,1);
});
test('cancellation ignores late completion and leaves live texture ownership and the chosen upgrade intact',()=>{
 const s=selected(),after=state(s),gate=new GrowthPreparation(s,()=>100);let disposed=0;gate.painted();gate.built();gate.assetsReady([{dispose(){disposed++;}}]);gate.cancel();assert.equal(gate.painted(),false);assert.equal(gate.texturesReady(),false);assert.equal(gate.rendered(),false);assert.equal(gate.finish(s),false);assert.equal(s.phase,'paused');assert.equal(disposed,0);assert.deepEqual(state(s),after);
});
test('retry never applies an upgrade twice; changed combat state cannot silently resume',()=>{
 let clock=100;const s=selected(),after=state(s),gate=new GrowthPreparation(s,()=>clock);gate.painted();gate.fail(new Error('upload failed'));assert.equal(gate.finish(s),false);clock=30100;assert.equal(gate.retry(),true);assert.equal(gate.attemptStarted,30100);assert.equal(gate.started,100);assert.equal(s.chooseUpgrade('armor'),false);gate.built();gate.assetsReady([]);gate.texturesReady();gate.rendered();gate.rendered();assert.deepEqual(state(s),after);s.player.hp--;assert.throws(()=>gate.finish(s),/changed combat state/);assert.equal(s.phase,'paused');assert.equal(gate.metrics.violations,1);
});
