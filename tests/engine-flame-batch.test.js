import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {engineMaterial} from '../src/engine-material.js';
import {EngineFlameBatch,notifyEngineFlamesAttached,engineFlamesFor} from '../src/engine-flame-batch.js';
import {propagateVisibleMatrices} from '../src/hidden-world-matrices.js';
function fixture(n=6){const scene=new THREE.Scene(),geo=new THREE.ConeGeometry(1,1,12,1,true),roots=[],camera=new THREE.PerspectiveCamera(50,1,.1,2000);camera.position.z=35;camera.updateMatrixWorld();const batch=new EngineFlameBatch(scene);
 for(let i=0;i<n;i++){const root=new THREE.Group(),engine=new THREE.Group();engine.name='engine-nozzle';root.add(engine);root.position.set((i%6-2.5)*2,Math.floor(i/6),0);
  const flame=new THREE.Mesh(geo,engineMaterial(i%2?0xff456e:0x2df0ed)),hot=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:i%2?0xffbfaa:0xccffff,opacity:.65,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));flame.material.side=THREE.DoubleSide;flame.userData.engineBatchKind='flame';hot.userData.engineBatchKind='hot';flame.rotation.x=hot.rotation.x=Math.PI/2;engine.add(flame,hot);scene.add(root);roots.push({root,engine,flame,hot});}
 propagateVisibleMatrices(scene);batch.update(camera);return {scene,camera,roots,geo,batch,dispose(){batch.dispose();geo.dispose();roots.forEach(r=>{r.flame.material.dispose();r.hot.material.dispose();});}};
}
test('shared flame submission follows moving nozzles, exact source color/time/opacity and scale without changing the source',()=>{
 const f=fixture();for(let tick=0;tick<8;tick++){
  for(const [i,r] of f.roots.entries()){r.root.rotation.y=tick*.15;r.root.position.y=tick;r.engine.rotation.z=i*.1;r.flame.scale.set(1,tick+1,1);r.flame.material.uniforms.time.value=tick+i*1.73;r.flame.material.uniforms.opacity.value=.2+tick*.02;}
  propagateVisibleMatrices(f.scene);f.batch.update(f.camera,tick*16);assert.equal(f.batch.audit().valid,true);
  for(const r of f.roots){const e=f.batch.entries.get(r.flame),g=e.group,m=new THREE.Matrix4();g.mesh.getMatrixAt(e.slot,m);m.elements.forEach((n,i)=>assert.ok(Math.abs(n-r.flame.matrixWorld.elements[i])<1e-5));const a=g.geometry.attributes;assert.equal(a.aEngineTime.array[e.slot],Math.fround(r.flame.material.uniforms.time.value));assert.equal(a.aEngineOpacity.array[e.slot],Math.fround(r.flame.material.uniforms.opacity.value));assert.equal(a.aEngineTint.array[e.slot*3],Math.fround(r.flame.material.uniforms.tint.value.r));assert.equal(r.flame.geometry,f.geo);assert.equal(r.flame.visible,true);assert.equal(r.flame.layers.mask&1,0);}
 }assert.equal(f.batch.groups.size,2);f.dispose();
});
test('visibility, frustum, zoom and camera re-entry compact slots without stale factions or double drawing',()=>{
 const f=fixture();const first=f.roots[0],last=f.roots[5];first.engine.visible=false;last.root.position.x=1000;propagateVisibleMatrices(f.scene);f.batch.update(f.camera);assert.equal(f.batch.entries.get(first.flame).slot,-1);assert.equal(f.batch.entries.get(last.flame).slot,-1);assert.equal(f.batch.audit().valid,true);
 first.engine.visible=true;last.root.position.x=2;propagateVisibleMatrices(f.scene);f.camera.zoom=3;f.camera.updateProjectionMatrix();f.batch.update(f.camera);assert.ok(f.batch.entries.get(first.flame).slot>=0);assert.ok(f.batch.entries.get(last.flame).slot>=0);assert.equal(f.batch.audit().valid,true);
 f.batch.setEnabled(false);assert.equal(first.flame.layers.mask,1);assert.ok([...f.batch.groups.values()].every(g=>!g.mesh.visible));f.batch.setEnabled(true);f.batch.update(f.camera);assert.equal(first.flame.layers.mask,0);assert.equal(f.batch.audit().valid,true);f.dispose();
});
test('removed source/whole nozzle releases references and reused slots retain new data; repeated removal and re-entry stay bounded',()=>{
 const f=fixture(),r=f.roots[0];for(let i=0;i<30;i++){f.scene.remove(r.root);f.batch.update(f.camera,i*100);assert.equal(f.batch.entries.has(r.flame),false);assert.ok([...f.batch.groups.values()].every(g=>g.source!==r.flame&&g.source!==r.hot));f.scene.add(r.root);propagateVisibleMatrices(f.scene);f.batch.update(f.camera,i*100+1);assert.equal(f.batch.audit().valid,true);}
 r.engine.removeFromParent();assert.equal(f.batch.entries.has(r.flame),false);assert.equal(f.batch.branches.has(r.engine),false);r.root.add(r.engine);notifyEngineFlamesAttached(r.engine);propagateVisibleMatrices(f.scene);f.batch.update(f.camera);assert.equal(f.batch.entries.size,12);assert.equal(f.batch.allocations,2);assert.equal(f.batch.audit().valid,true);f.dispose();assert.equal(engineFlamesFor(f.scene),undefined);
});
test('growth and shrink release only owned instance buffers; shared geometry/materials and layer masks survive disposal',()=>{
 const f=fixture(192);f.camera.position.z=200;f.camera.updateMatrixWorld();f.batch.update(f.camera,0);let disposed=0;f.geo.addEventListener('dispose',()=>disposed++);const peak=f.batch.stats.bufferBytes;
 for(const r of f.roots.slice(1))f.scene.remove(r.root);propagateVisibleMatrices(f.scene);f.batch.update(f.camera,1);f.batch.update(f.camera,6001);assert.ok(f.batch.stats.bufferBytes<peak);assert.ok(f.batch.shrinks>0);assert.equal(f.batch.entries.size,2);assert.equal(f.batch.audit().valid,true);assert.equal(disposed,0);f.batch.dispose();assert.equal(f.roots[0].flame.layers.mask,1);assert.equal(disposed,0);f.geo.dispose();f.roots.forEach(r=>{r.flame.material.dispose();r.hot.material.dispose();});
});

test('an empty group reused before retirement restores its source before capacity growth',()=>{
 const f=fixture(1),r=f.roots[0];f.scene.remove(r.root);f.batch.update(f.camera,0);assert.ok([...f.batch.groups.values()].every(g=>g.source===null));f.scene.add(r.root);propagateVisibleMatrices(f.scene);for(const g of f.batch.groups.values())g.capacity=0;assert.doesNotThrow(()=>f.batch.update(f.camera,1));assert.equal(f.batch.audit().valid,true);assert.ok([...f.batch.groups.values()].every(g=>g.source));f.dispose();
});
