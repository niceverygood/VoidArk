import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installFactionIdentity} from '../src/faction-identity.js';
import {PLANET_ENEMIES} from '../src/planet-enemies.js';

test('all planetary palettes survive late multi-material attachment and sibling disposal',()=>{
 const saved={document:globalThis.document,window:globalThis.window,performance:globalThis.performance};
 const context=new Proxy({}, {get:()=>()=>{}});let now=0;
 globalThis.document={createElement:()=>({getContext:()=>context})};globalThis.window={innerHeight:720};globalThis.performance={now:()=>now};
 const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),camera=new THREE.PerspectiveCamera(50,1,.1,1000);camera.position.z=30;camera.updateMatrixWorld();
 let textureDisposals=0;texture.addEventListener('dispose',()=>textureDisposals++);
 try{
  for(const [planet,theme] of Object.entries(PLANET_ENEMIES)){
   const source=new THREE.MeshStandardMaterial({color:theme.hull,emissive:theme.glow,map:texture,normalMap:texture,roughness:.43,metalness:.71});
   let sourceDisposals=0;source.addEventListener('dispose',()=>sourceDisposals++);
   const a=new THREE.Group(),b=new THREE.Group();a.userData.planetTheme=b.userData.planetTheme=planet;
   const first=new THREE.Mesh(geometry,source),sibling=new THREE.Mesh(geometry,source);a.add(first);b.add(sibling);
   installFactionIdentity(a);installFactionIdentity(b);a.userData.factionIdentity.update(camera);b.userData.factionIdentity.update(camera);
   const late=new THREE.Mesh(geometry,[source,source]);a.add(late);now+=100;a.userData.factionIdentity.update(camera);
   assert.equal(late.material[0],first.material,planet);assert.equal(late.material[1],first.material,planet);assert.notEqual(first.material,sibling.material,planet);
   for(const material of [first.material,sibling.material,...late.material]){
    assert.equal(material.color.getHex(),theme.hull,planet);assert.equal(material.emissive.getHex(),theme.glow,planet);assert.equal(material.map,texture);assert.equal(material.normalMap,texture);assert.equal(material.roughness,.43);assert.equal(material.metalness,.71);
    const shader={fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader);assert.equal(shader.fragmentShader,'#include <map_fragment>',planet);
   }
   let ownedDisposals=0;first.material.addEventListener('dispose',()=>ownedDisposals++);a.userData.dispose();a.userData.dispose();assert.equal(ownedDisposals,1);assert.equal(sourceDisposals,0);assert.equal(textureDisposals,0);
   b.userData.factionIdentity.update(camera);assert.equal(sibling.material.color.getHex(),theme.hull);b.userData.dispose();source.dispose();
  }
  const root=new THREE.Group(),source=new THREE.MeshStandardMaterial({color:0x3366cc}),mesh=new THREE.Mesh(geometry,source);root.add(mesh);installFactionIdentity(root);root.userData.factionIdentity.update(camera);assert.notEqual(mesh.material.color.getHex(),source.color.getHex());root.userData.dispose();source.dispose();
 }finally{geometry.dispose();texture.dispose();globalThis.document=saved.document;globalThis.window=saved.window;globalThis.performance=saved.performance;}
});
