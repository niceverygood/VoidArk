import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayer, animateShip } from '../src/models.js';
import { UPGRADE_DEFS } from '../src/sim.js';
import { TREE_NODES } from '../src/skill-tree.js';

test('vertical flight pitches the actual bow up and down, freezes and returns to level',()=>{
  const ship=createPlayer(0),visual=ship.userData.visualRoot;
  for(let i=0;i<60;i++)animateShip(ship,i/60,{verticalSpeed:10,horizontalSpeed:0,dt:1/60});
  const bow=new THREE.Vector3(0,0,-1).applyEuler(visual.rotation);
  assert.ok(bow.y>.5);assert.ok(visual.rotation.x<=.58);
  const paused=visual.rotation.x;animateShip(ship,2,{verticalSpeed:-10,dt:0});assert.equal(visual.rotation.x,paused);
  for(let i=0;i<60;i++)animateShip(ship,2+i/60,{verticalSpeed:-10,dt:1/60});
  assert.ok(new THREE.Vector3(0,0,-1).applyEuler(visual.rotation).y<-.5);
  for(let i=0;i<90;i++)animateShip(ship,3+i/60,{verticalSpeed:0,dt:1/60});
  assert.ok(Math.abs(visual.rotation.x)<.001);ship.userData.dispose();
});

test('every learned upgrade installs actual geometry through all hull evolutions',()=>{
  for(const stage of [0,1,2])for(const def of UPGRADE_DEFS){
    const level=def.id==='cannon'?2:1;
    const ship=createPlayer(stage,{[def.id]:level});
    const installed=ship.userData.modules.find(m=>m.id===def.id);
    assert.ok(installed,`${stage}: ${def.id} must be installed`);
    let vertices=0;installed.object.traverse(o=>{if(o.isMesh)vertices+=o.geometry.attributes.position.count;});
    assert.ok(vertices>0);
    ship.userData.dispose();
  }
});

test('reinforcement changes module geometry and cached hulls do not inherit another loadout',()=>{
  for(const def of UPGRADE_DEFS){
    const first=createPlayer(0,{[def.id]:def.id==='cannon'?2:1});
    const last=createPlayer(0,{[def.id]:def.maxLevel});
    const a=new THREE.Box3().setFromObject(first.userData.modules[0].object).getSize(new THREE.Vector3());
    const b=new THREE.Box3().setFromObject(last.userData.modules[0].object).getSize(new THREE.Vector3());
    assert.ok(a.distanceTo(b)>.01,`${def.id} must visibly grow`);
    first.userData.dispose();last.userData.dispose();
  }
  const empty=createPlayer(0,{cannon:1});
  assert.equal(empty.userData.modules.length,0);
  assert.equal(empty.userData.turrets.length,2);
  empty.userData.dispose();
});

test('all 60 technologies install real modules and visibly grow at every rank on every hull',()=>{
  for(const node of TREE_NODES)for(const stage of [0,1,2]){
    let previous=null;
    for(const rank of [1,2,3]){
      const ship=createPlayer(stage,{cannon:1},{[node.id]:rank});
      const module=ship.userData.techModules[0];
      assert.equal(module.id,node.id);assert.equal(module.rank,rank);
      let vertices=0;module.object.traverse(o=>{if(o.isMesh)vertices+=o.geometry.attributes.position.count;});
      assert.ok(vertices>0);
      const size=new THREE.Box3().setFromObject(module.object).getSize(new THREE.Vector3());
      if(previous)assert.ok(previous.distanceTo(size)>.01,`${node.id} rank ${rank} should grow`);
      previous=size;ship.userData.dispose();
    }
  }
  const full=createPlayer(2,{cannon:5,chain:5,missile:5,laser:5,fighter:4},Object.fromEntries(TREE_NODES.map(n=>[n.id,3])));
  assert.equal(full.userData.techModules.length,60);
  full.userData.dispose();
  assert.equal(createPlayer(2).userData.techModules.length,0);
});
