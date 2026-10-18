import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {installPlanetEquipmentLOD} from '../src/planet-equipment-lod.js';import {ShipDetailLOD} from '../src/ship-detail-lod.js';
test('planet equipment shares full buffers, restores near detail and releases alternatives with source',()=>{
 for(const role of ['shield','reactor']){
  const source=new THREE.SphereGeometry(1,32,16),material=new THREE.MeshStandardMaterial(),a=new THREE.Mesh(source,material),b=new THREE.Mesh(source,material),root=new THREE.Group(),mount=new THREE.Group();mount.name='meshy:module-'+role;mount.add(a);root.add(mount);installPlanetEquipmentLOD(mount,role);installPlanetEquipmentLOD(b,role);
  const full=a.geometry,low=full.userData.distantLOD;assert.equal(full,b.geometry);assert.equal(full.attributes.position,source.attributes.position);assert.equal(full.index,source.index);assert.equal(source.userData.distantLOD,undefined);assert.ok(low.index.count/3<=32);installPlanetEquipmentLOD(mount,role);assert.equal(a.geometry,full);
  const lod=new ShipDetailLOD(root);lod.rebuild();const camera=new THREE.PerspectiveCamera(40,1,.1,500);camera.position.z=150;camera.updateMatrixWorld();lod.update(camera,480,0);assert.equal(lod.level,'far');assert.equal(a.geometry,low);assert.equal(b.geometry,full);camera.position.z=20;camera.updateMatrixWorld();lod.update(camera,480,1000);assert.equal(a.geometry,full);lod.dispose();
  let fullDisposed=0,lowDisposed=0;full.addEventListener('dispose',()=>fullDisposed++);low.addEventListener('dispose',()=>lowDisposed++);source.dispose();source.dispose();assert.equal(fullDisposed,1);assert.equal(lowDisposed,1);material.dispose();
 }
});
test('reloaded planetary equipment owns new alternatives and leaves unrelated geometry intact',()=>{
 const material=new THREE.MeshStandardMaterial();let prior;
 for(let cycle=0;cycle<8;cycle++){
  const source=new THREE.BoxGeometry(1+cycle,2,3),shield=new THREE.Mesh(source,material),reactor=new THREE.Mesh(source,material),generic=new THREE.Mesh(source,material);
  installPlanetEquipmentLOD(shield,'shield');installPlanetEquipmentLOD(reactor,'reactor');assert.notEqual(shield.geometry,reactor.geometry);assert.notEqual(shield.geometry,prior);assert.equal(generic.geometry,source);assert.equal(shield.geometry.attributes.position,source.attributes.position);
  const low=shield.geometry.userData.distantLOD;low.computeBoundingBox();assert.ok(Math.abs(low.boundingBox.getSize(new THREE.Vector3()).x-(1+cycle))<1e-6);
  let released=0;for(const geometry of [shield.geometry,reactor.geometry,low,reactor.geometry.userData.distantLOD])geometry.addEventListener('dispose',()=>released++);
  prior=shield.geometry;source.dispose();source.dispose();assert.equal(released,4);
 }
 material.dispose();
});

