import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {SHIPS,SHIP_FAMILIES,shipStats} from '../src/ships.js';import {Simulation,cleanMeta} from '../src/sim.js';import {createPlayer} from '../src/models.js';
test('24 selectable ships have six families, valid saves and real starting attributes',()=>{
 assert.equal(SHIPS.length,24);assert.equal(new Set(SHIPS.map(s=>s.id)).size,24);assert.equal(SHIP_FAMILIES.length,6);
 for(const def of SHIPS){const s=new Simulation({ship:def.id});s.start('galaxy');assert.equal(s.player.maxHp,def.hull);assert.equal(s.player.maxShield,def.shield);assert.equal(s.upgrades[def.weapon],1);assert.equal(s.snapshot().vessel.id,def.id);assert.equal(s.allies.length,(def.weapon==='fighter'?2:0)+(def.perks.escorts||0));}
 assert.equal(cleanMeta({ship:'invalid'}).ship,'ark');assert.equal(new Simulation().vessel.id,'ark');
});
test('specialty weapon power, boss bonus, mobility and evasion have meaningful tradeoffs',()=>{
 const heavy=new Simulation({ship:'dread'}),swift=new Simulation({ship:'swift'}),base=new Simulation();for(const s of [heavy,swift,base]){s.start();s.enemies=[];s.spawnTimer=999;for(let i=0;i<20;i++)s.step(.05,{x:1});}
 assert.ok(swift.player.position.x>base.player.position.x&&base.player.position.x>heavy.player.position.x);
 const target=heavy.spawn('boss',{x:100,y:20,z:100});const shot=heavy.shot(heavy.player.position,target,100);assert.equal(shot.damage,160);target.armor='neutral';const hp=target.hp;heavy.damageEnemy(target,100,'pulse');assert.ok(Math.abs(hp-target.hp-130)<1e-6);
 assert.ok(swift.evade());assert.equal(swift.player.boost,85);assert.equal(swift.evadeCooldown,5);assert.ok(heavy.evade());assert.equal(heavy.player.boost,65);
});
test('support and scientific traits affect collection, sustain, cooldown and pulse area',()=>{
 const collect=new Simulation({ship:'mule'});collect.start();collect.enemies=[];collect.pickups=[{id:999,position:{x:28,y:0,z:0},xp:1,scrap:5,life:100}];for(let i=0;i<60;i++)collect.updatePickups(.05);assert.equal(collect.pickups.length,0);
 const heal=new Simulation({ship:'phoenix'});heal.start();heal.enemies=[];heal.spawnTimer=999;heal.player.hp=50;heal.time=10;heal.step(.05,{});assert.ok(heal.player.hp>50);
 const laser=new Simulation({ship:'lance'});laser.start();const target=laser.spawn('boss',{x:100,y:0,z:100});target.armor='neutral';const before=target.hp;laser.damageEnemy(target,100,'laser');assert.ok(Math.abs(before-target.hp-170)<1e-6);
 const c=new Simulation({ship:'chronos'});assert.equal(c.cooldownFactor(),.7);
 const area=new Simulation({ship:'singularity'});area.start();area.enemies=[];const enemy=area.spawn('swarm',{x:33,y:0,z:0});area.castSkill('pulse');assert.ok(enemy.hp<=0);
});
test('all 24 actual 3D frames render through three growth stages without shared cache leakage',()=>{
 for(const def of SHIPS)for(let stage=0;stage<3;stage++){const model=createPlayer(stage,{cannon:1}, {}, {},def.id);assert.equal(model.userData.vessel.id,def.id);assert.ok(new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).length()>0);model.traverse(o=>{if(o.isMesh){assert.ok(o.material);assert.ok(o.geometry);}});if(def.id!=='ark')assert.ok(model.userData.shipFrame);}
 const baseline=createPlayer(0);assert.equal(baseline.userData.shipFrame,undefined);assert.equal(baseline.userData.vessel.id,'ark');
});
