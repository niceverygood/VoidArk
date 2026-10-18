import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ShipDetailLOD,setShipDetailSubview} from '../src/ship-detail-lod.js';
import {AssetInstanceBatch} from '../src/asset-instance-batch.js';
import {propagateVisibleMatrices} from '../src/hidden-world-matrices.js';
import {prepareModelLOD} from '../src/model-lod.js';
function rig(){
 const root=new THREE.Group(),mount=new THREE.Group();mount.name='meshy:hull';root.add(mount);
 const full=new THREE.SphereGeometry(4,60,40),low=new THREE.SphereGeometry(4,16,8),material=new THREE.MeshStandardMaterial();full.userData.combatLOD=low;
 const hull=new THREE.Mesh(full,material),detail=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),material);hull.userData.meshy=true;detail.position.x=3;mount.add(hull,detail);
 const effect=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial({transparent:true}));root.add(effect);
 const camera=new THREE.PerspectiveCamera(50,16/9,.1,2000);camera.position.z=200;camera.updateMatrixWorld();const lod=new ShipDetailLOD(root);lod.rebuild();
 return {root,mount,hull,detail,effect,camera,lod,dispose(){lod.dispose();full.dispose();low.dispose();detail.geometry.dispose();effect.geometry.dispose();material.dispose();effect.material.dispose();}};
}

test('an async asset replacement remains hidden when far LOD restores, rebuilds or disposes',()=>{
 const r=rig();r.lod.update(r.camera);assert.equal(r.detail.visible,false);
 // A real GLB finishes loading while its procedural substitute is hidden by LOD.
 r.detail.userData.assetReplaced=true;r.detail.visible=false;
 r.lod.restore();assert.equal(r.detail.visible,false);assert.equal(r.hull.visible,true);assert.equal(r.effect.visible,true);
 r.lod.rebuild();assert.equal(r.lod.entries.some(e=>e.mesh===r.detail),false);
 r.camera.position.z=20;r.camera.updateMatrixWorld();r.lod.update(r.camera);assert.equal(r.detail.visible,false);
 r.lod.dispose();assert.equal(r.detail.visible,false);r.dispose();
});
test('distance and projected size retain hull, effects and equipment; zoom restores original shared geometry',()=>{
 const r=rig();const before=r.root.toJSON();r.lod.update(r.camera);assert.equal(r.lod.level,'far');assert.equal(r.hull.geometry,r.hull.geometry.userData.combatLOD??r.lod.entries[0].geometry.userData.combatLOD);assert.equal(r.detail.visible,false);assert.equal(r.hull.visible,true);assert.equal(r.effect.visible,true);
 const reduced=r.hull.geometry;r.camera.zoom=5;r.camera.updateProjectionMatrix();r.lod.update(r.camera);assert.equal(r.lod.level,'near');assert.notEqual(r.hull.geometry,reduced);assert.equal(r.detail.visible,true);assert.deepEqual(r.root.position.toArray(),[0,0,0]);assert.equal(r.root.children.length,2);assert.equal(r.mount.children.length,2);assert.equal(before.object.uuid,r.root.uuid);r.dispose();
});
test('hysteresis bounds switches under distance/zoom jitter and close approaches restore detail',()=>{
 const r=rig();r.lod.update(r.camera);const original=r.lod.transitions;
 for(let i=0;i<100;i++){r.camera.position.z=120+(i%2?.3:-.3);r.camera.updateMatrixWorld();r.lod.update(r.camera);}
 assert.equal(r.lod.transitions,original);r.camera.position.z=45;r.camera.updateMatrixWorld();r.lod.update(r.camera);assert.equal(r.lod.level,'near');assert.equal(r.detail.visible,true);r.dispose();
});
test('subview close-up preserves its launch ship detail and release restores main-view LOD',()=>{
 const r=rig(),secondary=new THREE.PerspectiveCamera(48,16/9,.1,1000);secondary.position.z=15;secondary.updateMatrixWorld();
 try{setShipDetailSubview({camera:secondary,height:180});r.lod.update(r.camera);assert.equal(r.lod.level,'near');assert.equal(r.detail.visible,true);setShipDetailSubview(null);r.lod.update(r.camera);assert.equal(r.lod.level,'far');}finally{setShipDetailSubview(null);r.dispose();}
});
test('moving parents and LOD batch migration keep positions, one submission and cache ownership without double hierarchies',()=>{
 const scene=new THREE.Scene(),rows=Array.from({length:4},()=>rig()),shared=rows[0].hull.geometry,mat=rows[0].hull.material;
 for(const [i,r] of rows.entries()){r.hull.geometry=shared;r.hull.material=mat;r.root.position.x=i*5;scene.add(r.root);r.lod.rebuild();}
 const batch=new AssetInstanceBatch(scene);batch.update(0);let disposals=0;shared.addEventListener('dispose',()=>disposals++);
 for(let i=0;i<30;i++){for(const r of rows){r.root.position.y=i;r.lod.mode=i%2?'full':'adaptive';r.lod.update(r.camera);}batch.update(i*100);assert.equal(batch.audit().valid,true);propagateVisibleMatrices(scene);for(const r of rows){const expected=new THREE.Vector3();r.hull.getWorldPosition(expected);assert.equal(expected.y,i);assert.equal(r.root.children.length,2);}}
 const allocations=batch.allocations;for(let i=0;i<20;i++){rows.forEach(r=>r.lod.update(r.camera));batch.update(3000+i);}assert.equal(batch.allocations,allocations);assert.equal(disposals,0);rows.forEach(r=>{scene.remove(r.root);r.lod.dispose();});batch.update(4000);assert.equal(batch.candidates.size,0);batch.dispose();assert.equal(disposals,0);rows.forEach(r=>r.dispose());
});
test('cached far geometry reduces triangles, preserves bounds/attributes and is generated once per shared source',()=>{
 const g=new THREE.SphereGeometry(4,128,96);prepareModelLOD(g);const medium=g.userData.combatLOD,far=g.userData.distantLOD;
 assert.ok(medium&&far);assert.ok(far.index.count<medium.index.count*.8);assert.equal(far.boundingSphere.radius,g.boundingSphere.radius);assert.ok(far.attributes.normal&&far.attributes.uv);prepareModelLOD(g);assert.equal(g.userData.distantLOD,far);assert.equal(g.userData.combatLOD,medium);g.dispose();medium.dispose();far.dispose();
});
test('fully subpixel module branch defers matrix work and restores its moving mount on approach',()=>{
 const r=rig(),module=new THREE.Group(),part=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.08),r.hull.material);module.name='meshy:module-cannon';module.position.x=3;r.root.add(module);module.add(part);r.lod.rebuild();r.lod.update(r.camera);assert.equal(module.visible,false);
 const stats=propagateVisibleMatrices(r.root);assert.ok(stats.deferred>0);r.root.position.set(5,7,9);module.position.x=6;r.camera.position.z=35;r.camera.updateMatrixWorld();r.lod.update(r.camera);assert.equal(module.visible,true);propagateVisibleMatrices(r.root);const actual=new THREE.Vector3();part.getWorldPosition(actual);assert.deepEqual(actual.toArray(),[11,7,9]);r.lod.dispose();assert.equal(r.lod.branches.length,0);part.geometry.dispose();r.dispose();
});
