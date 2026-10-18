import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AssetInstanceBatch} from '../src/asset-instance-batch.js';
import {notifyAssetBatchAttached,notifyAssetBatchRemoved,notifyAssetBatchChanged} from '../src/asset-batch-events.js';
test('GLB instances preserve world transforms, hidden parent, LOD switch and cache ownership',()=>{
 const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),parts=[],parents=[];
 let geometryDisposed=0;geo.addEventListener('dispose',()=>geometryDisposed++);
 for(let i=0;i<4;i++){const parent=new THREE.Group();parent.position.set(i*7,2,-3);parent.rotation.y=.3;scene.add(parent);const mesh=new THREE.Mesh(geo,material);mesh.position.x=1;mesh.userData.meshy=true;parent.add(mesh);parts.push(mesh);parents.push(parent);}
 const batch=new AssetInstanceBatch(scene);batch.update(0);assert.equal(batch.stats.savedCalls,3);const group=[...batch.groups.values()][0],matrix=new THREE.Matrix4();group.mesh.getMatrixAt(2,matrix);assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(parts[2].getWorldPosition(new THREE.Vector3()))<1e-5);
 parents[0].visible=false;batch.update(10);assert.equal(group.mesh.count,3);
 scene.remove(parents[1]);batch.update(20);assert.equal(group.mesh.count,2);
 parts[2].geometry=new THREE.SphereGeometry();notifyAssetBatchChanged(parts[2]);batch.update(30);assert.equal(parts[2].layers.mask,1);assert.equal(batch.groups.size,1);assert.equal(group.mesh.count,1);assert.equal(batch.stats.allocations,1);
 batch.dispose();assert.equal(parts[0].layers.mask,1);assert.equal(geometryDisposed,0);geo.dispose();material.dispose();parts[2].geometry.dispose();
});
test('spawn and death reuse buffers, preserve unaffected slots, and upload changed transforms only',()=>{
 const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial(),parts=[];
 const add=x=>{const mesh=new THREE.Mesh(geo,mat);mesh.userData.meshy=true;mesh.position.x=x;scene.add(mesh);parts.push(mesh);return mesh;};
 add(1);add(2);add(3);const batch=new AssetInstanceBatch(scene);batch.update(0);const group=[...batch.groups.values()][0],buffer=group.mesh,entry=group.members.get(parts[0]);
 batch.update(10);assert.equal(batch.stats.uploads,0);assert.equal(buffer.instanceMatrix.updateRanges.length,0);
 const added=add(4);batch.update(500);assert.equal(group.mesh,buffer);assert.equal(entry.slot,0);assert.equal(batch.stats.allocations,1);assert.equal(batch.stats.uploads,1);
 scene.remove(parts[1]);batch.update(1000);assert.equal(group.mesh,buffer);assert.equal(entry.slot,0);assert.equal(group.members.has(parts[1]),false);assert.equal(parts[1].layers.mask,1);assert.equal(buffer.count,3);assert.equal(batch.stats.uploads,1);
 added.position.z=7;batch.update(1010);assert.equal(batch.stats.uploads,1);const matrix=new THREE.Matrix4();buffer.getMatrixAt(group.members.get(added).slot,matrix);assert.equal(matrix.elements[14],7);
 batch.dispose();geo.dispose();mat.dispose();
});
test('pool capacity grows only when exhausted, retains matrices, and retires idle groups',()=>{
 const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial(),parts=[];
 for(let i=0;i<3;i++){const o=new THREE.Mesh(geo,mat);o.userData.meshy=true;o.position.x=i;scene.add(o);parts.push(o);}
 const batch=new AssetInstanceBatch(scene);batch.update(0);const group=[...batch.groups.values()][0],initial=group.mesh;let bufferDisposals=0,materialDisposals=0,geometryDisposals=0;initial.addEventListener('dispose',()=>bufferDisposals++);group.material.addEventListener('dispose',()=>materialDisposals++);geo.addEventListener('dispose',()=>geometryDisposals++);
 for(let i=3;i<9;i++){const o=new THREE.Mesh(geo,mat);o.userData.meshy=true;o.position.x=i;scene.add(o);parts.push(o);}batch.update(500);
 assert.equal(group.capacity,16);assert.equal(batch.stats.grows,1);assert.equal(bufferDisposals,1);assert.equal(materialDisposals,0);assert.equal(geometryDisposals,0);assert.equal(group.mesh.count,9);
 const matrix=new THREE.Matrix4();group.mesh.getMatrixAt(group.members.get(parts[2]).slot,matrix);assert.equal(matrix.elements[12],2);
 parts.forEach(o=>scene.remove(o));batch.update(1000);assert.equal(group.mesh.count,0);assert.equal(batch.groups.size,1);scene.add(parts[0]);batch.update(1500);assert.equal(batch.groups.size,1);assert.equal(batch.stats.allocations,2);
 scene.remove(parts[0]);batch.update(2000);batch.update(5000);assert.equal(batch.groups.size,0);assert.equal(materialDisposals,1);assert.equal(geometryDisposals,0);assert.ok(parts.every(o=>o.layers.mask===1));batch.dispose();geo.dispose();mat.dispose();
});
test('material changes migrate a live member without corrupting faction masks or other members',()=>{
 const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),red=new THREE.MeshStandardMaterial({color:'red'}),cyan=new THREE.MeshStandardMaterial({color:'cyan'}),parts=[];
 for(const mat of [red,red,red,cyan,cyan,cyan]){const o=new THREE.Mesh(geo,mat);o.userData.meshy=true;scene.add(o);parts.push(o);}
 const batch=new AssetInstanceBatch(scene);batch.update(0);const old=parts[0].userData.assetInstanceGroup,other=parts[3].userData.assetInstanceGroup;parts[0].material=cyan;notifyAssetBatchChanged(parts[0]);batch.update(500);
 assert.equal(parts[0].userData.assetInstanceGroup,other);assert.equal(old.members.size,2);assert.equal(other.members.size,4);assert.equal(batch.stats.allocations,2);assert.equal(parts[0].layers.mask,0);batch.dispose();assert.ok(parts.every(o=>o.layers.mask===1));geo.dispose();red.dispose();cyan.dispose();
});
test('faction tint and animated or transparent meshes cannot share the wrong batch',()=>{
 const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),source=new THREE.MeshStandardMaterial();source.userData.meshyBatchSource='shared';
 for(const color of ['red','red','red','cyan','cyan','cyan']){const material=source.clone();material.color.set(color);const mesh=new THREE.Mesh(geo,material);mesh.userData.meshy=true;scene.add(mesh);}
 const translucent=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({transparent:true}));translucent.userData.meshy=true;scene.add(translucent);
 const batch=new AssetInstanceBatch(scene);batch.update(0);assert.equal(batch.groups.size,2);assert.equal(batch.stats.instances,6);assert.equal(translucent.layers.mask,1);batch.dispose();assert.ok(scene.children.every(o=>o.layers.mask===1));geo.dispose();scene.children.forEach(o=>o.material.dispose());source.dispose();
});

