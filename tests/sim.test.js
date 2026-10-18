import {cleanEconomy} from '../src/economy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, DURATION, STAGES, UPGRADE_DEFS, cleanMeta, buyResearch, v, dist } from '../src/sim.js';

function isolated(meta = {}, seed = 19071) {
  const sim = new Simulation(meta, seed);
  sim.start();
  sim.enemies = [];
  sim.pickups = [];
  sim.spawnTimer = 1e9;
  sim.firstBoss = true;
  sim.finalBoss = true;
  sim.drainEvents();
  return sim;
}

function advance(sim, seconds, input = {}) {
  const frames = Math.ceil(seconds / 0.05);
  for (let i = 0; i < frames; i++) sim.step(0.05, input);
}

test('flight moves through real altitude, preserves inertia, and limits altitude', () => {
  const sim = isolated();
  advance(sim, 1, { y: 1 });
  assert.ok(sim.player.position.y > 7, 'vertical controls should move the ship visibly');
  assert.ok(sim.player.velocity.y > 9);
  const before = sim.player.position.y;
  const velocity = sim.player.velocity.y;
  sim.step(0.05, {});
  assert.ok(sim.player.position.y > before, 'releasing the key must retain brief flight inertia');
  assert.ok(sim.player.velocity.y > 0 && sim.player.velocity.y < velocity);
  advance(sim, 3, { y: 1 });
  assert.equal(sim.player.position.y, 30);
  advance(sim, 8, { y: -1 });
  assert.equal(sim.player.position.y, -30);
  assert.equal(sim.snapshot().altitude, -30);
});

test('boost accelerates, consumes energy, and recovers while resting', () => {
  const cruise = isolated();
  const boost = isolated();
  advance(cruise, 1, { z: -1 });
  advance(boost, 1, { z: -1, boost: true });
  assert.ok(Math.abs(boost.player.position.z) > Math.abs(cruise.player.position.z) * 1.9);
  assert.ok(boost.player.velocity.z < cruise.player.velocity.z * 1.9);
  assert.ok(Math.abs(boost.player.boost - 69) < 0.01);
  assert.equal(boost.drainEvents().filter(e => e.type === 'boost').length, 1);
  advance(boost, 1, {});
  assert.ok(Math.abs(boost.player.boost - 88) < 0.01);
  assert.equal(boost.boosting, false);
  const rested = isolated();
  advance(rested, 0.5, { boost: true });
  assert.equal(rested.player.boost, 100, 'boost alone must not consume energy');
});

test('pause and upgrade screens freeze clocks, projectiles, and skill cooldowns', () => {
  const sim = isolated();
  sim.castSkill('overcharge');
  sim.shot(v(), null, 1, 'cannon', true, v(1, 0, 0));
  sim.step(0.05, { x: 1 });
  assert.equal(sim.setPaused(), true);
  const before = JSON.stringify({ time: sim.time, player: sim.player, shots: sim.shots, skills: sim.skillTimers });
  advance(sim, 1, { x: 1, boost: true });
  assert.equal(JSON.stringify({ time: sim.time, player: sim.player, shots: sim.shots, skills: sim.skillTimers }), before);
  assert.equal(sim.castSkill('pulse'), false);
  assert.equal(sim.setPaused(false), true);
  sim.xp = sim.xpNeed;
  sim.levelUp();
  assert.equal(sim.phase, 'upgrade');
  const upgradeTime = sim.time;
  const remaining = sim.skillTimers.overcharge;
  advance(sim, 1, { y: 1 });
  assert.equal(sim.time, upgradeTime);
  assert.equal(sim.skillTimers.overcharge, remaining);
  assert.equal(sim.setPaused(false), false);
  assert.equal(sim.chooseUpgrade('missing'), false);
  assert.equal(sim.chooseUpgrade(sim.choices[0].id), true);
  sim.step(0.05);
  assert.ok(sim.time > upgradeTime);
});

