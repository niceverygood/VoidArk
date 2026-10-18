import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation,v} from '../src/sim.js';
import {TREE_BRANCHES,treePurchase} from '../src/skill-tree.js';
import {createPlayer} from '../src/models.js';
import {constructionCost} from '../src/base-tech.js';
import {PLANETS} from '../src/galaxy.js';

test('all six new forks require both side technologies before finisher and preserve payment on rejection',()=>{
  for(const b of TREE_BRANCHES.filter(b=>b.fork)){
    const meta={bank:100000,tree:{}};
    for(const i of [0,1,2])assert.equal(treePurchase(meta,b.nodes[i][0]),true);
    const bank=meta.bank;assert.equal(treePurchase(meta,b.nodes[4][0]),false);assert.equal(meta.bank,bank);
    assert.equal(treePurchase(meta,b.nodes[3][0]),true);assert.equal(treePurchase(meta,b.nodes[4][0]),true);
  }
});

test('lance is locked until research and pierces aligned 3D targets without hitting side or high targets',()=>{
  const locked=new Simulation();locked.start();assert.equal(locked.castSkill('lance'),false);
  const s=new Simulation({tree:{lance:2}});s.start();s.enemies=[];
  const front=s.spawn('carrier',v(0,0,-30)),far=s.spawn('carrier',v(0,0,-80)),side=s.spawn('carrier',v(20,0,-40)),high=s.spawn('carrier',v(0,25,-40)),behind=s.spawn('carrier',v(0,0,20));
  assert.equal(s.castSkill('lance'),true);assert.ok(front.hp<=0&&far.hp<=0);for(const e of [side,high,behind])assert.equal(e.hp,e.maxHp);
  assert.equal(s.castSkill('lance'),false);assert.equal(s.skillTimers.lance,22);
  assert.ok(s.drainEvents().some(e=>e.type==='beam'&&e.to.z===-120));
});

test('countermeasure clears nearby hostile projectiles and locks while retaining friendly and distant shots',()=>{
  const s=new Simulation({tree:{countermeasure:1}});s.start();s.enemies=[];
  const near=s.spawn('interceptor',v(10,0,0));near.tailLock=1.2;
  const a=s.shot(v(10,0,0),null,10,'enemyMissile',false),b=s.shot(v(0,80,0),null,10,'enemyMissile',false),c=s.shot(v(10,0,0),near,10,'cannon');
  assert.equal(s.castSkill('countermeasure'),true);assert.equal(near.tailLock,0);assert.ok(!s.shots.includes(a));assert.ok(s.shots.includes(b)&&s.shots.includes(c));
  s.setPaused(true);s.skillTimers.countermeasure=0;assert.equal(s.castSkill('countermeasure'),false);
});

test('temporary escort sortie has researched count, actual shots and expiry without deleting permanent escorts',()=>{
  const s=new Simulation({tree:{sentry:3,extraEscort:1}});s.start();s.enemies=[];
  const e=s.spawn('carrier',v(15,0,0));assert.equal(s.castSkill('sentry'),true);assert.equal(s.allies.length,7);
  s.updateAllies(.05);assert.ok(s.shots.some(shot=>shot.type==='fighter'&&shot.target===e.id));
  s.time=12.1;s.syncAllies();assert.equal(s.allies.length,1);assert.ok(!s.allies[0].expires);
});

test('new offense, salvage sustain, economy, repair and evasive research affect real behavior',()=>{
  const s=new Simulation({tree:{bossPower:2,critChance:3,critPower:2,shieldOnKill:2,hullOnKill:2,repair:1,repairPower:2,evadeCooldown:2,evadeDuration:2,evadeSpeed:2,warpHaste:2,equipmentDiscount:2,constructionDiscount:2}});s.start('galaxy');s.enemies=[];
  s.random=()=>0;const base=s.spawn('planetBase',v(10,0,0));base.armor='neutral';const hp=base.hp;s.damageEnemy(base,10);assert.ok(Math.abs(hp-base.hp-10*1.12*1.8)<1e-8);
  s.player.hp=10;s.player.shield=0;const e=s.spawn('swarm',v(10,0,0));s.damageEnemy(e,100);assert.equal(s.player.hp,12);assert.equal(s.player.shield,2);
  s.castSkill('repair');assert.equal(s.player.hp,78);assert.equal(s.player.shield,55);
  assert.equal(s.evade({y:1}),true);assert.equal(s.evadeDuration,.72);assert.equal(s.evadeCooldown,s.vessel.evadeCooldown*.88);
  s.step(.05,{});assert.equal(s.player.velocity.y,50);
  assert.equal(s.equipmentCost('cannon'),24);s.phase='base';s.scrap=10000;const old=s.scrap;assert.equal(s.constructBase('command'),true);assert.equal(old-s.scrap,Math.ceil(constructionCost({},'command')*.94));
  s.phase='galaxyMap';s.enemies=[];assert.equal(s.warpPlanet('home'),true);assert.equal(s.warpCooldown,16);
});

test('legacy shipyard research also installs and grows actual geometry, independently of tree choices',()=>{
  for(const id of ['hull','reactor','salvage'])for(const stage of [0,1,2]){
    let previous=0;
    for(const rank of [1,2,3,4,5]){
      const ship=createPlayer(stage,{cannon:1},{},{},'ark',{[id]:rank});const module=ship.userData.techModules.find(m=>m.id==='research-'+id);
      assert.ok(module);const size=new THREE.Box3().setFromObject(module.object).getSize(new THREE.Vector3());assert.ok(size.length()>previous);previous=size.length();ship.userData.dispose();
    }
  }
});

test('range and blast research reach real targets and logistics increases owned planet production',()=>{
  for(const researched of [false,true]){
    const s=new Simulation({tree:researched?{cannonRange:3,missileRadius:2}: {}});s.start();s.enemies=[];
    const target=s.spawn('carrier',v(0,0,-99));s.updateWeapons(.05);assert.equal(s.shots.length>0,researched);
    s.shots=[];s.enemies=[];const hit=s.spawn('carrier',v(0,0,-10)),splash=s.spawn('carrier',v(0,10,-10));
    s.shot(hit.position,hit,20,'missile');s.updateShots(0);assert.equal(splash.hp<splash.maxHp,researched);
  }
  const p=PLANETS[0],s=new Simulation({tree:{income:3},conquestVersion:2,conquest:{[p.id]:Array.from({length:p.baseCount},(_,i)=>i).concat('warden','crown')}});s.start('galaxy');s.incomeTimer=0;s.updateGalaxy(.05);assert.equal(s.meta.bank,Math.ceil(p.level*2*1.24));
});
