import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {assetYaw} from '../src/asset-orientation.js';

test('six verified wide hulls retain their authored -X bows regardless of misleading real GLB bounds',()=>{
  for(const ship of ['bastion','swift','raptor','seraph','chronos','foundry']) {
    const data=fs.readFileSync(new URL(`../public/assets/meshy/vessel-${ship}.glb`,import.meta.url));
    const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
    const bounds=json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    const extent=Object.freeze({x:bounds.max[0]-bounds.min[0],y:bounds.max[1]-bounds.min[1],z:bounds.max[2]-bounds.min[2]});
    const before=JSON.stringify(extent);
    assert.equal(extent.x>extent.z*1.05,false,ship);if(ship==='bastion')assert.ok(extent.x<extent.z);
    const yaw=assetYaw(`vessel-${ship}`,extent),bow=new THREE.Vector3(-1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    assert.equal(yaw,-Math.PI/2,ship);assert.ok(Math.abs(bow.x)<1e-12,ship);assert.equal(bow.y,0);assert.ok(Math.abs(bow.z+1)<1e-12,ship);
    assert.equal(JSON.stringify(extent),before);
  }
});

test('other vessels and existing horizontal modules retain the same automatic normalization',()=>{
  for(const id of ['vessel-ark','vessel-hammer','vessel-sovereign','vessel-unknown','module-engine','guided-missile','module-cannon','module-laser','module-missile','rail-turret','interceptor-turret']) {
    assert.equal(assetYaw(id,{x:2,z:1}),-Math.PI/2,id);
    assert.equal(assetYaw(id,{x:1,z:2}),0,id);
    assert.equal(assetYaw(id,{x:1,z:1}),0,id);
  }
});

test('the five-percent long-axis threshold stays strict for automatic hulls and turrets',()=>{
  for(const id of ['vessel-ark','nation-a-carrier','enemy-mars-capital','rail-turret']) {
    assert.equal(assetYaw(id,{x:1.05,z:1}),0,id);
    assert.equal(assetYaw(id,{x:1.050001,z:1}),-Math.PI/2,id);
    assert.equal(assetYaw(id,{x:1.049999,z:1}),0,id);
  }
});

test('national and planetary hull patterns keep their existing suffix and prefix scope',()=>{
  for(const id of ['nation-a-scout','nation-ab-cruiser','nation-a-carrier','prefix-nation-a-scout','enemy-mars-fighter','enemy-mars-capital'])assert.equal(assetYaw(id,{x:2,z:1}),-Math.PI/2,id);
  for(const id of ['nation-a-scout-extra','enemy-mars-capital-extra','prefix-enemy-mars-fighter','enemy-mars-fortress','enemy-mars-boss','orbital-dock','module-shield','module-reactor','unknown'])assert.equal(assetYaw(id,{x:2,z:1}),0,id);
});

test('orientation selection leaves caller-owned bounds unchanged',()=>{
  const extent=Object.freeze({x:2,y:.5,z:1});
  assert.equal(assetYaw('vessel-ark',extent),-Math.PI/2);assert.deepEqual(extent,{x:2,y:.5,z:1});
  assert.equal(assetYaw(null,extent),0);assert.equal(assetYaw('vessel-ark',undefined),0);
});
