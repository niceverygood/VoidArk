import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyPool, sectorDefinition } from '../src/sectors.js';
import { Simulation } from '../src/sim.js';

test('sectors retain early safety and introduce their signature fleets on schedule',()=>{
  for(let sector=1;sector<=3;sector++)assert.deepEqual(enemyPool(sector,0),['swarm']);
  assert.deepEqual(enemyPool(1,31),['swarm','interceptor','sniper']);
  assert.ok(!enemyPool(2,22).includes('sniper'));
  assert.equal(enemyPool(2,23).filter(k=>k==='sniper').length,3);
  assert.ok(!enemyPool(3,75).includes('carrier'));
  assert.equal(enemyPool(3,76).filter(k=>k==='carrier').length,3);
  assert.equal(sectorDefinition(99),sectorDefinition(3));
});

test('actual spawning uses each sector fleet and announces its tactic',()=>{
  for(const sector of [1,2,3]){
    const sim=new Simulation({sector},123);sim.start();
    assert.ok(sim.drainEvents().some(e=>e.type==='announce'&&e.sub===sectorDefinition(sector).tactic));
    sim.time=100;sim.enemies=[];sim.spawnTimer=0;
    sim.random=()=>.5;sim.step(.05);
    const expected=enemyPool(sector,sim.time);
    assert.equal(sim.enemies[0].kind,expected[Math.floor(.5*expected.length)]);
  }
});
