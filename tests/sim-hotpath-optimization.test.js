import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,v} from '../src/sim.js';
import {hotpathBattle,body,stationaryShot,sequentialPierce,missileBlast} from './fixtures/sim-hotpath-scenarios.js';

test('squared collision candidates retain Math.hypot decisions immediately around axial and diagonal tangency',()=>{
  const sim=hotpathBattle(Simulation),d=Math.SQRT2;
  const cases=[];
  for(const factor of [1-Number.EPSILON*4,1-Number.EPSILON,1,1+Number.EPSILON,1+Number.EPSILON*4]) {
    cases.push([0,2*factor,0],[d*factor,d*factor,0],[0,d*factor,d*factor],[2*factor/Math.sqrt(3),2*factor/Math.sqrt(3),2*factor/Math.sqrt(3)]);
  }
  for(const point of cases) {
    sim.enemies=[];sim.shots=[];const e=body(sim,...point),shot=stationaryShot(sim);
    sim.updateShots(0);assert.equal(e.hp<1000,Math.hypot(...point)<2,JSON.stringify(point));
    assert.deepEqual(shot.previous,v());
  }
});

test('piercing uses travel order and stable equal-distance order with original attenuation',()=>{
  const {sim,near,tie,far,shot}=sequentialPierce(Simulation),hits=sim.drainEvents().filter(e=>e.type==='hit');
  assert.deepEqual(hits.map(e=>e.enemyId),[near.id,tie.id,far.id]);
  assert.deepEqual(hits.map(e=>e.damage),[20,17,14.45]);
  assert.deepEqual([...shot.hitIds],[near.id,tie.id,far.id]);assert.equal(sim.shots.length,0);
});

test('hostile swept candidates retain Math.hypot decisions around diagonal fleet tangency',()=>{
  const sim=hotpathBattle(Simulation);sim.player.position=v(40,0,0);
  for(const factor of [1-Number.EPSILON*4,1-Number.EPSILON,1,1+Number.EPSILON,1+Number.EPSILON*4]) {
    const point=v(Math.SQRT2*factor,Math.SQRT2*factor,0),ship={role:'frigate',hp:100,maxHp:100,radius:1,position:point};
    sim.fleet=[ship];sim.shots=[];const shot=sim.shot(v(),null,20,'enemy',false,v());shot.radius=1;shot.velocity=v();
    sim.updateShots(0);assert.equal(ship.hp<100,Math.hypot(point.x,point.y,point.z)<2,String(factor));
  }
});

test('later shots skip a target killed earlier in the same update',()=>{
  const sim=hotpathBattle(Simulation),first=body(sim,3,0,0,10),second=body(sim,6);
  for(let i=0;i<2;i++){const shot=sim.shot(v(),null,20,'cannon',true,v(1));shot.velocity=v(200);shot.radius=.1;}
  sim.updateShots(.05);const hits=sim.drainEvents().filter(e=>e.type==='hit');
  assert.deepEqual(hits.map(e=>e.enemyId),[first.id,second.id]);assert.equal(first.hp,-10);assert.equal(second.hp,980);assert.equal(sim.kills,1);
});

test('missile splash retains strict blast boundary and skips an overlapping enemy killed by splash',()=>{
  const {sim,primary,overlap,splash,tangent}=missileBlast(Simulation),hits=sim.drainEvents().filter(e=>e.type==='hit');
  assert.deepEqual(hits.map(e=>e.enemyId),[primary.id,overlap.id,splash.id]);
  assert.deepEqual(hits.map(e=>e.damage),[20,11,11]);assert.equal(splash.hp,89);assert.equal(tangent.hp,100);assert.equal(sim.kills,2);assert.equal(sim.shots.length,0);
});

test('recharging allies avoid target scans and acquire a new target immediately when ready',()=>{
  const sim=hotpathBattle(Simulation);sim.upgrades.fighter=1;sim.syncAllies();sim.allies.forEach(a=>a.cooldown=.1);
  const nearest=sim.nearest;let calls=0;sim.nearest=function(...args){calls++;return nearest.apply(this,args);};
  sim.updateAllies(.05);assert.equal(calls,0);assert.equal(sim.shots.length,0);
  sim.updateAllies(.05);assert.equal(calls,2);assert.equal(sim.shots.length,0);assert.ok(sim.allies.every(a=>a.cooldown===0));
  const target=body(sim,25);sim.updateAllies(.01);assert.equal(calls,4);assert.equal(sim.shots.length,2);assert.ok(sim.shots.every(s=>s.target===target.id));
  assert.ok(sim.allies.every(a=>Math.abs(a.cooldown-.72)<1e-12));
});

test('default nearest excludes nothing, preserves first ties and range boundaries, and consumes no RNG',()=>{
  const sim=hotpathBattle(Simulation),control=hotpathBattle(Simulation);
  for(const s of [sim,control]){body(s,10);body(s,-10);body(s,5,0,0,0);}
  const first=sim.enemies[0],second=sim.enemies[1];
  assert.equal(sim.nearest(v(),10),null);assert.equal(sim.nearest(v(),11),first);
  assert.equal(sim.nearest(v(),11,new Set([first.id])),second);
  assert.equal(sim.nearest(v(),11,new Set()),first);assert.equal(sim.random(),control.random());
});

test('non-finite ally cooldown remains unable to fire',()=>{
  const sim=hotpathBattle(Simulation);sim.upgrades.fighter=1;sim.syncAllies();body(sim,25);sim.allies.forEach(a=>a.cooldown=NaN);
  sim.updateAllies(.05);assert.equal(sim.shots.length,0);
});
