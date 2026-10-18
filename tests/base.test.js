import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {BASE_FACILITIES, cleanBase, constructionCost} from '../src/base-tech.js';
import * as THREE from 'three';
import {createBase,createShipSupport} from '../src/base.js';
import {createPlayer} from '../src/models.js';

test('base requires actual 3D proximity and freezes combat until undocking',()=>{
  const sim=new Simulation();sim.start();sim.player.position.y=19;
  assert.equal(sim.dockBase(),false);sim.player.position.y=0;
  sim.player.velocity.x=10;assert.equal(sim.dockBase(),true);
  assert.equal(sim.player.velocity.x,0);const time=sim.time;
  sim.step(.1,{forward:1});assert.equal(sim.time,time);
  assert.equal(sim.castSkill('pulse'),false);
  assert.equal(sim.leaveBase(),true);sim.step(.1,{});assert.ok(sim.time>time);
});

test('base repair and maintenance charge only valid services and restore real stats',()=>{
  const sim=new Simulation();sim.start();sim.dockBase();sim.scrap=50;
  assert.equal(sim.serviceBase('repair'),false);sim.player.hp-=40;
  assert.equal(sim.serviceBase('repair'),true);assert.equal(sim.scrap,44);assert.equal(sim.player.hp,sim.player.maxHp);
  sim.player.shield=0;assert.equal(sim.serviceBase('shield'),true);assert.equal(sim.player.shield,sim.player.maxShield);
  sim.player.boost=20;sim.skillTimers.pulse=8;assert.equal(sim.serviceBase('maintenance'),true);
  assert.equal(sim.player.boost,100);assert.equal(sim.skillTimers.pulse,0);
  sim.scrap=0;sim.player.hp=10;assert.equal(sim.serviceBase('repair'),false);assert.equal(sim.player.hp,10);
  assert.equal(sim.serviceBase('invalid'),false);sim.leaveBase();sim.scrap=100;assert.equal(sim.serviceBase('repair'),false);
});

test('base equipment installs immediately without consuming XP choices or duplicating scrap',()=>{
  const sim=new Simulation();sim.start();sim.dockBase();sim.scrap=100;
  assert.equal(sim.serviceBase('fighter'),true);assert.equal(sim.upgrades.fighter,1);assert.equal(sim.allies.length,2);assert.equal(sim.scrap,90);
  assert.equal(sim.serviceBase('armor'),true);assert.equal(sim.player.maxHp,155);assert.equal(sim.level,1);assert.equal(sim.phase,'base');
  sim.upgrades.cannon=5;const balance=sim.scrap;assert.equal(sim.serviceBase('cannon'),false);assert.equal(sim.scrap,balance);
  sim.leaveBase();sim.finish(true);assert.equal(sim.result.banked,balance+120);
});

test('permanent construction enforces prerequisites, atomic payment, ranks and saved limits',()=>{
  const s=new Simulation();s.start();s.dockBase();s.scrap=12;s.meta.bank=50;
  assert.equal(s.constructBase('arsenal'),false);assert.equal(s.scrap,12);
  assert.equal(s.constructBase('command'),true);assert.equal(s.scrap,0);assert.equal(s.meta.bank,42);
  assert.equal(s.constructBase('drydock'),true);assert.equal(s.meta.bank,17);
  assert.equal(s.constructBase('drydock'),false);assert.equal(s.meta.bank,17);
  s.meta.bank=10000;
  for(const id of ['command','command','drydock','drydock'])assert.equal(s.constructBase(id),true);
  const before=s.meta.bank;assert.equal(s.constructBase('command'),false);assert.equal(s.meta.bank,before);
  assert.equal(cleanBase({command:Infinity,drive:99,recycler:-1}).command,0);
  assert.equal(cleanBase({drive:99}).drive,3);
  const restored=new Simulation(JSON.parse(JSON.stringify(s.meta)));restored.start();
  assert.equal(restored.player.maxHp,s.player.maxHp);assert.equal(restored.meta.base.drydock,3);
});

test('all eight facilities immediately support ships, economy and next sorties',()=>{
  const s=new Simulation();s.start();s.dockBase();s.meta.bank=10000;
  for(const d of BASE_FACILITIES)assert.equal(s.constructBase(d.id),true,d.id);
  assert.equal(s.player.maxHp,140);assert.equal(s.player.maxShield,70);assert.equal(s.allies.length,1);
  assert.equal(s.power(),1.08);assert.equal(s.cooldownFactor(),.95);assert.equal(s.equipmentCost('cannon'),23);
  assert.equal(s.infrastructure.dockRange,22);assert.equal(s.infrastructure.magnet,3);
  const restored=new Simulation(s.meta);restored.start();assert.equal(restored.infrastructure.speed,.05);assert.equal(restored.player.maxHp,140);
  assert.ok(constructionCost(s.meta.base,'command')<80);
});

test('each facility visibly adds structures to both base and ship at every rank',()=>{
  const scene=new THREE.Scene(),base=createBase(scene,{x:0,y:0,z:0});
  const count=g=>{let n=0;g.traverse(o=>{if(o.isMesh)n+=o.geometry.attributes.position.count;});return n;};
  for(const d of BASE_FACILITIES){let previous=0;for(const rank of [1,2,3]){
    base.update(0,{[d.id]:rank});const ship=createPlayer(0);createShipSupport(ship,{[d.id]:rank});
    const vertices=count(ship.userData.baseSupport);assert.ok(vertices>previous);previous=vertices;
    assert.ok(count(base.root)>vertices);ship.userData.dispose();
  }}
});
