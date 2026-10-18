import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
test('atlas readiness waits for every image and shared sources survive clear and another effect consumer',async()=>{
 const {AnimatedVFX}=await import('../src/animated-vfx.js?preparation-success'),previousWindow=globalThis.window,load=THREE.TextureLoader.prototype.load,pending=[];globalThis.window={};let disposes=0;
 THREE.TextureLoader.prototype.load=function(url,onLoad,progress,onError){const texture=new THREE.Texture({width:768,height:768});texture.needsUpdate=true;texture.addEventListener('dispose',()=>disposes++);pending.push({url,texture,onLoad,onError});return texture;};
 try{
  const atlas=new AnimatedVFX(new THREE.Scene());assert.equal(pending.length,8);assert.equal(atlas.preparationResources().ready,false);assert.equal(atlas.preparationResources().textures.length,0);pending.slice(0,7).forEach(p=>p.onLoad(p.texture));assert.equal(atlas.preparationResources().ready,false);pending[7].onLoad(pending[7].texture);
  assert.equal(atlas.preparationResources().ready,true);assert.deepEqual(atlas.preparationResources().textures,pending.map(p=>p.texture));atlas.emit({x:0,y:0,z:0},'energy');atlas.clear();assert.equal(disposes,0);const another=new AnimatedVFX(new THREE.Scene());assert.equal(pending.length,8);assert.deepEqual(another.preparationResources().textures,atlas.preparationResources().textures);
 }finally{THREE.TextureLoader.prototype.load=load;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
test('one failed atlas settles the gate and leaves procedural fallback free of a broken sampler',async()=>{
 const {AnimatedVFX}=await import('../src/animated-vfx.js?preparation-failure'),previousWindow=globalThis.window,load=THREE.TextureLoader.prototype.load,pending=[];globalThis.window={};
 THREE.TextureLoader.prototype.load=function(url,onLoad,progress,onError){const texture=new THREE.Texture({width:768,height:768});pending.push({url,texture,onLoad,onError});return texture;};
 try{
  const atlas=new AnimatedVFX(new THREE.Scene());atlas.emit({x:0,y:0,z:0},'smoke');assert.equal(atlas.slots.length,1);pending.forEach(p=>p.url.endsWith('/smoke.png')?p.onError(Error('controlled image failure')):p.onLoad(p.texture));const resources=atlas.preparationResources();assert.equal(resources.ready,true);assert.deepEqual(resources.failed,['smoke']);assert.equal(resources.textures.length,7);const camera=new THREE.PerspectiveCamera();atlas.update(0,camera);assert.equal(atlas.slots[0].life,0);assert.equal(atlas.slots[0].mesh.visible,false);atlas.emit({x:0,y:0,z:0},'smoke');assert.equal(atlas.slots.length,1);atlas.emit({x:0,y:0,z:0},'energy');assert.equal(atlas.slots.length,2);
 }finally{THREE.TextureLoader.prototype.load=load;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
