import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shipGrowth} from '../src/ship-growth.js';
import {createPlayer} from '../src/models.js';
import {UPGRADE_DEFS} from '../src/sim.js';
import {TREE_NODES} from '../src/skill-tree.js';
import {BASE_FACILITIES} from '../src/base-tech.js';
test('each equipment, technology and base rank increases all physical hull dimensions',()=>{
  const baseline=shipGrowth({cannon:1});
  for(const d of UPGRADE_DEFS)for(let rank=d.id==='cannon'?2:1;rank<=d.maxLevel;rank++){
    const a=shipGrowth({cannon:1,[d.id]:rank-1}),b=shipGrowth({cannon:1,[d.id]:rank});
    assert.ok(b.scale.x>a.scale.x&&b.scale.y>a.scale.y&&b.scale.z>a.scale.z);
  }
  for(const d of TREE_NODES)for(const rank of [1,2,3])assert.ok(shipGrowth({}, {[d.id]:rank}).scale.z>shipGrowth({}, {[d.id]:rank-1}).scale.z);
  for(const d of BASE_FACILITIES)assert.ok(shipGrowth({}, {},{[d.id]:1}).scale.x>baseline.scale.x);
  assert.equal(shipGrowth({cannon:Infinity}, {},{command:Infinity}).score,0);
});
test('maximum growth creates a capital expansion and a hull several times larger, without polluting scout cache',()=>{
  const upgrades=Object.fromEntries(UPGRADE_DEFS.map(d=>[d.id,d.maxLevel])),tree=Object.fromEntries(TREE_NODES.map(d=>[d.id,3])),base=Object.fromEntries(BASE_FACILITIES.map(d=>[d.id,3]));
  const small=createPlayer(2),large=createPlayer(2,upgrades,tree,base);
  const size=g=>new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  const a=size(small),b=size(large);assert.ok(b.x>a.x*3&&b.z>a.z*3&&b.y>a.y*3);
  assert.equal(large.userData.growth.tier,6);assert.ok(large.userData.capitalExpansion);assert.ok(large.userData.turrets.length>small.userData.turrets.length);
  small.userData.dispose();large.userData.dispose();assert.equal(createPlayer(0).userData.growth.score,0);
});