test('simulation clamps long frame gaps and ignores negative delta', () => {
  const sim = isolated();
  sim.step(8, { x: 1 });
  assert.equal(sim.time, 0.05);
  sim.step(-5);
  assert.equal(sim.time, 0.05);
});

test('skills require live combat and enforce cooldown and research reductions', () => {
  const sim = new Simulation();
  assert.equal(sim.castSkill('pulse'), false);
  sim.start();
  assert.equal(sim.castSkill('missing'), false);
  assert.equal(sim.castSkill('constructor'), false, 'prototype names must not be treated as skill IDs');
  assert.equal(sim.castSkill('__proto__'), false);
  assert.equal(sim.castSkill('pulse'), true);
  assert.equal(sim.skillTimers.pulse, 12);
  assert.equal(sim.castSkill('pulse'), false);
  const improved = isolated({ research: { reactor: 5 } });
  improved.upgrades.reactor = 4;
  assert.equal(improved.castSkill('overcharge'), true);
  assert.ok(Math.abs(improved.skillTimers.overcharge - 28 * 0.51) < 1e-8);
  assert.equal(improved.player.overcharge, 8);
  advance(improved, 8.1);
  assert.equal(improved.player.overcharge, 0);
  assert.ok(improved.skillTimers.overcharge > 0);
});

test('pulse damages and stuns nearby enemies, clears enemy fire and wells, and recovers salvage', () => {
  const sim = isolated();
  const near = sim.spawn('gravity', v(10, 0, 0));
  const far = sim.spawn('gravity', v(60, 0, 0));
  near.armor='neutral';const nearHp = near.hp;
  const farHp = far.hp;
  const friendly = sim.shot(v(3, 0, 0), far, 1);
  const enemyNear = sim.shot(v(10, 0, 0), null, 10, 'enemy', false, v(-1, 0, 0));
  const enemyFar = sim.shot(v(40, 0, 0), null, 10, 'enemy', false, v(-1, 0, 0));
  sim.addHazard(v(5, 0, 0), 7);
  sim.addHazard(v(40, 0, 0), 7);
  sim.pickups.push({ id: 1e5, position: v(90, 0, 0), xp: 3, scrap: 8, life: 100 });
  assert.equal(sim.castSkill('pulse'), true);
  assert.ok(near.hp < nearHp);
  assert.equal(near.stun, 1.8);
  assert.equal(far.hp, farHp);
  assert.ok(sim.shots.includes(friendly));
  assert.ok(!sim.shots.includes(enemyNear));
  assert.ok(sim.shots.includes(enemyFar));
  assert.equal(sim.hazards.length, 1);
  assert.equal(sim.hazards[0].position.x, 40);
  assert.equal(sim.pickups.length, 0);
  assert.equal(sim.xp, 3);
  assert.equal(sim.scrap, 8);
});

test('salvage collection produces three distinct valid upgrade choices', () => {
  const sim = isolated();
  sim.pickups.push({ id: 1e5, position: v(2, 0, 0), xp: 7, scrap: 11, life: 100 });
  sim.step(0.05);
  assert.equal(sim.phase, 'upgrade');
  assert.equal(sim.level, 2);
  assert.equal(sim.scrap, 11);
  assert.equal(sim.pickups.length, 0);
  assert.equal(sim.choices.length, 3);
  assert.equal(new Set(sim.choices.map(c => c.id)).size, 3);
  assert.deepEqual(sim.choices.map(c => c.id), ['chain', 'missile', 'laser']);
  assert.ok(sim.choices.every(c => c.level === sim.upgrades[c.id] + 1));
  assert.ok(sim.drainEvents().some(e => e.type === 'levelup'));
});

