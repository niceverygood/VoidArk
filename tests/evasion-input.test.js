import test from 'node:test';
import assert from 'node:assert/strict';
import { lateralEvasion } from '../src/evasion-input.js';
import { Simulation } from '../src/sim.js';

test('Z/C evade opposite ways relative to a rotated camera with shared cooldown and energy', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -.7]) {
    for (const [key, side] of [['KeyZ', -1], ['KeyC', 1]]) {
      const sim = new Simulation(); sim.start();
      const direction = lateralEvasion(key, yaw);
      assert.ok(sim.evade(direction));
      assert.equal(sim.player.boost, 100 - sim.vessel.evadeCost);
      assert.equal(sim.evade(lateralEvasion(key === 'KeyZ' ? 'KeyC' : 'KeyZ', yaw)), false);
      sim.step(.1, {});
      const p = sim.player.position;
      assert.ok((p.x * Math.cos(yaw) - p.z * Math.sin(yaw)) * side > 2);
      assert.equal(p.y, 0);
    }
  }
});
test('lateral evasion cannot bypass pause or insufficient propulsion', () => {
  const sim = new Simulation(); sim.start(); sim.setPaused(true);
  assert.equal(sim.evade(lateralEvasion('KeyZ', 0)), false);
  sim.setPaused(false); sim.player.boost = 0;
  assert.equal(sim.evade(lateralEvasion('KeyC', 0)), false);
  assert.equal(lateralEvasion('KeyV', 0), null);
});

