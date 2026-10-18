import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installFactionIdentity} from '../src/faction-identity.js';

test('identity uses fresh nested matrices, reuses bounds, handles late meshes and retains source ownership',()=>{
 const saved={document:globalThis.document,window:globalThis.window,performance:globalThis.performance};let now=0;
 const context=new Proxy({}, {get:()=>()=>{}});
 globalThis.document={createElement:()=>({width:256,height:80,getContext:()=>context})};globalThis.window={innerHeight:720};globalThis.performance={now:()=>now};
 const source=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry();geometry.computeBoundingSphere();
 let recomputes=0,sourceDisposals=0;const compute=geometry.computeBoundingSphere.bind(geometry);geometry.computeBoundingSphere=()=>{recomputes++;compute();};source.addEventListener('dispose',()=>sourceDisposals++);
 try{
  const scene=new THREE.Scene(),parent=new THREE.Group(),root=new THREE.Group(),nested=new THREE.Group(),mesh=new THREE.Mesh(geometry,source);
  scene.add(parent);parent.add(root);root.add(nested);nested.add(mesh);parent.scale.set(2,3,4);parent.position.set(4,5,6);root.position.set(2,0,1);nested.position.x=3;
  const camera=new THREE.PerspectiveCamera(50,1,.1,1000);camera.position.set(0,30,90);
  installFactionIdentity(root,'enemy');root.getWorldScale=mesh.getWorldScale=()=>{throw new Error('redundant ancestor propagation');};root.getWorldPosition=mesh.getWorldPosition=()=>{throw new Error('redundant ancestor propagation');};
  root.userData.factionIdentity.update(camera);assert.equal(recomputes,0);assert.ok(mesh.position.x===0);assert.notEqual(mesh.material,source);assert.equal(source.color.getHex(),0xffffff);
  const marker=root.children.find(o=>o.isSprite),oldWidth=marker.scale.x;parent.position.z=50;root.userData.factionIdentity.update(camera);assert.notEqual(marker.scale.x,oldWidth);
  const late=new THREE.Mesh(geometry,source);nested.add(late);now=600;root.userData.factionIdentity.update(camera);assert.notEqual(late.material,source);assert.equal(recomputes,0);
  root.userData.dispose();root.userData.dispose();assert.equal(sourceDisposals,0);assert.equal(marker.parent,null);
 }finally{globalThis.document=saved.document;globalThis.window=saved.window;globalThis.performance=saved.performance;geometry.dispose();source.dispose();}
});
