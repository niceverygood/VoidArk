import test from 'node:test';
import assert from 'node:assert/strict';
import { TREE_NODES, cleanTree, treePurchase } from '../src/skill-tree.js';
import { Simulation, cleanMeta, v } from '../src/sim.js';

test('tree has 60 unique nodes, prerequisites, escalating costs and safe saved ranks',()=>{
  assert.equal(TREE_NODES.length,60);assert.equal(new Set(TREE_NODES.map(n=>n.id)).size,60);
  const meta=cleanMeta({bank:10000});const before=meta.bank;
  assert.equal(treePurchase(meta,'fireRate'),false);assert.equal(meta.bank,before);
  assert.equal(treePurchase(meta,'unknown'),false);
  for(const cost of [40,160,360]){const bank=meta.bank;assert.equal(treePurchase(meta,'cannonPower'),true);assert.equal(meta.bank,bank-cost);}
  assert.equal(treePurchase(meta,'cannonPower'),false);assert.equal(treePurchase(meta,'fireRate'),true);
  const low=cleanMeta({bank:39});assert.equal(treePurchase(low,'hull'),false);assert.equal(low.bank,39);
  const tree=cleanTree({hull:Infinity,nova:999,repair:-1,cannonPower:'2'});
  assert.equal(tree.hull,0);assert.equal(tree.nova,3);assert.equal(tree.repair,0);assert.equal(tree.cannonPower,0);
  assert.deepEqual(cleanMeta(JSON.parse(JSON.stringify(meta))).tree,meta.tree);
});

test('new skills remain locked, consume cooldown, and affect actual 3D combat',()=>{
  const locked=new Simulation();locked.start();for(const id of ['nova','stasis','repair'])assert.equal(locked.castSkill(id),false);
  const sim=new Simulation({tree:{nova:1,stasis:2,repair:1}});sim.start();sim.enemies=[];
  const near=sim.spawn('carrier',v(10,0,0)),above=sim.spawn('carrier',v(0,60,0));near.armor='neutral';const hp=near.hp;
  assert.equal(sim.castSkill('nova'),true);assert.equal(hp-near.hp,160);assert.equal(above.hp,above.maxHp);
  assert.equal(sim.castSkill('nova'),false);
  assert.equal(sim.castSkill('stasis'),true);assert.equal(near.stun,4);assert.equal(above.stun,0);
  sim.player.hp=20;sim.player.shield=0;assert.equal(sim.castSkill('repair'),true);assert.equal(sim.player.hp,75);assert.equal(sim.player.shield,55);
  sim.setPaused(true);sim.skillTimers.repair=0;assert.equal(sim.castSkill('repair'),false);
  assert.deepEqual(sim.snapshot().skills.filter(s=>s.learned).map(s=>s.key),['1','2','3','4','5','6']);
});

test('permanent tech applies on next sortie and changes offense, defense and movement',()=>{
  const sim=new Simulation({tree:{hull:2,shieldRegen:2,extraEscort:1,resist:2,cannonPower:2,speed:2,magnet:1}});
  sim.start();assert.equal(sim.player.maxHp,150);sim.syncAllies();assert.equal(sim.allies.length,1);
  const enemy=sim.spawn('carrier',v(10,0,0));enemy.armor='neutral';const hp=enemy.hp;sim.damageEnemy(enemy,100,'cannon');assert.ok(Math.abs(hp-enemy.hp-116)<1e-8);
  sim.player.shield=0;sim.damagePlayer(10);assert.ok(Math.abs(sim.player.hp-140.8)<1e-8);
  const speed=sim.tech.speed;sim.meta.tree.speed=3;assert.equal(sim.tech.speed,speed);sim.start();assert.ok(sim.tech.speed>speed);
});
