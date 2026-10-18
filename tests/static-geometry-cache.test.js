import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchStaticDetails} from '../src/static-detail-batch.js';
import {staticGeometryDiagnostics} from '../src/static-geometry-cache.js';
import {AssetInstanceBatch} from '../src/asset-instance-batch.js';
import {notifyAssetBatchChanged} from '../src/asset-batch-events.js';
function craft(geometry,material,offset=0){const root=new THREE.Group();for(let i=0;i<4;i++){const part=new THREE.Mesh(geometry,material);part.position.set(i*3+offset,i*.1,0);root.add(part);}return root;}
function combined(root){return root.children.find(o=>o.isMesh&&o.visible&&o.userData.staticBatch);}
test('identical static shapes share buffers while materials and transforms remain individual; last release owns disposal',()=>{
 const baseline=staticGeometryDiagnostics(),geometry=new THREE.BoxGeometry(),aMat=new THREE.MeshStandardMaterial({color:0xff0000}),bMat=aMat.clone(),a=craft(geometry,aMat),b=craft(geometry,bMat);
 const aRelease=batchStaticDetails(a),bRelease=batchStaticDetails(b),aMesh=combined(a),bMesh=combined(b);
 assert.equal(aMesh.geometry,bMesh.geometry);assert.notEqual(aMesh.material,bMesh.material);
 const original=bMesh.geometry.attributes.position.array.slice();aMesh.material.color.set(0x00ff00);a.scale.setScalar(3);
 assert.equal(bMesh.material.color.getHex(),0xff0000);assert.equal(b.scale.x,1);assert.deepEqual(bMesh.geometry.attributes.position.array,original);
 let disposed=0;aMesh.geometry.addEventListener('dispose',()=>disposed++);
 aRelease();aRelease();assert.equal(disposed,0);assert.equal(bMesh.parent,b);assert.equal(staticGeometryDiagnostics().references,baseline.references+1);
 bRelease();bRelease();assert.equal(disposed,1);assert.equal(staticGeometryDiagnostics().entries,baseline.entries);
 geometry.dispose();aMat.dispose();bMat.dispose();
});
test('different installation transforms and versioned source edits never contaminate an existing craft',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),roots=[craft(geometry,material),craft(geometry,material,.00000001)],release=roots.map(r=>batchStaticDetails(r));
 assert.notEqual(combined(roots[0]).geometry,combined(roots[1]).geometry);
 const original=combined(roots[0]).geometry.attributes.position.array.slice();geometry.attributes.position.setX(0,7);geometry.attributes.position.needsUpdate=true;
 const edited=craft(geometry,material),editedRelease=batchStaticDetails(edited);assert.notEqual(combined(edited).geometry,combined(roots[0]).geometry);assert.deepEqual(combined(roots[0]).geometry.attributes.position.array,original);
 geometry.setAttribute('position',geometry.attributes.position.clone());const replaced=craft(geometry,material),replacedRelease=batchStaticDetails(replaced);assert.notEqual(combined(edited).geometry,combined(replaced).geometry);
 [...release,editedRelease,replacedRelease].forEach(fn=>fn());geometry.dispose();material.dispose();
});
test('late asset replacement releases only that craft lease; explicit unshared baseline remains byte-identical',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),a=craft(geometry,material),b=craft(geometry,material),c=craft(geometry,material);
 const aRelease=batchStaticDetails(a),bRelease=batchStaticDetails(b),cRelease=batchStaticDetails(c,{shareGeometry:false});
 const shared=combined(b).geometry;assert.notEqual(shared,combined(c).geometry);assert.deepEqual(shared.attributes.position.array,combined(c).geometry.attributes.position.array);
 let disposed=0;shared.addEventListener('dispose',()=>disposed++);a.children[0].userData.assetReplaced=true;aRelease.refresh();assert.equal(disposed,0);assert.equal(a.children[0].visible,false);assert.equal(a.children[1].visible,true);assert.equal(combined(b).geometry,shared);
 aRelease();bRelease();cRelease();assert.equal(disposed,1);geometry.dispose();material.dispose();
});
test('shared merged geometry joins common batches by compatible material, preserves independent motion and retires safely',()=>{
 const baseline=staticGeometryDiagnostics(),scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),roots=[],materials=[],leases=[],batch=new AssetInstanceBatch(scene);
 for(let i=0;i<7;i++){const material=new THREE.MeshStandardMaterial({color:i<4?'red':'cyan'}),root=craft(geometry,material);root.userData.visualRoot=root;root.position.set(i,0,-12);scene.add(root);materials.push(material);roots.push(root);leases.push(batchStaticDetails(root));}
 const camera=new THREE.PerspectiveCamera(70,2,.1,100);batch.update(0,camera);assert.equal(batch.groups.size,2);assert.equal(batch.stats.instances,7);assert.equal(batch.audit().valid,true);
 const a=combined(roots[0]),b=combined(roots[1]);roots[0].rotation.y=.2;batch.update(1,camera);const group=a.userData.assetInstanceGroup,entry=group.members.get(a),matrix=new THREE.Matrix4();group.mesh.getMatrixAt(entry.slot,matrix);matrix.elements.forEach((v,i)=>assert.ok(Math.abs(v-a.matrixWorld.elements[i])<1e-5));assert.equal(b.geometry,a.geometry);
 materials[0].color.set('green');notifyAssetBatchChanged(a);batch.update(2,camera);assert.equal(a.layers.mask,1);assert.equal(b.material.color.getHex(),0xff0000);assert.equal(batch.audit().valid,true);
 for(let i=0;i<roots.length;i++){roots[i].removeFromParent();leases[i]();}batch.update(10000,camera);assert.equal(batch.stats.instances,0);assert.equal(batch.audit().valid,true);assert.equal(staticGeometryDiagnostics().references,baseline.references);assert.equal(staticGeometryDiagnostics().entries,baseline.entries);batch.dispose();geometry.dispose();materials.forEach(m=>m.dispose());
});
