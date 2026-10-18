import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createFactionHullMaterial} from '../src/faction-identity.js';
import {createHostileShaderVariants} from '../src/hostile-shader-warmup.js';

test('prepared hostile materials use the live tint shader without changing shared colors or textures',()=>{
 const texture=new THREE.Texture(),source=new THREE.MeshStandardMaterial({color:0x71e6e8,map:texture}),color=source.color.clone();
 const material=createFactionHullMaterial(source),shader={fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader);
 assert.equal(material.map,texture);assert.notEqual(material,source);assert.ok(source.color.equals(color));assert.equal(material.color.getHex(),0x923e3b);assert.equal(material.customProgramCacheKey(),'hostile-hull-identification-v1');assert.match(shader.fragmentShader,/vec3\(0.65, 0.08, 0.055\)/);
 const bright=new THREE.MeshStandardMaterial({emissiveIntensity:2});assert.equal(createFactionHullMaterial(bright),bright);material.dispose();source.dispose();texture.dispose();bright.dispose();
});

test('preparation retains native and instanced variants and releases only owned resources after cancellation settles',async()=>{
 const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),source=new THREE.MeshStandardMaterial({map:texture}),mesh=new THREE.Mesh(geometry,source),scene=new THREE.Scene();scene.add(mesh);
 let originalDisposed=0,released=0,finish;for(const item of [geometry,texture,source])item.addEventListener('dispose',()=>originalDisposed++);
 const variants=createHostileShaderVariants([scene],{onDispose(){released++;}});assert.equal(variants.objects.length,6);assert.equal(variants.objects.filter(o=>o.isInstancedMesh).length,3);assert.equal(variants.objects[4].geometry,geometry);assert.equal(mesh.parent,scene);
 let current=null;const target={};const renderer={getRenderTarget:()=>current,setRenderTarget:value=>current=value,compileAsync(root,camera,world){assert.equal(current,target);assert.equal(world,scene);return new Promise(resolve=>finish=resolve);}};
 const preparing=variants.prepare(renderer,new THREE.PerspectiveCamera(),scene,target);assert.equal(current,null);variants.dispose();variants.dispose();assert.equal(released,0);assert.equal(variants.diagnostics().preparing,1);finish();assert.equal(await preparing,false);assert.equal(released,1);assert.equal(originalDisposed,0);assert.equal(await variants.prepare(renderer,null,scene,target),false);variants.dispose();assert.equal(released,1);
 geometry.dispose();texture.dispose();source.dispose();
});

test('failed shader preparation restores the target and permits one safe lease release',async()=>{
 let release=0,reject;const variants=createHostileShaderVariants([],{onDispose(){release++;}}),old={},target={};let current=old;
 const renderer={getRenderTarget:()=>current,setRenderTarget:v=>current=v,compileAsync(){return new Promise((resolve,fail)=>reject=fail);}};
 const pending=variants.prepare(renderer,null,new THREE.Scene(),target);variants.dispose();assert.equal(current,old);assert.equal(release,0);reject(new Error('GPU preparation failed'));await assert.rejects(pending,/GPU preparation failed/);assert.equal(release,1);assert.equal(variants.diagnostics().released,true);variants.dispose();assert.equal(release,1);
});

test('palette-preserving planetary PBR and tinted hull programs have separate native and instance owners',()=>{
 const variants=createHostileShaderVariants([]),[plain,plainInstance,tinted,tintedInstance]=variants.objects;
 assert.equal(plain.material,plainInstance.material);assert.equal(tinted.material,tintedInstance.material);assert.equal(plain.geometry,tinted.geometry);
 assert.equal(plain.material.customProgramCacheKey(),new THREE.MeshStandardMaterial().customProgramCacheKey());assert.equal(tinted.material.customProgramCacheKey(),'hostile-hull-identification-v1');assert.notEqual(plain.material,tinted.material);
 let plainDisposed=0,tintDisposed=0;plain.material.addEventListener('dispose',()=>plainDisposed++);tinted.material.addEventListener('dispose',()=>tintDisposed++);variants.dispose();variants.dispose();assert.equal(plainDisposed,1);assert.equal(tintDisposed,1);
});

for(const fail of [false,true])test(`first-use hull draw ${fail?'failure':'success'} restores interleaved renderer state and never owns source buffers`,async()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),source=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),light=new THREE.DirectionalLight();scene.add(source,light);
 let borrowedDisposed=0;geometry.addEventListener('dispose',()=>borrowedDisposed++);material.addEventListener('dispose',()=>borrowedDisposed++);
 const variants=createHostileShaderVariants([source]),target={},old={},latest={},state={target:old,viewport:new THREE.Vector4(4,5,600,400),scissor:new THREE.Vector4(2,3,100,200),scissorTest:true,color:new THREE.Color(0x123456),alpha:.4};let renderCount=0;
 const renderer={autoClear:true,getRenderTarget:()=>state.target,setRenderTarget:v=>{state.target=v;state.viewport.set(0,0,900,700);},getViewport:v=>v.copy(state.viewport),setViewport:(...a)=>state.viewport.copy(a.length===1?a[0]:new THREE.Vector4(...a)),getScissor:v=>v.copy(state.scissor),setScissor:v=>state.scissor.copy(v),getScissorTest:()=>state.scissorTest,setScissorTest:v=>state.scissorTest=v,getClearColor:c=>c.copy(state.color),getClearAlpha:()=>state.alpha,setClearColor:(c,a)=>{state.color.copy(c);state.alpha=a;},getPixelRatio:()=>1.5,async compileAsync(){await Promise.resolve();state.target=latest;state.viewport.set(8,9,700,500);},render(view){renderCount++;assert.equal(state.target,target);assert.deepEqual(state.viewport.toArray(),[0,0,2/3,2/3]);assert.equal(this.autoClear,false);assert.equal(state.scissorTest,false);assert.ok(view.children.includes(light));assert.ok(view.children.includes(variants.objects[2]));assert.equal(source.parent,scene);if(fail)throw Error('first-use failed');}};
 const pending=variants.prepare(renderer,new THREE.PerspectiveCamera(),scene,target);if(fail)await assert.rejects(pending,/first-use failed/);else assert.equal(await pending,true);
 assert.equal(renderCount,1);assert.equal(state.target,latest);assert.deepEqual(state.viewport.toArray(),[8,9,700,500]);assert.deepEqual(state.scissor.toArray(),[2,3,100,200]);assert.equal(state.scissorTest,true);assert.equal(renderer.autoClear,true);assert.equal(state.color.getHex(),0x123456);assert.equal(state.alpha,.4);assert.equal(variants.diagnostics().ready,!fail);assert.equal(variants.diagnostics().preparing,0);
 variants.dispose();variants.dispose();assert.equal(borrowedDisposed,0);assert.equal(source.parent,scene);geometry.dispose();material.dispose();
});
