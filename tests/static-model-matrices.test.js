import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cacheModelLocalMatrices,probeWorldMatrices,compareMatrixCache} from '../src/static-model-matrices.js';
import {AssetInstanceBatch} from '../src/asset-instance-batch.js';
import {notifyAssetBatchChanged} from '../src/asset-batch-events.js';

function rig(){
 const hull=new THREE.Group(),turret=new THREE.Group(),wrapper=new THREE.Group(),orientation=new THREE.Group(),model=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 hull.add(turret);turret.add(wrapper);wrapper.add(orientation);orientation.add(model);model.add(mesh);
 wrapper.position.set(2,3,4);wrapper.scale.setScalar(.7);orientation.rotation.y=-Math.PI/2;model.position.set(-2,.4,1);mesh.position.set(1,2,3);mesh.rotation.set(.2,.3,-.5);mesh.scale.set(1,2,3);mesh.userData.meshy=true;
 return {hull,turret,wrapper,orientation,model,mesh};
}
test('cached imported locals exactly follow animated hull/turret/mount parents and clones',()=>{
 const cached=rig(),reference=rig();assert.equal(cacheModelLocalMatrices(cached.orientation),3);assert.equal(cached.wrapper.matrixAutoUpdate,true);assert.equal(cached.turret.matrixAutoUpdate,true);
 let localCalls=0;const update=cached.mesh.updateMatrix;cached.mesh.updateMatrix=function(){localCalls++;return update.call(this);};
 for(let i=0;i<8;i++){
  for(const r of [cached,reference]){r.hull.position.set(i*5,i*2,-i);r.hull.rotation.set(i*.03,i*.2,i*.01);r.turret.rotation.set(i*.1,-i*.3,0);r.wrapper.rotation.z=i*.02;r.hull.updateMatrixWorld(true);}
  cached.mesh.matrixWorld.elements.forEach((n,k)=>assert.ok(Math.abs(n-reference.mesh.matrixWorld.elements[k])<1e-10));
 }
 assert.equal(localCalls,0);const clone=cached.wrapper.clone(true);clone.position.x=20;clone.updateMatrixWorld(true);const leaf=clone.children[0].children[0].children[0];assert.equal(leaf.matrixAutoUpdate,false);assert.ok(leaf.matrixWorld.elements.every(Number.isFinite));
 for(const r of [cached,reference]){r.mesh.geometry.dispose();r.mesh.material.dispose();}
});
test('rigged, morphed and animation-bearing assets retain automatic local updates',()=>{
 for(const type of ['animation','skin','bone','morph']){
  const root=new THREE.Group(),mesh=new THREE.Mesh();root.add(mesh);
  if(type==='skin')mesh.isSkinnedMesh=true;if(type==='bone')root.add(new THREE.Bone());if(type==='morph')mesh.morphTargetInfluences=[0];
  assert.equal(cacheModelLocalMatrices(root,{animated:type==='animation'}),0);assert.equal(root.matrixAutoUpdate,true);assert.equal(mesh.matrixAutoUpdate,true);
 }
});
test('cache respects existing manually authored matrices and world-update settings',()=>{
 const root=new THREE.Group(),manual=new THREE.Group();root.add(manual);manual.matrixAutoUpdate=false;manual.matrixWorldAutoUpdate=false;manual.matrix.makeTranslation(7,8,9);
 cacheModelLocalMatrices(root);assert.equal(manual.matrix.elements[12],7);assert.equal(manual.matrixWorldAutoUpdate,false);assert.equal(manual.userData.cachedModelLocal,undefined);
});
test('cached model batching preserves hidden parts, LOD geometry changes and shared resource ownership',()=>{
 const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial(),roots=[],parts=[];let disposed=0;geo.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<4;i++){const root=new THREE.Group(),internal=new THREE.Group(),mesh=new THREE.Mesh(geo,mat);root.add(internal);internal.add(mesh);root.position.x=i*10;internal.position.y=3;mesh.userData.meshy=true;cacheModelLocalMatrices(internal);scene.add(root);roots.push(root);parts.push(mesh);}
 const batch=new AssetInstanceBatch(scene);batch.update(0);roots[0].position.y=8;roots[1].visible=false;batch.update(10);assert.equal(batch.stats.instances,3);const g=parts[0].userData.assetInstanceGroup,matrix=new THREE.Matrix4();g.mesh.getMatrixAt(g.members.get(parts[0]).slot,matrix);assert.equal(matrix.elements[13],11);
 const lod=new THREE.SphereGeometry();parts[2].geometry=lod;notifyAssetBatchChanged(parts[2]);batch.update(20);assert.equal(parts[2].layers.mask,1);assert.equal(batch.stats.instances,2);assert.equal(parts[2].matrixAutoUpdate,false);batch.dispose();assert.equal(disposed,0);geo.dispose();mat.dispose();lod.dispose();
});
test('diagnostic split preserves native world transforms and restores prototype after a failure',()=>{
 const {hull,turret,mesh}=rig();hull.position.x=4;turret.rotation.y=.8;hull.updateMatrixWorld(true);const expected=mesh.matrixWorld.clone(),method=THREE.Object3D.prototype.updateMatrix;
 const result=probeWorldMatrices(hull);assert.ok(mesh.matrixWorld.equals(expected));assert.equal(result.nodes,6);assert.equal(result.automatic,6);assert.equal(THREE.Object3D.prototype.updateMatrix,method);assert.ok(result.localMs>=0&&result.worldMs>=0);
 const failing=new THREE.Group();failing.updateMatrixWorld=()=>{throw new Error('probe failure');};assert.throws(()=>probeWorldMatrices(failing),/probe failure/);assert.equal(THREE.Object3D.prototype.updateMatrix,method);mesh.geometry.dispose();mesh.material.dispose();
});
test('same-scene A/B diagnostic restores cached flags and preserves moving parents',()=>{
 const r=rig();cacheModelLocalMatrices(r.orientation);r.hull.position.y=8;r.hull.updateMatrixWorld(true);const expected=r.mesh.matrixWorld.clone();
 const result=compareMatrixCache(r.hull,4);assert.equal(result.cachedNodes,3);assert.equal(result.samples.length,4);
 for(const sample of result.samples){assert.equal(sample.uncached.automatic-sample.cached.automatic,3);assert.equal(sample.cached.cached,3);}
 assert.equal(r.orientation.matrixAutoUpdate,false);assert.equal(r.wrapper.matrixAutoUpdate,true);assert.ok(r.mesh.matrixWorld.equals(expected));r.mesh.geometry.dispose();r.mesh.material.dispose();
});
