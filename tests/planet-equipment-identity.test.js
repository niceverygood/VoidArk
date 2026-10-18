import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {installPlanetEquipmentLOD} from '../src/planet-equipment-lod.js';import {installFactionIdentity} from '../src/faction-identity.js';
test('planet equipment retains its palette and near/far alternatives after identity batching and late attachment',()=>{
 const saved={document:globalThis.document,window:globalThis.window,performance:globalThis.performance};let now=0;
 const context=new Proxy({}, {get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>context})};globalThis.window={innerHeight:720};globalThis.performance={now:()=>now};
 const root=new THREE.Group();root.userData.planetTheme='saturn';const source=new THREE.SphereGeometry(1,32,16),boxes=new THREE.BoxGeometry(.2,.2,.2),material=new THREE.MeshStandardMaterial({color:0x937c54}),mount=new THREE.Group();mount.name='meshy:module-shield';root.add(mount);
 const make=()=>{const mesh=new THREE.Mesh(source,material);mesh.userData.meshy=true;mount.add(mesh);installPlanetEquipmentLOD(mesh,'shield');return mesh;};
 const first=make(),full=first.geometry,low=full.userData.distantLOD;for(let i=0;i<4;i++){const detail=new THREE.Mesh(boxes,material);detail.position.x=i*.3;root.add(detail);}
 let sourceDisposals=0,materialDisposals=0;source.addEventListener('dispose',()=>sourceDisposals++);material.addEventListener('dispose',()=>materialDisposals++);
 const camera=new THREE.PerspectiveCamera(40,1,.1,500);camera.position.z=150;camera.updateMatrixWorld();
 try{
  installFactionIdentity(root);root.userData.factionIdentity.update(camera);assert.equal(first.geometry,low);assert.equal(first.material.color.getHex(),0x937c54);
  now=6000;root.userData.factionIdentity.update(camera);assert.ok(root.children.some(o=>o.userData.proceduralBatch));assert.equal(first.geometry,low);assert.equal(first.visible,true);
  const late=make();now=6100;root.userData.factionIdentity.update(camera);assert.equal(late.geometry,low);assert.equal(late.material,first.material);assert.equal(late.material.color.getHex(),0x937c54);
  camera.position.z=20;camera.updateMatrixWorld();now=7000;root.userData.factionIdentity.update(camera);assert.equal(first.geometry,full);assert.equal(late.geometry,full);
  root.userData.dispose();root.userData.dispose();assert.equal(first.geometry,full);assert.equal(sourceDisposals,0);assert.equal(materialDisposals,0);assert.equal(material.color.getHex(),0x937c54);
 }finally{source.dispose();boxes.dispose();material.dispose();globalThis.document=saved.document;globalThis.window=saved.window;globalThis.performance=saved.performance;}
});
