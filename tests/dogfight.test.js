import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,v} from '../src/sim.js';
import {tailPosition,tailTarget} from '../src/dogfight.js';
test('tail geometry distinguishes rear, nose and excessive altitude in actual 3D',()=>{
  assert.ok(tailPosition(v(0,0,15),v(),0));assert.equal(tailPosition(v(0,0,-15),v(),0),false);
  assert.equal(tailPosition(v(0,25,15),v(),0),false);
  assert.ok(tailTarget({position:v(0,0,15),heading:0},[{id:1,hp:10,position:v(),heading:0}]));
  assert.equal(tailTarget({position:v(0,0,15),heading:Math.PI},[{hp:10,position:v(),heading:0}]),undefined);
});
test('rear interceptor locks then fires homing missile, ascent breaks its lock',()=>{
  const s=new Simulation();s.start();s.time=20;const e=s.spawn('interceptor',v(0,0,22));e.phase=0;e.cooldown=99;
  for(let i=0;i<30;i++)s.updateEnemies(.05);
  assert.ok(s.shots.some(shot=>shot.type==='enemyMissile'&&!shot.friendly));
  assert.equal(s.snapshot().dogfight.missiles,1);const shot=s.shots[0];s.player.position.x=10;s.updateShots(.1);assert.ok(shot.direction.x>0);
  s.player.position.y=30;s.updateEnemies(.1);assert.ok(e.tailLock<1.2);
});
test('evasion spends energy once, moves vertically, breaks tracking and protects during maneuver',()=>{
  const s=new Simulation();s.start();const shot=s.shot(v(0,0,20),null,10,'enemyMissile',false);shot.speed=25;
  assert.ok(s.evade({y:1}));assert.equal(s.player.boost,75);assert.ok(shot.trackingLost);assert.equal(s.evade(),false);
  const shield=s.player.shield;s.damagePlayer(20);assert.equal(s.player.shield,shield);
  s.step(.1,{});assert.ok(s.player.position.y>2);
  s.setPaused(true);const timer=s.evadeCooldown;s.step(.1,{});assert.equal(s.evadeCooldown,timer);assert.equal(s.evade(),false);
});
test('tail advantage buffs direct weapons but not unrelated area damage',()=>{
  const s=new Simulation();s.start();s.player.position=v(0,0,15);s.player.heading=0;const e=s.spawn('carrier',v());e.heading=0;e.hp=500;e.armor='neutral';
  s.damageEnemy(e,10,'cannon');assert.equal(e.hp,487);s.damageEnemy(e,10,'pulse');assert.equal(e.hp,477);
  s.player.heading=Math.PI;s.damageEnemy(e,10,'cannon');assert.equal(e.hp,467);
});