function eventRig(){
 const scene=new THREE.Scene(),batch=new AssetInstanceBatch(scene),root=new THREE.Group(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial();scene.add(root);
 const add=(parent=root)=>{const mesh=new THREE.Mesh(geo,mat);mesh.userData.meshy=true;parent.add(mesh);return mesh;};
 const dispose=()=>{batch.dispose();geo.dispose();mat.dispose();};return {scene,batch,root,geo,mat,add,dispose};
}
test('async nested mounts and boss sections register once, with no full-scene polling',()=>{
 const r=eventRig(),mount=new THREE.Group();r.root.add(mount);const parts=[r.add(mount),r.add(mount),r.add(mount)];notifyAssetBatchAttached(mount);notifyAssetBatchAttached(mount);r.batch.update(0);
 assert.equal(r.batch.stats.instances,3);assert.equal(r.batch.stats.keyComputations,3);assert.equal(r.batch.audit().valid,true);
 const original=r.scene.traverse;r.scene.traverse=()=>{throw new Error('whole scene scan');};
 for(let i=0;i<1000;i++)r.scene.add(new THREE.Object3D());for(let i=1;i<10;i++)r.batch.update(i*500);
 assert.equal(r.batch.stats.keyComputations,3);assert.equal(r.batch.stats.fullSceneScans,1);r.scene.traverse=original;
 const section=r.add(mount);notifyAssetBatchAttached(section);r.batch.update(5000);assert.equal(r.batch.stats.classified,1);assert.equal(r.batch.audit().valid,true);
 r.dispose();assert.ok(parts.every(p=>p.layers.mask===1));
});
test('nested releases, direct mesh detach and pending mount cancellation clear candidates',()=>{
 const r=eventRig(),mount=new THREE.Group();r.root.add(mount);[r.add(mount),r.add(mount),r.add(mount)];notifyAssetBatchAttached(mount);r.batch.update(0);
 notifyAssetBatchRemoved(mount);mount.removeFromParent();r.batch.update(10);assert.equal(r.batch.stats.instances,0);assert.equal(r.batch.audit().registered,0);
 const mesh=r.add();notifyAssetBatchAttached(mesh);mesh.removeFromParent();r.batch.update(20);assert.equal(r.batch.stats.classified,0);
 const late=new THREE.Group();r.root.add(late);r.scene.remove(r.root);r.add(late);notifyAssetBatchAttached(late);r.batch.update(30);assert.equal(r.batch.audit().registered,0);assert.equal(r.batch.audit().valid,true);r.dispose();
});
test('changed LOD and faction material migrate only dirty candidates, including repeated notifications',()=>{
 const r=eventRig(),parts=[r.add(),r.add(),r.add()];notifyAssetBatchAttached(r.root);r.batch.update(0);
 const lod=new THREE.SphereGeometry(),hostile=r.mat.clone();hostile.userData.meshyBatchSource=r.mat.uuid;hostile.color.set('red');hostile.customProgramCacheKey=()=> 'hostile';
 for(const mesh of parts){mesh.geometry=lod;mesh.material=hostile;notifyAssetBatchChanged(mesh);notifyAssetBatchChanged(mesh);}r.batch.update(1);
 assert.equal(r.batch.stats.classified,3);assert.equal(r.batch.audit().valid,true);const group=parts[0].userData.assetInstanceGroup;assert.equal(group.mesh.geometry,lod);assert.equal(group.material.color.getHexString(),'ff0000');assert.equal(group.members.size,3);
 const previous=r.batch.stats.keyComputations;r.batch.update(500);assert.equal(r.batch.stats.keyComputations,previous);hostile.color.set('cyan');notifyAssetBatchChanged(r.root);r.batch.update(501);assert.equal(r.batch.audit().valid,true);assert.equal(parts[0].userData.assetInstanceGroup.material.color.getHexString(),'00ffff');r.dispose();lod.dispose();hostile.dispose();
});
test('eligibility changes restore source visibility and later reuse the eligible bucket',()=>{
 const r=eventRig(),parts=[r.add(),r.add(),r.add()];notifyAssetBatchAttached(r.root);r.batch.update(0);
 r.mat.transparent=true;notifyAssetBatchChanged(r.root);r.batch.update(1);assert.ok(parts.every(p=>p.layers.mask===1));assert.equal(r.batch.stats.instances,0);assert.equal(r.batch.audit().valid,true);
 r.mat.transparent=false;notifyAssetBatchChanged(r.root);r.batch.update(2);assert.equal(r.batch.stats.instances,3);assert.equal(r.batch.audit().valid,true);r.dispose();
});
test('reparented mounts register in the destination scene and disposed batches stop observing',()=>{
 const r=eventRig(),other=new THREE.Scene(),second=new AssetInstanceBatch(other),mount=new THREE.Group();r.root.add(mount);[r.add(mount),r.add(mount),r.add(mount)];notifyAssetBatchAttached(mount);r.batch.update(0);
 notifyAssetBatchRemoved(mount);other.add(mount);notifyAssetBatchAttached(mount);r.batch.update(1);second.update(1);assert.equal(r.batch.audit().valid,true);assert.equal(second.audit().valid,true);assert.equal(second.stats.instances,3);
 second.dispose();assert.equal(mount.children[0].layers.mask,1);const before=second.registrations;other.add(r.add());assert.equal(second.registrations,before);r.dispose();
});
test('oracle detects missed notifications, duplicate membership and stale rendered geometry/material',()=>{
 const r=eventRig(),parts=[r.add(),r.add(),r.add()];notifyAssetBatchAttached(r.root);r.batch.update(0);const group=parts[0].userData.assetInstanceGroup;
 group.material.color.set('red');assert.ok(r.batch.audit().errors.some(e=>e.startsWith('stale rendered')));group.material.color.copy(r.mat.color);
 const lod=new THREE.SphereGeometry();parts[0].geometry=lod;assert.ok(r.batch.audit().errors.some(e=>e.startsWith('stale key')));notifyAssetBatchChanged(parts[0]);r.batch.update(1);assert.equal(r.batch.audit().valid,true);
 const missing=r.add();assert.ok(r.batch.audit().errors.some(e=>e.startsWith('missing candidate')));notifyAssetBatchAttached(missing);r.batch.update(2);assert.equal(r.batch.audit().valid,true);
 const fake={...group,members:new Map([[parts[1],group.members.get(parts[1])]])};r.batch.groups.set('fake',fake);assert.ok(r.batch.audit().errors.some(e=>e.startsWith('duplicate membership')));r.batch.groups.delete('fake');r.dispose();lod.dispose();
});
