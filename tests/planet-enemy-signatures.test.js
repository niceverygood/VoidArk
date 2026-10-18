import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {installPlanetSignature} from '../src/planet-enemy-signatures.js';
const root=()=>{const r=new THREE.Group();r.userData.visualRoot=new THREE.Group();r.add(r.userData.visualRoot);return r;};
test('small Saturn/Uranus hulls get perpendicular recognizable frames with bounded shared geometry',()=>{
 for(const planet of ['saturn','uranus']){const a=root(),b=root(),g=installPlanetSignature(a,planet,'fighter'),h=installPlanetSignature(b,planet,'fighter');assert.equal(g.children.length,2);assert.equal(g.children[0].geometry,h.children[0].geometry);assert.equal(g.children[0].material,h.children[0].material);assert.equal(installPlanetSignature(a,planet,'fighter'),null);assert.equal(a.userData.visualRoot.children.length,1);
 let triangles=0;for(const m of g.children){triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;assert.ok(Array.from(m.geometry.attributes.position.array).every(Number.isFinite));}assert.ok(triangles<=1000);
 const bounds=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());if(planet==='saturn')assert.ok(bounds.x>bounds.y*4&&bounds.z>bounds.y*4);else assert.ok(bounds.y>bounds.x*4&&bounds.z>bounds.x*4);
 g.removeFromParent();assert.ok(h.children[0].geometry.attributes.position.count>0);
 }
});
test('capital/base/boss and other planets preserve their authored hulls without extra frames',()=>{for(const planet of ['saturn','uranus','mercury','mars'])for(const role of ['capital','fortress']){const r=root();assert.equal(installPlanetSignature(r,planet,role),null);assert.equal(r.userData.visualRoot.children.length,0);}const r=root();assert.equal(installPlanetSignature(r,'venus','fighter'),null);});
import {ShipDetailLOD} from '../src/ship-detail-lod.js';
test('far ring retains a closed shared hoop and restores all near lights without mutating another ship',()=>{
 for(const planet of ['saturn','uranus']){const a=root(),b=root(),first=installPlanetSignature(a,planet,'fighter'),other=installPlanetSignature(b,planet,'fighter'),full=first.children[0].geometry,low=full.userData.distantLOD;assert.ok(low);assert.equal(low.index.count/3,256);assert.equal(low,other.children[0].geometry.userData.distantLOD);
 const camera=new THREE.PerspectiveCamera(40,640/480,.1,600);camera.position.set(0,0,200);camera.lookAt(0,0,0);camera.updateMatrixWorld();const lod=new ShipDetailLOD(a);lod.rebuild();lod.update(camera,480,1000);assert.equal(lod.level,'far');assert.equal(first.children[0].geometry,low);assert.equal(first.children[1].visible,false);assert.equal(other.children[0].geometry,full);assert.equal(other.children[1].visible,true);
 camera.position.z=40;camera.updateMatrixWorld();lod.update(camera,480,2000);assert.equal(lod.level,'near');assert.equal(first.children[0].geometry,full);assert.equal(first.children[1].visible,true);lod.dispose();assert.equal(other.children[0].geometry,full);
 }
});
