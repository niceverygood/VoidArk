import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';import {WebGLAttributes} from '../node_modules/three/src/renderers/webgl/WebGLAttributes.js';
import {ProjectileVisuals} from '../src/projectile-visuals.js';

test('compacted projectile wake streams its drawn prefix through expiry, wrap, empty and reuse',async()=>{
 let releases=0;const scene=new THREE.Scene(),v=new ProjectileVisuals(scene,{acquireAssets:()=>({ready:Promise.resolve([]),release(){releases++;}})});await v.preparationReady;
 let bound;const transferred=[];const gl={FLOAT:5126,createBuffer:()=>({data:null}),bindBuffer(type,buffer){bound=buffer;},bufferData(type,array){bound.data=new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice();},bufferSubData(type,offset,array,start=0,count=array.length){const bytes=new Uint8Array(array.buffer,array.byteOffset+start*array.BYTES_PER_ELEMENT,count*array.BYTES_PER_ELEMENT);bound.data.set(bytes,offset);transferred.push(bytes.byteLength);},deleteBuffer(){}};
 const gpu=WebGLAttributes(gl),attrs=[v.geometry.attributes.aFade,v.mesh.instanceMatrix,v.mesh.instanceColor],arrays=attrs.map(a=>a.array);
 const upload=()=>attrs.forEach(a=>gpu.update(a,34962));const verifyPrefix=()=>attrs.forEach(a=>{const length=v.mesh.count*a.itemSize*a.array.BYTES_PER_ELEMENT;assert.deepEqual(gpu.get(a).buffer.data.subarray(0,length),new Uint8Array(a.array.buffer,a.array.byteOffset,length));});
 const seed=(slot,life)=>{v.life[slot]=life;v.max[slot]=1;new THREE.Matrix4().makeTranslation(slot+1,slot+2,slot+3).toArray(v.matrices,slot*16);v.tints.set([slot*.01,.5,.8],slot*3);};
 upload();v.cursor=4;seed(0,.05);seed(1,1);seed(2,0);seed(3,2);v.tick(.1);assert.equal(v.mesh.count,2);assert.deepEqual([...v.mesh.instanceMatrix.array.subarray(0,16)],[...v.matrices.subarray(16,32)]);assert.deepEqual([...v.mesh.instanceMatrix.array.subarray(16,32)],[...v.matrices.subarray(48,64)]);assert.ok(Math.abs(v.renderAlpha[0]-Math.pow(.9,1.5))<1e-6);upload();verifyPrefix();assert.deepEqual(transferred.splice(0),[8,128,24]);
 seed(0,1);seed(2,1);v.tick(0);assert.equal(v.mesh.count,4);upload();verifyPrefix();assert.deepEqual(transferred.splice(0),[16,256,48]);
 // A smaller tick replaces a larger unconsumed range instead of retaining it.
 seed(0,1);v.tick(0);v.life.fill(0);seed(1,.5);v.tick(0);assert.equal(v.mesh.count,1);assert.deepEqual(attrs.map(a=>a.updateRanges),[[{start:0,count:1}],[{start:0,count:16}],[{start:0,count:3}]]);upload();verifyPrefix();assert.deepEqual(transferred.splice(0),[4,64,12]);
 const versions=attrs.map(a=>a.version);v.life.fill(0);v.tick(.1);assert.equal(v.mesh.count,0);assert.deepEqual(attrs.map(a=>a.version),versions);upload();assert.deepEqual(transferred.splice(0),[]);
 v.cursor=v.capacity+9;seed(0,1);seed(v.capacity-1,1);v.tick(0);assert.equal(v.mesh.count,2);assert.deepEqual([...v.mesh.instanceMatrix.array.subarray(16,32)],[...v.matrices.subarray((v.capacity-1)*16)]);upload();verifyPrefix();assert.deepEqual(transferred.splice(0),[8,128,24]);
 v.clear();v.tick(0);assert.equal(v.mesh.count,0);upload();assert.deepEqual(transferred.splice(0),[]);v.cursor=1;seed(0,1);v.tick(0);upload();verifyPrefix();assert.deepEqual(transferred.splice(0),[4,64,12]);assert(attrs.every((a,i)=>a.array===arrays[i]));
 v.dispose();v.dispose();assert.equal(releases,1);assert.equal(scene.children.length,0);
});
