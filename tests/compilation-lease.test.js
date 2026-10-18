import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCompilationLease} from '../src/compilation-lease.js';

test('shader compilation borrows render-target uniforms without changing source uniforms or owning GPU products',async()=>{
 const target=new THREE.WebGLCubeRenderTarget(16),ordinary=new THREE.Texture(),color=new THREE.Color(.2,.3,.4);
 const source=new THREE.ShaderMaterial({uniforms:{field:{value:target.texture},fields:{value:[ordinary,target.texture]},tint:{value:color},time:{value:2}}});
 const original=source.uniforms,geometry=new THREE.SphereGeometry(1),lease=createCompilationLease([new THREE.Mesh(geometry,source)]);
 let borrowedDisposed=0;target.texture.addEventListener('dispose',()=>borrowedDisposed++);geometry.addEventListener('dispose',()=>borrowedDisposed++);
 const renderer={getRenderTarget:()=>null,setRenderTarget(){},async compileAsync(root){root.traverse(o=>{
  assert.equal(o.material.uniforms.field.value,target.texture);assert.equal(o.material.uniforms.fields.value[1],target.texture);
  assert.notEqual(o.material.uniforms.fields.value,source.uniforms.fields.value);assert.notEqual(o.material.uniforms.tint.value,color);
  o.material.uniforms.tint.value.setRGB(1,0,0);o.material.uniforms.time.value=10;
 });}};
 assert.equal(await lease.prepare(renderer,null,null,null),true);lease.dispose();
 assert.equal(source.uniforms,original);assert.equal(source.uniforms.field.value,target.texture);assert.equal(source.uniforms.time.value,2);assert.deepEqual(color.toArray(),[.2,.3,.4]);assert.equal(borrowedDisposed,0);
 source.dispose();geometry.dispose();ordinary.dispose();target.dispose();
});

test('cancelled world materials can be disposed while compiler materials remain alive until polling completes',async()=>{
 const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture();
 const source=new THREE.MeshStandardMaterial({map:texture});
 source.onBeforeCompile=shader=>{shader.fragmentShader+='// tint';};source.customProgramCacheKey=()=> 'same-live-variant';
 const mesh=new THREE.Mesh(geometry,source),instanced=new THREE.InstancedMesh(geometry,source,3);
 // Object3D.clone would fail on real batch membership cycles. Compilation
 // borrows object capabilities without cloning its userData or GPU buffers.
 mesh.userData.cycle=mesh;
 const lease=createCompilationLease([mesh,instanced]);let resolve,materialDisposed=0,borrowedDisposed=0,current=null;
 for(const resource of [geometry,texture,instanced])resource.addEventListener('dispose',()=>borrowedDisposed++);
 const renderer={getRenderTarget:()=>current,setRenderTarget:v=>current=v,compileAsync(root){
  const proxies=[];root.traverse(o=>proxies.push(o));
  assert.equal(proxies[0].isMesh,true);assert.equal(proxies[1].isInstancedMesh,true);
  assert.equal(proxies[1].instanceMatrix,instanced.instanceMatrix);assert.equal(proxies[0].geometry,geometry);
  const material=proxies[0].material;assert.equal(proxies[1].material,material);assert.notEqual(material,source);
  assert.equal(material.map,texture);assert.equal(material.onBeforeCompile,source.onBeforeCompile);
  assert.equal(material.customProgramCacheKey(),source.customProgramCacheKey());
  material.addEventListener('dispose',()=>materialDisposed++);
  return new Promise(finish=>resolve=()=>{assert.equal(materialDisposed,0);finish();});
 }};
 const target={},pending=lease.prepare(renderer,null,null,target);assert.equal(current,null);
 source.dispose();lease.dispose();lease.dispose();assert.equal(materialDisposed,0);
 assert.equal(lease.diagnostics().preparing,1);resolve();assert.equal(await pending,false);
 assert.equal(materialDisposed,1);assert.equal(borrowedDisposed,0);assert.equal(lease.diagnostics().released,true);
 assert.equal(await lease.prepare(renderer,null,null,target),false);
 geometry.dispose();texture.dispose();instanced.dispose();
});

test('successful compilation keeps programs leased until originals have rendered, then releases once',async()=>{
 const source=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),source);
 const lease=createCompilationLease([mesh]);let disposed=0;
 const renderer={getRenderTarget:()=>null,setRenderTarget(){},async compileAsync(root){root.traverse(o=>o.material.addEventListener('dispose',()=>disposed++));}};
 assert.equal(await lease.prepare(renderer,null,null,null),true);assert.equal(disposed,0);
 lease.dispose();lease.dispose();assert.equal(disposed,1);assert.equal(lease.diagnostics().objects,0);
 source.dispose();mesh.geometry.dispose();
});

test('rejected compilation releases cancelled materials without disposing borrowed resources',async()=>{
 const source=new THREE.LineBasicMaterial(),geometry=new THREE.BufferGeometry();
 const lease=createCompilationLease([new THREE.Line(geometry,source)]);let reject,disposed=0,borrowed=0;
 geometry.addEventListener('dispose',()=>borrowed++);source.addEventListener('dispose',()=>borrowed++);
 const renderer={getRenderTarget:()=>null,setRenderTarget(){},compileAsync(root){root.traverse(o=>o.material.addEventListener('dispose',()=>disposed++));return new Promise((resolve,fail)=>reject=fail);}};
 const pending=lease.prepare(renderer,null,null,null);lease.dispose();reject(new Error('shader failed'));
 await assert.rejects(pending,/shader failed/);assert.equal(disposed,1);assert.equal(borrowed,0);
 source.dispose();geometry.dispose();
});