test('levels four and eight emit ship evolution and provide a carrier escort', () => {
  const sim = isolated();
  const stages = [];
  while (sim.level < 8) {
    sim.xp = sim.xpNeed;
    sim.levelUp();
    const choice = sim.choices.find(c => c.id === 'cannon') || sim.choices.find(c => c.id === 'chain') || sim.choices[0];
    assert.equal(sim.chooseUpgrade(choice.id), true);
    stages.push(...sim.drainEvents().filter(e => e.type === 'evolve').map(e => e.stage));
  }
  assert.deepEqual(stages, [1, 2]);
  assert.equal(sim.stage, 2);
  assert.equal(sim.snapshot().stageName, STAGES[2]);
  assert.ok(Math.abs(sim.player.radius - 3.9) < 1e-8);
  assert.ok(sim.player.maxHp >= 180);
  assert.ok(sim.allies.length >= 2);
  assert.ok(UPGRADE_DEFS.every(def => sim.upgrades[def.id] <= def.maxLevel));
});

test('saved meta sanitizes non-finite values, negatives, levels and sectors', () => {
  assert.deepEqual(cleanMeta(null), { economy:cleanEconomy(),fleetRank:0,discoveries:['milky'], bank: 0, bestKills: 0, wins: 0, runs: 0, sector: 1, research: { hull: 0, reactor: 0, salvage: 0 } });
  assert.deepEqual(cleanMeta({ bank: Infinity, bestKills: 32.9, wins: -9, runs: 1e20, sector: 99,
    research: { hull: 99, reactor: NaN, salvage: '4' } }), {
    economy:cleanEconomy(),fleetRank:0,discoveries:['milky'], bank: 0, bestKills: 32, wins: 0, runs: 1e8, sector: 3, research: { hull: 5, reactor: 0, salvage: 0 },
  });
  const sim = new Simulation({ research: { hull: 3, reactor: 2 } });
  assert.equal(sim.player.maxHp, 180);
  assert.equal(sim.cooldownFactor(), 0.9);
});

test('shipyard charges quadratic costs, rejects invalid IDs, and caps research', () => {
  const meta = cleanMeta({ bank: 500 });
  assert.equal(buyResearch(meta, 'hull'), true);
  assert.equal(meta.bank, 430);
  assert.equal(buyResearch(meta, 'hull'), true);
  assert.equal(meta.bank, 150);
  assert.equal(meta.research.hull, 2);
  const unchanged = JSON.stringify(meta);
  for (const id of ['missing', 'constructor', '__proto__', 'toString']) assert.equal(buyResearch(meta, id), false);
  assert.equal(JSON.stringify(meta), unchanged);
  assert.equal(buyResearch(cleanMeta({ bank: 59 }), 'salvage'), false);
  const capped = cleanMeta({ bank: 1e6, research: { reactor: 5 } });
  assert.equal(buyResearch(capped, 'reactor'), false);
  assert.equal(capped.bank, 1e6);
});

test('results settle only once and winning advances the sector up to three', () => {
  const sim = isolated();
  sim.scrap = 100;
  sim.kills = 17;
  sim.time = 42;
  sim.finish(false);
  assert.deepEqual(sim.meta, { economy:cleanEconomy(),fleetRank:0,discoveries:['milky'], bank: 82, bestKills: 17, wins: 0, runs: 1, sector: 1, research: { hull: 0, reactor: 0, salvage: 0 } });
  sim.finish(true);
  assert.equal(sim.meta.bank, 82);
  assert.equal(sim.meta.runs, 1);
  assert.equal(sim.meta.wins, 0);
  assert.equal(sim.result.victory, false);
  sim.start();
  assert.equal(sim.time, 0);
  assert.equal(sim.result, null);
  sim.scrap = 100;
  sim.finish(true);
  assert.equal(sim.meta.bank, 302);
  assert.equal(sim.meta.sector, 2);
  assert.equal(sim.meta.wins, 1);
  sim.start(); sim.finish(true);
  assert.equal(sim.meta.sector, 3);
  sim.start(); sim.finish(true);
  assert.equal(sim.meta.sector, 3);
  assert.equal(sim.meta.runs, 4);
});

