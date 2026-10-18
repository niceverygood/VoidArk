import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AssetInstanceBatch} from '../src/asset-instance-batch.js';
import {AssetInstanceBatch as OriginalBatch} from '../work/dense-optimization-20261017-batch-leaf-visibility-oracle.js';
import {notifyAssetBatchAttached} from '../src/asset-batch-events.js';

function rig(Batch){
 const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),parents=[],parts=[];
 for(const x of [-2,28]){
  const parent=new THREE.Group();parent.position.set(x,0,-10);scene.add(parent);parents.push(parent);
  for(let i=0;i<3;i++){const mesh=new THREE.Mesh(geometry,material);mesh.userData.meshy=true;mesh.userData.fixtureId=parts.length;mesh.position.x=i*2;parent.add(mesh);parts.push(mesh);}
 }
 const primary=new THREE.PerspectiveCamera(60,1,.1,100),secondary=primary.clone();secondary.position.x=30;
 const batch=new Batch(scene);batch.update(0,primary);
 return {scene,geometry,material,parents,parts,primary,secondary,batch,dispose(){batch.dispose();geometry.dispose();material.dispose();}};
}
function paired(){
 const before=rig(OriginalBatch),after=rig(AssetInstanceBatch);
 const each=fn=>{fn(before);fn(after);};
 const equal=()=>{
  const a=[...after.batch.groups.values()],b=[...before.batch.groups.values()];assert.equal(a.length,b.length);
  for(let i=0;i<a.length;i++){
   assert.equal(a[i].mesh.count,b[i].mesh.count);assert.deepEqual(a[i].mesh.instanceMatrix.array,b[i].mesh.instanceMatrix.array);assert.deepEqual(a[i].mesh.instanceMatrix.updateRanges,b[i].mesh.instanceMatrix.updateRanges);assert.equal(a[i].mesh.instanceMatrix.version,b[i].mesh.instanceMatrix.version);
   assert.deepEqual(a[i].visible.map(e=>e.object.userData.fixtureId),b[i].visible.map(e=>e.object.userData.fixtureId));
   assert.deepEqual([...a[i].members.values()].map(e=>[e.object.userData.fixtureId,e.slot]),[...b[i].members.values()].map(e=>[e.object.userData.fixtureId,e.slot]));
  }
  for(const key of ['instances','uploads','cullTested','culled','allocations','grows'])assert.equal(after.batch.stats[key],before.batch.stats[key]);
  after.parts.forEach((mesh,i)=>{assert.equal(mesh.visible,before.parts[i].visible);assert.equal(mesh.layers.mask,before.parts[i].layers.mask);assert.deepEqual(mesh.matrixWorld.elements,before.parts[i].matrixWorld.elements);assert.equal(mesh.geometry,after.geometry);assert.equal(mesh.material,after.material);});
  assert(after.batch.audit().valid);assert(before.batch.audit().valid);
 };
 return {before,after,each,equal,select(name='primary'){each(r=>r.batch.selectCamera(r[name]));equal();},dispose(){before.dispose();after.dispose();}};
}

test('leaf and shared-parent visibility changes are immediate across camera/layer selections',()=>{
 const p=paired();try{
  p.equal();assert.equal(p.after.batch.stats.instances,3);
  p.each(r=>{r.parts[0].visible=false;});p.select();assert.equal(p.after.batch.stats.instances,2);
  p.each(r=>{r.parents[0].visible=false;});p.select();assert.equal(p.after.batch.stats.instances,0);
  p.each(r=>{r.parents[0].visible=true;r.parts[0].visible=true;r.parents[0].layers.set(2);});p.select();assert.equal(p.after.batch.stats.instances,3); // Parent layers do not hide layer-zero children.
  p.select('secondary');assert.equal(p.after.batch.stats.instances,3);assert.deepEqual([...p.after.batch.groups.values()][0].visible.map(e=>e.object.userData.fixtureId).sort(),[3,4,5]);
  p.each(r=>{r.parts[4].visible=false;});p.select('secondary');assert.equal(p.after.batch.stats.instances,2);
  p.select();assert.equal(p.after.batch.stats.instances,3);
  p.each(r=>{r.primary.layers.set(2);});p.select();assert.equal(p.after.batch.stats.instances,0);
  p.each(r=>{r.primary.layers.set(0);r.scene.visible=false;});p.select();assert.equal(p.after.batch.stats.instances,0);
  p.each(r=>{r.scene.visible=true;});p.select();assert.equal(p.after.batch.stats.instances,3);
 }finally{p.dispose();}
});

test('a cached terminal member can gain a nested member, hide/reparent it, then become terminal again',()=>{
 const p=paired();try{
  p.each(r=>{const child=new THREE.Mesh(r.geometry,r.material);child.userData.meshy=true;child.userData.fixtureId=6;child.position.set(0,1,0);r.parts[0].add(child);r.parts.push(child);notifyAssetBatchAttached(child);r.batch.update(1,r.primary);});p.equal();assert.equal(p.after.batch.stats.instances,4);
  p.each(r=>{r.parts[0].visible=false;});p.select();assert.equal(p.after.batch.stats.instances,2);
  p.each(r=>{r.parts[0].visible=true;r.parts[6].visible=false;});p.select();assert.equal(p.after.batch.stats.instances,3);
  p.each(r=>{r.parts[6].visible=true;r.parents[1].add(r.parts[6]);notifyAssetBatchAttached(r.parts[6]);r.batch.update(2,r.primary);});p.equal();assert.equal(p.after.parts[0].children.length,0);assert.equal(p.after.batch.stats.instances,3);
  p.select('secondary');assert.equal(p.after.batch.stats.instances,4);p.select();assert.equal(p.after.batch.stats.instances,3);
  p.each(r=>{r.parts[6].removeFromParent();r.batch.update(3,r.primary);});p.equal();assert.equal(p.after.parts[6].layers.mask,1);assert(!p.after.batch.candidates.has(p.after.parts[6]));
  p.each(r=>{r.parts[0].visible=false;});p.select();assert.equal(p.after.batch.stats.instances,2);
  let sourceDisposals=0;p.after.geometry.addEventListener('dispose',()=>sourceDisposals++);p.after.material.addEventListener('dispose',()=>sourceDisposals++);p.after.batch.dispose();assert.equal(sourceDisposals,0);assert(p.after.parts.every(mesh=>mesh.layers.mask===1));
 }finally{p.dispose();}
});
