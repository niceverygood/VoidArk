import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AtlasEffectBatcher} from '../src/atlas-effect-batch.js';

function fixture() {
  const scene=new THREE.Scene(),quad=new THREE.PlaneGeometry(),textures=new Map(['explosion','smoke','energy','shockwave','engine','warp','spark','ion'].map(type=>[type,new THREE.Texture()]));
  return {scene,quad,textures,batcher:new AtlasEffectBatcher(scene,quad,textures)};
}
function slot(type='explosion') {
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.ShaderMaterial({uniforms:{frame:{value:3.7},opacity:{value:.62},tint:{value:new THREE.Color(.2,.4,.8)}}}));
  mesh.position.set(3,7,-2);mesh.quaternion.setFromEuler(new THREE.Euler(.3,-.7,.8));mesh.scale.setScalar(4.2);return {mesh,type};
}
function close(f,...slots){f.batcher.dispose();f.quad.dispose();for(const s of slots){s.mesh.geometry.dispose();s.mesh.material.dispose();}for(const t of f.textures.values())t.dispose();}

test('seven additive batches own their attributes while borrowing the eight cached textures',()=>{
  const f=fixture();assert.equal(f.batcher.groups.size,7);assert.equal(f.batcher.groups.has('smoke'),false);assert.equal(f.quad.getAttribute('atlasFrame'),undefined);
  const geos=new Set();for(const [type,g] of f.batcher.groups){assert.equal(g.mesh.material.uniforms.atlas.value,f.textures.get(type));assert.equal(g.mesh.material.blending,THREE.AdditiveBlending);assert.equal(g.mesh.material.depthWrite,false);assert.equal(g.mesh.frustumCulled,false);assert.equal(g.mesh.count,0);assert.notEqual(g.mesh.geometry,f.quad);geos.add(g.mesh.geometry);}
  assert.equal(geos.size,7);close(f);
});

test('instance matrices and animation attributes reproduce native slot transforms and uniforms',()=>{
  const f=fixture(),a=slot(),b=slot('ion');b.mesh.position.x=-8;f.batcher.begin();f.batcher.write(a);f.batcher.write(b);f.batcher.finish();
  const actual=new THREE.Matrix4();for(const s of [a,b]){const g=f.batcher.groups.get(s.type);g.mesh.getMatrixAt(0,actual);actual.elements.forEach((v,i)=>assert.ok(Math.abs(v-s.mesh.matrix.elements[i])<1e-6));assert.ok(Math.abs(g.frame.getX(0)-3.7)<1e-6);assert.ok(Math.abs(g.opacity.getX(0)-.62)<1e-6);assert.ok(Math.abs(g.tint.getZ(0)-.8)<1e-6);assert.equal(g.mesh.count,1);assert.equal(g.mesh.visible,true);}
  close(f,a,b);
});

test('immediate emit refresh moves a cyclic slot between types without duplicate draws',()=>{
  const f=fixture(),a=slot(),b=slot();f.batcher.refresh(a);f.batcher.refresh(b);assert.equal(f.batcher.groups.get('explosion').mesh.count,2);
  a.type='smoke';f.batcher.refresh(a);const original=f.batcher.groups.get('explosion');assert.equal(original.mesh.count,1);assert.equal(original.members[0],b);
  a.type='energy';f.batcher.refresh(a);assert.equal(f.batcher.groups.get('energy').mesh.count,1);
  b.type='energy';f.batcher.refresh(b);assert.equal(original.mesh.count,0);assert.equal(original.mesh.visible,false);assert.equal(f.batcher.groups.get('energy').mesh.count,2);
  close(f,a,b);
});

test('repeated updates reuse all GPU buffers and leave the current main-camera billboard unchanged in subviews',()=>{
  const f=fixture(),s=slot(),g=f.batcher.groups.get('explosion'),buffers=[g.mesh.instanceMatrix,g.frame,g.opacity,g.tint],camera=new THREE.PerspectiveCamera();
  camera.quaternion.setFromEuler(new THREE.Euler(.7,.5,-.2));s.mesh.quaternion.copy(camera.quaternion);s.mesh.rotateZ(.8);
  for(let i=0;i<100;i++){f.batcher.begin();f.batcher.write(s);f.batcher.finish();assert.deepEqual([g.mesh.instanceMatrix,g.frame,g.opacity,g.tint],buffers);}
  const pose=g.mesh.instanceMatrix.array.slice(),secondary=new THREE.PerspectiveCamera();secondary.quaternion.setFromEuler(new THREE.Euler(-.8,1.3,.1));g.mesh.onBeforeRender({},f.scene,secondary,g.mesh.geometry,g.mesh.material,null);
  assert.deepEqual(g.mesh.instanceMatrix.array,pose);assert.equal(g.mesh.material.uniforms.atlas.value,f.textures.get('explosion'));close(f,s);
});

test('clear hides batches and final dispose releases owned resources once without touching borrowed textures or quad',()=>{
  const f=fixture(),s=slot();let geometry=0,material=0,instance=0,texture=0,quad=0;
  f.quad.addEventListener('dispose',()=>quad++);for(const t of f.textures.values())t.addEventListener('dispose',()=>texture++);
  for(const {mesh} of f.batcher.groups.values()){mesh.geometry.addEventListener('dispose',()=>geometry++);mesh.material.addEventListener('dispose',()=>material++);mesh.addEventListener('dispose',()=>instance++);}
  f.batcher.refresh(s);f.batcher.clear();assert.ok(f.batcher.objects().every(mesh=>mesh.count===0&&!mesh.visible));f.batcher.dispose();f.batcher.dispose();
  assert.deepEqual([geometry,material,instance,texture,quad],[7,7,7,0,0]);assert.equal(f.scene.children.length,0);s.mesh.geometry.dispose();s.mesh.material.dispose();f.quad.dispose();for(const t of f.textures.values())t.dispose();
});
