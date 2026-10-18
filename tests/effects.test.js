import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {Effects} from '../src/effects.js';import {Simulation,v} from '../src/sim.js';

test('dense impact bursts stay bounded, dispose evicted materials and leave shared geometry reusable',()=>{
  const scene=new THREE.Scene(),fx=new Effects(scene),baseChildren=scene.children.length;fx.warning(v(),v(1,1,1),.8);const warning=fx.items[0];fx.flash(v(),1,'#ffffff');const material=fx.items[1].mat,geometry=fx.items[1].mesh.geometry;let disposed=0,sharedDisposed=0;material.addEventListener('dispose',()=>disposed++);geometry.addEventListener('dispose',()=>sharedDisposed++);
  for(let i=0;i<300;i++)fx.impact({position:v(1,2,3),radius:2,damage:30,source:'cannon'},v());
  assert.equal(fx.items.length,fx.maxItems);assert.equal(disposed,1);assert.equal(sharedDisposed,0);assert.ok(scene.children.length<=fx.maxItems+baseChildren);assert.ok(fx.items.includes(warning),'dense decorative impacts must not hide attack telegraphs');
  const camera=new THREE.PerspectiveCamera();camera.position.z=30;fx.update(2,2,camera,720);assert.equal(fx.items.length,0);assert.equal(scene.children.length,baseChildren);assert.equal(sharedDisposed,0);assert.ok(fx.beamField.slots.every(s=>s.life===0));
  fx.explosion(v(),6);fx.clear();fx.update(.05,3,camera,720);assert.equal(fx.items.length,0);assert.ok(fx.alphas.every(a=>a===0));assert.ok(fx.chunks.every(c=>c.life<=0));
});

test('feedback carries actual critical, kill, contact/projectile origin and shield-break outcomes without changing damage rules',()=>{
  const s=new Simulation({tree:{critChance:3}});s.start();s.enemies=[];s.random=()=>0;
  const e=s.spawn('swarm',v(10,0,0));s.damageEnemy(e,30,'cannon',v(9,0,0));const hit=s.drainEvents().find(x=>x.type==='hit');assert.equal(hit.critical,true);assert.equal(hit.killed,true);assert.equal(hit.damage,45);assert.deepEqual(hit.position,v(9,0,0));assert.equal(hit.enemyId,e.id);
  s.player.shield=5;s.damagePlayer(12,'projectile',v(0,0,-4));const damage=s.drainEvents().find(x=>x.type==='damage');assert.equal(damage.shielded,5);assert.equal(damage.shieldBreak,true);assert.deepEqual(damage.origin,v(0,0,-4));assert.equal(s.player.hp,s.player.maxHp-7);
  s.setPaused(true);s.damagePlayer(20);assert.equal(s.drainEvents().filter(x=>x.type==='damage').length,0);
});

test('PvP impact feedback uses accepted server damage and does not announce a hit against an invulnerable target',()=>{
  const s=new Simulation();s.start();s.enemies=[];const e=s.spawn('rival',v(10,0,0));e.remoteId='pilot';s.drainEvents();
  s.pvpHit=()=>({damage:0,killed:false});s.damageEnemy(e,50);assert.equal(s.drainEvents().filter(x=>x.type==='hit').length,0);
  const hp=e.hp;s.pvpHit=()=>({damage:36,killed:false});s.damageEnemy(e,50);const hit=s.drainEvents().find(x=>x.type==='hit');assert.equal(hit.damage,36);assert.equal(hit.kind,'rival');assert.equal(e.hp,hp);assert.equal(s.kills,0);
});

test('all activity spectacles expire in bounded pools and movement never bridges a warp',()=>{const scene=new THREE.Scene(),fx=new Effects(scene),ship=new THREE.Group();for(const kind of ['arrival','departure','dock','service','invasion','conquest','dash','boost','evolve'])fx.spectacle(v(),kind,12);const count=fx.items.length;assert.ok(count>27&&count<=fx.maxItems);fx.flight(ship,.1);ship.position.x=5;fx.flight(ship,.1,{boost:true});assert.ok(fx.cursor>0);const cursor=fx.cursor;ship.position.x=120000;fx.flight(ship,.1,{boost:true});assert.equal(fx.cursor,cursor);fx.flight(ship,0,{boost:true});assert.equal(fx.cursor,cursor);for(let i=0;i<100;i++)fx.spectacle(v(),'invasion',18);assert.equal(fx.items.length,fx.maxItems);const camera=new THREE.PerspectiveCamera();fx.update(5,5,camera,720);assert.equal(fx.items.length,0);assert.ok(fx.alphas.every(a=>a===0));});
test('dock and departure activity cues follow successful transitions only',()=>{const s=new Simulation();s.start('galaxy');s.drainEvents();s.player.position=v(100,0,0);assert.equal(s.dockBase(),false);assert.equal(s.drainEvents().filter(e=>e.type==='dock').length,0);s.player.position=v();assert.ok(s.dockBase());assert.equal(s.drainEvents().filter(e=>e.type==='dock').length,1);assert.ok(s.leaveBase());assert.equal(s.drainEvents().filter(e=>e.type==='departure').length,1);assert.equal(s.leaveBase(),false);assert.equal(s.drainEvents().length,0);});