function prepareLethalFrame(sim) {
  sim.player.hp = 1;
  sim.player.shield = 0;
  sim.player.lastDamage = sim.time;
  sim.pickups.push({ id: 1e5, position: v(), xp: 2, scrap: 5, life: 100 });
}

function assertLethalFrameSettled(sim, source) {
  assert.equal(sim.phase, 'ended');
  assert.equal(sim.result.victory, false);
  assert.equal(sim.player.hp, 0);
  assert.equal(sim.kills, sim.result.kills);
  assert.equal(sim.scrap, sim.result.scrap);
  assert.equal(sim.xp, 0, 'the lethal frame must not collect more XP after settlement');
  assert.equal(sim.pickups.length, 1);
  assert.equal(sim.pickups[0].life, 100);
  assert.equal(sim.meta.runs, 1);
  assert.equal(sim.meta.bank, 12);
  const events = sim.drainEvents();
  assert.ok(events.some(e => e.type === 'damage' && e.source === source));
  const endIndex = events.findIndex(e => e.type === 'end');
  assert.ok(endIndex >= 0);
  assert.deepEqual(events.slice(endIndex + 1), [], 'no attacks, collection or other simulation events may follow the end event');
  const settled = JSON.stringify({ result: sim.result, meta: sim.meta, time: sim.time, xp: sim.xp, scrap: sim.scrap });
  advance(sim, 1, { x: 1, boost: true });
  assert.equal(JSON.stringify({ result: sim.result, meta: sim.meta, time: sim.time, xp: sim.xp, scrap: sim.scrap }), settled);
  assert.deepEqual(sim.drainEvents(), []);
}

test('lethal gravity stops the frame before enemies, weapons and salvage update', () => {
  const sim = isolated();
  prepareLethalFrame(sim);
  const enemy = sim.spawn('carrier', v(8, 0, 0));
  enemy.cooldown = 0;
  sim.addHazard(v(), 7);
  sim.hazards[0].warning = 0;
  sim.drainEvents();
  sim.step(0.05);
  assert.equal(enemy.age, 0, 'enemy simulation must not begin after gravity kills the player');
  assert.equal(sim.enemies.length, 1);
  assert.equal(sim.shots.length, 0);
  assert.equal(sim.hazards[0].life, 5.7);
  assertLethalFrameSettled(sim, 'gravity');
});

test('lethal contact stops later enemies and prevents posthumous firing and collection', () => {
  const sim = isolated();
  prepareLethalFrame(sim);
  sim.spawn('swarm', v(1, 0, 0));
  const carrier = sim.spawn('carrier', v(10, 0, 0));
  carrier.cooldown = 0;
  sim.drainEvents();
  sim.step(0.05);
  assert.equal(carrier.age, 0, 'enemies later in the iteration must not launch reinforcements after death');
  assert.equal(sim.enemies.length, 2);
  assert.equal(sim.weaponTimers.cannon, 0);
  assert.equal(sim.shots.length, 0);
  assertLethalFrameSettled(sim, 'contact');
});

test('lethal enemy fire stops later projectiles, pickup collection and ally firing', () => {
  const sim = isolated();
  prepareLethalFrame(sim);
  const enemy = sim.spawn('swarm', v(55, 0, 0));
  const enemyHp = enemy.hp;
  for (const id in sim.weaponTimers) sim.weaponTimers[id] = 9999;
  sim.shot(v(1.9, 0, 0), null, 20, 'enemy', false, v(-1, 0, 0));
  const laterShot = sim.shot(v(50, 0, 0), enemy, 999, 'cannon', true, v(1, 0, 0));
  laterShot.velocity.x = 200;
  sim.upgrades.fighter = 1;
  sim.syncAllies();
  for (const ally of sim.allies) ally.cooldown = 0;
  sim.drainEvents();
  sim.step(0.05);
  assert.equal(enemy.hp, enemyHp, 'a later friendly projectile must not score a kill after the player dies');
  assert.equal(laterShot.age, 0);
  assert.equal(laterShot.position.x, 50);
  assert.equal(sim.shots.length, 1, 'the lethal enemy projectile is removed while unprocessed projectiles remain frozen');
  assert.ok(sim.allies.every(ally => ally.cooldown === 0));
  assertLethalFrameSettled(sim, 'projectile');
});

