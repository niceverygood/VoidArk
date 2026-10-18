import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AnimatedVFX} from '../src/animated-vfx.js';

const previousWindow=globalThis.window,load=THREE.TextureLoader.prototype.load,loaded=[];
before(()=>{globalThis.window={};THREE.TextureLoader.prototype.load=function(url,ready,progress,failed){const texture=new THREE.Texture();loaded.push({url,texture,ready,failed});ready(texture);return texture;};});
after(()=>{THREE.TextureLoader.prototype.load=load;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});

test('native smoke and additive slots retain all 96 cyclic CPU records while using at most seven additive draws',()=>{
  const scene=new THREE.Scene(),fx=new AnimatedVFX(scene),types=['explosion','smoke','energy','shockwave','engine','warp','spark','ion'],camera=new THREE.PerspectiveCamera();
  for(let i=0;i<130;i++)fx.emit({x:i%12,y:i%5,z:-i%7},types[i%8],5,2,0x68bcff);
  assert.equal(fx.slots.length,96);assert.equal(fx.cursor,34);fx.update(.1,camera);
  const smoke=fx.slots.filter(s=>s.type==='smoke');assert.ok(smoke.every(s=>s.mesh.layers.mask===1&&s.mesh.material.blending===THREE.NormalBlending));assert.ok(fx.slots.filter(s=>s.type!=='smoke').every(s=>s.mesh.layers.mask===0));
  assert.equal(fx.batches.objects().reduce((sum,m)=>sum+m.count,0),96-smoke.length);assert.equal(loaded.length,8);assert.equal(fx.preparationResources().textures.length,8);assert.equal(fx.preparationResources().objects.length,8);fx.dispose();
});

test('native comparison mode restores original mesh representation without changing state or buffers',()=>{
  const scene=new THREE.Scene(),fx=new AnimatedVFX(scene),camera=new THREE.PerspectiveCamera();fx.emit({x:2,y:3,z:4},'energy',6,2,0xffb366);fx.emit({x:0,y:1,z:2},'smoke',8,2);fx.update(.2,camera);
  const state=JSON.stringify(fx.slots.map(s=>({life:s.life,position:s.mesh.position.toArray(),quaternion:s.mesh.quaternion.toArray(),scale:s.mesh.scale.toArray(),frame:s.mesh.material.uniforms.frame.value,opacity:s.mesh.material.uniforms.opacity.value}))),matrices=fx.batches.objects().map(m=>m.instanceMatrix);
  fx.setBatchRendering(false);assert.ok(fx.slots.every(s=>s.mesh.layers.mask===1));assert.ok(fx.batches.objects().every(m=>m.count===0&&!m.visible));
  fx.setBatchRendering(true);assert.equal(JSON.stringify(fx.slots.map(s=>({life:s.life,position:s.mesh.position.toArray(),quaternion:s.mesh.quaternion.toArray(),scale:s.mesh.scale.toArray(),frame:s.mesh.material.uniforms.frame.value,opacity:s.mesh.material.uniforms.opacity.value}))),state);assert.deepEqual(fx.batches.objects().map(m=>m.instanceMatrix),matrices);
  fx.clear();assert.ok(fx.slots.every(s=>s.life===0&&!s.mesh.visible));assert.ok(fx.batches.objects().every(m=>m.count===0));let smokeDisposals=0;fx.smokeWarmup.material.addEventListener('dispose',()=>smokeDisposals++);fx.dispose();fx.dispose();assert.equal(smokeDisposals,1);assert.equal(scene.children.length,0);
});

test('failed cached images stop existing slots, reject new emits and remain reported without disposing shared textures',()=>{
  const fx=new AnimatedVFX(new THREE.Scene()),camera=new THREE.PerspectiveCamera(),entry=loaded.find(l=>l.url.endsWith('/ion.png'));let disposed=0;entry.texture.addEventListener('dispose',()=>disposed++);
  fx.emit({x:0,y:0,z:0},'ion',5,1);entry.failed();fx.update(.1,camera);assert.equal(fx.slots[0].life,0);assert.equal(fx.slots[0].mesh.visible,false);assert.equal(fx.batches.groups.get('ion').mesh.count,0);const length=fx.slots.length;fx.emit({x:0,y:0,z:0},'ion');assert.equal(fx.slots.length,length);assert.ok(fx.preparationResources().failed.includes('ion'));fx.dispose();assert.equal(disposed,0);
});
