import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {splitBossGeometry} from '../src/segmented-geometry.js';
const parts=()=>{const p=Array.from({length:7},()=>new THREE.Group());[6,0,1,2,3,4,5].forEach((n,i)=>p[n].position.set(i*.1,i*.2,-3+i));return p;};
test('boss sections keep boundary triangles, material groups and original vertex order',()=>{
 const p=parts(),g=new THREE.BufferGeometry(),zs=[-3,-2.5,-2.49,0,3],positions=zs.flatMap(z=>[1,2,z,3,4,z,5,6,z]);
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(zs.flatMap((z,i)=>[i,1,i,2,i,3]),2));g.addGroup(0,6,0);g.addGroup(6,9,1);
 const m=[new THREE.MeshStandardMaterial(),new THREE.MeshStandardMaterial()],before=Array.from(g.attributes.position.array),out=splitBossGeometry(g,m,p);
 assert.deepEqual(out.map(s=>p.indexOf(s.part)),[6,0,2,5]);assert.deepEqual(out.map(s=>s.geometry.attributes.position.count),[6,3,3,3]);assert.equal(out[0].material,m[0]);assert.ok(out.slice(1).every(s=>s.material===m[1]));
 for(const s of out){assert.equal(s.geometry.attributes.uv.count,s.geometry.attributes.position.count);assert.ok(Number.isFinite(s.geometry.boundingSphere.radius));}
 assert.deepEqual(Array.from(g.attributes.position.array),before);out.forEach(s=>s.geometry.dispose());g.dispose();m.forEach(s=>s.dispose());
});
test('normalized and interleaved attributes retain decoded float values and borrowed ownership',()=>{
 const p=parts(),g=new THREE.BufferGeometry(),a=new THREE.InterleavedBuffer(new Float32Array([1,2,-3,9,3,4,-3,8,5,6,-3,7]),4);
 g.setAttribute('position',new THREE.InterleavedBufferAttribute(a,3,0));g.setAttribute('weight',new THREE.BufferAttribute(new Uint8Array([0,128,255]),1,true));g.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0],3));
 const m=new THREE.MeshStandardMaterial();let sourceDisposed=0,materialDisposed=0;g.addEventListener('dispose',()=>sourceDisposed++);m.addEventListener('dispose',()=>materialDisposed++);
 const out=splitBossGeometry(g,m,p);assert.equal(out.length,1);assert.equal(out[0].part,p[6]);assert.deepEqual(Array.from(out[0].geometry.attributes.position.array),[1,2,0,3,4,0,5,6,0]);assert.deepEqual(Array.from(out[0].geometry.attributes.weight.array),[0,Math.fround(128/255),1]);assert.equal(out[0].geometry.attributes.weight.normalized,false);
 out[0].geometry.dispose();assert.equal(sourceDisposed,0);assert.equal(materialDisposed,0);assert.equal(out[0].material,m);g.dispose();m.dispose();
});
test('a failed output bound calculation releases partial outputs and allows retry',()=>{
 const p=parts(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-3,1,0,-3,0,1,-3,0,0,3,1,0,3,0,1,3],3));const m=new THREE.MeshStandardMaterial();
 const original=THREE.BufferGeometry.prototype.computeBoundingSphere,dispose=THREE.BufferGeometry.prototype.dispose;let calls=0,released=0;
 THREE.BufferGeometry.prototype.computeBoundingSphere=function(){if(++calls===2)throw Error('controlled output failure');return original.call(this);};THREE.BufferGeometry.prototype.dispose=function(){if(this!==g)released++;return dispose.call(this);};
 try{assert.throws(()=>splitBossGeometry(g,m,p),/controlled output failure/);assert.equal(released,2);}finally{THREE.BufferGeometry.prototype.computeBoundingSphere=original;THREE.BufferGeometry.prototype.dispose=dispose;}
 const out=splitBossGeometry(g,m,p);assert.equal(out.length,2);out.forEach(s=>s.geometry.dispose());g.dispose();m.dispose();
});