for (const type of ['cannon', 'missile']) {
  test(`${type} uses swept collision so fast shots cannot tunnel through a small target`, () => {
    const sim = isolated();
    const enemy = sim.spawn('swarm', v(5, 0, 0));
    const hp = enemy.hp;
    const shot = sim.shot(v(), enemy, 5, type, true, v(1, 0, 0));
    // An exaggerated speed deliberately places both endpoints beyond the sphere.
    shot.speed = 200;
    shot.velocity = v(200, 0, 0);
    if (type === 'missile') {
      // Missiles cap at 70 m/s. Use a tiny test collision body so both ends
      // remain clear even at the real simulation's 50 ms maximum step.
      enemy.position.x = 1.75;
      enemy.radius = 0.1;
      shot.radius = 0.2;
      shot.speed = 70;
    }
    assert.ok(dist(shot.position, enemy.position) > shot.radius + enemy.radius);
    sim.updateShots(0.05);
    assert.ok(dist(shot.position, enemy.position) > shot.radius + enemy.radius);
    assert.ok(enemy.hp < hp);
    assert.ok(!sim.shots.includes(shot));
    assert.ok(sim.drainEvents().some(e => e.type === 'hit' && e.source === type));
  });
}

test('boss timing waits for the first boss, and victory needs the final core plus six minutes', () => {
  const sim = isolated();
  sim.firstBoss = false;
  sim.finalBoss = false;
  sim.time = 149.99;
  sim.step(0.05);
  const first = sim.enemies.find(e => e.kind === 'boss');
  assert.ok(first);
  assert.equal(first.final, false);
  sim.time = 309.99;
  sim.step(0.05);
  assert.equal(sim.finalBoss, false, 'a live first boss must block the final spawn');
  sim.damageEnemy(first, 1e9);
  sim.xp = 0;
  sim.step(0.05);
  const final = sim.enemies.find(e => e.kind === 'boss' && e.final);
  assert.ok(final);
  assert.ok(final.maxHp > first.maxHp);
  sim.damageEnemy(final, 1e9);
  assert.equal(sim.finalDefeated, true);
  assert.equal(sim.phase, 'playing', 'destroying the core early does not skip the survival clock');
  sim.time = DURATION - 0.04;
  sim.step(0.05);
  assert.equal(sim.phase, 'ended');
  assert.equal(sim.result.victory, true);
  assert.equal(sim.meta.sector, 2);

  const incomplete = isolated();
  incomplete.time = DURATION;
  incomplete.step(0.05);
  assert.equal(incomplete.phase, 'playing', 'surviving the timer alone must not award victory');
});

test('a distant final boss remains in the world instead of permanently blocking victory', () => {
  const sim = isolated();
  const boss = sim.spawn('boss', v(250, 0, 0), true);
  sim.time = 320;
  sim.step(0.05, { z: -1, boost: true });
  assert.ok(sim.enemies.includes(boss));
  assert.equal(sim.finalDefeated, false);
});

function selectBuild(sim) {
  const p = sim.player;
  const score = choice => {
    const current = sim.upgrades[choice.id];
    let value = { chain: 105, missile: 80, laser: 90, fighter: 100, cannon: current < 3 ? 130 : 92,
      reactor: 76, magnet: 45, shield: 60, armor: 40 }[choice.id];
    if (choice.id === 'armor') value += 140 * (1 - p.hp / p.maxHp);
    if (choice.id === 'shield') value += 45 * (1 - p.shield / p.maxShield);
    return value;
  };
  return [...sim.choices].sort((a, b) => score(b) - score(a))[0].id;
}

