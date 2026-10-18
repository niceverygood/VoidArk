import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ProjectileVisuals,PROJECTILE_LOOKS} from '../src/projectile-visuals.js';
import {visibleTextures,uniqueBufferObjects} from '../src/sortie-warmup.js';

test('future projectile resources borrow actual shared assets without mounting or disposing them',async()=>{
 const scene=new THREE.Scene(),source=new THREE.Group(),geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture});
 const a=new THREE.Mesh(geometry,material),b=new THREE.Mesh(geometry,material);a.receiveShadow=true;source.add(a,b);
 let resolve,released=0,disposed=0;for(const resource of [geometry,texture,material])resource.addEventListener('dispose',()=>disposed++);
 const p=new ProjectileVisuals(scene,{acquireAssets(ids){assert.deepEqual(ids,Object.values(PROJECTILE_LOOKS).map(p=>p.asset));return {ready:new Promise(r=>resolve=r),release(){released++;}};}});
 assert.equal(p.preparationResources().ready,false);resolve([source,null]);assert.equal(await p.preparationReady,true);
 const r=p.preparationResources();assert.equal(r.ready,true);assert.equal(r.objects.length,2);
 for(const proxy of r.objects){assert.equal(proxy.geometry,geometry);assert.equal(proxy.material,material);assert.equal(proxy.parent,null);assert.equal(proxy.frustumCulled,false);}
 assert.equal(r.objects[0].receiveShadow,true);assert.deepEqual(source.children,[a,b]);
 assert.deepEqual(visibleTextures(r.objects),[texture]);assert.equal(uniqueBufferObjects(r.objects).length,1);
 p.dispose();p.dispose();assert.equal(released,1);assert.equal(disposed,0);assert.equal(scene.children.length,0);assert.equal(p.preparationResources().ready,false);assert.deepEqual(p.preparationResources().objects,[]);
 geometry.dispose();material.dispose();texture.dispose();
});

test('closing while real source readiness is pending prevents late proxies, and missing sources keep fallback available',async()=>{
 const scene=new THREE.Scene();let resolve,released=0;
 const p=new ProjectileVisuals(scene,{acquireAssets:()=>({ready:new Promise(r=>resolve=r),release:()=>released++})});
 p.dispose();resolve([new THREE.Group()]);assert.equal(await p.preparationReady,false);assert.equal(released,1);assert.deepEqual(p.preparationResources(),{ready:false,objects:[]});
 const fallback=new ProjectileVisuals(scene,{acquireAssets:()=>({ready:Promise.resolve([null,null]),release:()=>{}})});
 assert.equal(await fallback.preparationReady,true);assert.deepEqual(fallback.preparationResources(),{ready:true,objects:[]});fallback.dispose();
});
