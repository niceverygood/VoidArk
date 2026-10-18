import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {anchorPlanetHullCore} from '../src/planet-hull-core.js';
test('planet hull core contacts transformed surface and reuses asset-local anchors',()=>{
 const geometry=new THREE.BoxGeometry(4,1,4),material=new THREE.MeshStandardMaterial();let disposals=0;geometry.addEventListener('dispose',()=>disposals++);
 const make=scale=>{const root=new THREE.Group(),frame=new THREE.Group(),mount=new THREE.Group(),core=new THREE.Object3D();root.add(frame);frame.add(mount,core);frame.scale.setScalar(scale);root.position.set(15,-3,8);root.rotation.set(.3,.7,.2);mount.position.y=1;mount.add(new THREE.Mesh(geometry,material));core.position.set(0,.6,-.5);root.userData={visualRoot:frame,core,planetTheme:'mars',planetAssetId:'enemy-mars-capital'};return {root,frame,mount,core};};
 const first=make(2);anchorPlanetHullCore(first.root,first.mount);assert.ok(Math.abs(first.core.position.y-1.58)<1e-6);assert.equal(first.core.parent,first.frame);assert.equal(first.root.userData.planetHullCore.raycasts,1);
 const second=make(4);second.frame.updateWorldMatrix=()=>{throw Error('cached anchor must skip traversal');};anchorPlanetHullCore(second.root,second.mount);assert.deepEqual(second.core.position.toArray(),first.core.position.toArray());assert.equal(second.root.userData.planetHullCore.cacheHit,true);assert.equal(second.root.userData.planetHullCore.raycasts,0);assert.equal(disposals,0);geometry.dispose();material.dispose();
});
test('missing planetary hull contact leaves procedural core position intact',()=>{
 const root=new THREE.Group(),mount=new THREE.Group(),core=new THREE.Object3D();root.add(mount,core);core.position.set(0,.6,-.5);root.userData={visualRoot:root,core};anchorPlanetHullCore(root,mount);assert.deepEqual(core.position.toArray(),[0,.6,-.5]);assert.equal(root.userData.planetHullCore,undefined);
});