function pilot(sim) {
  const p = sim.player;
  const boss = sim.enemies.find(e => e.kind === 'boss' && e.hp > 0);
  let x = Math.sin(sim.time * 0.05) * 0.3;
  let z = -1;
  let y = (Math.sin(sim.time * 0.08) * 16 - p.position.y) * 0.06;
  if (boss) {
    const dx = boss.position.x - p.position.x;
    const dz = boss.position.z - p.position.z;
    const radius = Math.hypot(dx, dz) || 1;
    const approach = Math.max(-0.7, Math.min(0.7, (radius - 26) / 22));
    x = dx / radius * approach - dz / radius * 0.55;
    z = dz / radius * approach + dx / radius * 0.55;
    y = Math.max(-0.5, Math.min(0.5, (boss.position.y - p.position.y) / 20));
  }
  for (const enemy of sim.enemies) {
    const distance = dist(p.position, enemy.position);
    if (distance > 0 && distance < 20 && enemy.kind !== 'boss') {
      const repulsion = (20 - distance) / 20 * 1.1;
      x += (p.position.x - enemy.position.x) / distance * repulsion;
      z += (p.position.z - enemy.position.z) / distance * repulsion;
      y += (p.position.y - enemy.position.y) / distance * repulsion;
    }
  }
  if (sim.skillTimers.pulse <= 0 && (sim.pickups.length > 3 || sim.enemies.some(e => dist(p.position, e.position) < 23))) sim.castSkill('pulse');
  if (sim.enemies.length > 3 || boss) { sim.castSkill('barrage'); sim.castSkill('overcharge'); }
  return { x, y, z, boost: !boss && (p.boost > 60 || p.boost > 4 && sim.boosting) };
}

test('a six-minute seeded pilot run reaches both bosses, carrier evolution and a real win', t => {
  const sim = new Simulation({}, 19071);
  sim.start();
  const bossSpawns = [];
  const evolutions = [];
  let frames = 0;
  let peakEnemies = 0;
  let minAltitude = 0;
  let maxAltitude = 0;
  while (sim.phase !== 'ended' && sim.time < DURATION + 10 && frames++ < 12000) {
    if (sim.phase === 'upgrade') {
      assert.equal(sim.chooseUpgrade(selectBuild(sim)), true);
    } else {
      sim.step(0.05, pilot(sim));
    }
    for (const event of sim.drainEvents()) {
      if (event.type === 'boss') bossSpawns.push({ final: event.enemy.final, time: sim.time, level: sim.level });
      if (event.type === 'evolve') evolutions.push(event.stage);
    }
    peakEnemies = Math.max(peakEnemies, sim.enemies.length);
    minAltitude = Math.min(minAltitude, sim.player.position.y);
    maxAltitude = Math.max(maxAltitude, sim.player.position.y);
    assert.ok(Number.isFinite(sim.player.hp) && Number.isFinite(sim.player.position.x));
  }
  assert.equal(sim.phase, 'ended');
  assert.equal(sim.result.victory, true);
  assert.ok(sim.time >= DURATION && sim.time < DURATION + 0.06);
  assert.deepEqual(bossSpawns.map(b => b.final), [false, true]);
  assert.ok((bossSpawns[0].level >= 4 || bossSpawns[0].time >= 150) && (bossSpawns[1].level >= 8 || bossSpawns[1].time >= 310));
  assert.deepEqual(evolutions, [1, 2]);
  assert.ok(sim.kills > 500);
  assert.ok(sim.level >= 20);
  assert.ok(peakEnemies <= 85);
  assert.ok(maxAltitude - minAltitude > 15, 'the long run must exercise vertical flight');
  assert.equal(sim.meta.runs, 1);
  assert.equal(sim.meta.wins, 1);
  assert.equal(sim.meta.sector, 2);
  t.diagnostic(JSON.stringify({ seconds: +sim.time.toFixed(2), kills: sim.kills, level: sim.level,
    hp: Math.round(sim.player.hp), peakEnemies, banked: sim.result.banked, altitudeSpan: +(maxAltitude - minAltitude).toFixed(1) }));
});
