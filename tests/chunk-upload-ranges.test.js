import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';import {WebGLAttributes} from '../node_modules/three/src/renderers/webgl/WebGLAttributes.js';import {Effects} from '../src/effects.js';

test('chunk GPU matrices retain initial hiding, live transforms and final hiding through skipped draws, wrap, clear and retry',()=>{
 const scene=new THREE.Scene(),fx=new Effects(scene),camera=new THREE.PerspectiveCamera(),attr=fx.chunkMesh.instanceMatrix,array=attr.array;
 let bound,fail=false;const calls=[];const gl={FLOAT:5126,createBuffer:()=>({data:null}),bindBuffer(type,buffer){bound=buffer;},bufferData(type,data){bound.data=new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice();},bufferSubData(type,offset,data,start=0,count=data.length){if(fail){fail=false;throw Error('isolated chunk upload failure');}const bytes=new Uint8Array(data.buffer,data.byteOffset+start*data.BYTES_PER_ELEMENT,count*data.BYTES_PER_ELEMENT);bound.data.set(bytes,offset);calls.push({offset,bytes:bytes.byteLength});},deleteBuffer(){}};
 const gpu=WebGLAttributes(gl),upload=()=>gpu.update(attr,34962),tick=(dt,time=dt)=>fx.update(dt,time,camera,720),verifyDraw=()=>{const uploaded=new Float32Array(gpu.get(attr).buffer.data.buffer);for(let i=0;i<fx.chunks.length;i++){if(fx.chunks[i].life>0)assert.deepEqual(uploaded.subarray(i*16,i*16+16),array.subarray(i*16,i*16+16));else for(const j of [0,1,2,4,5,6,8,9,10])assert.equal(Math.abs(uploaded[i*16+j]),0);}};
 upload();tick(0);upload();verifyDraw();assert.deepEqual(calls.splice(0),[{offset:0,bytes:11520}]);const idleVersion=attr.version;tick(.1);upload();verifyDraw();assert.equal(attr.version,idleVersion);assert.equal(calls.length,0);
 fx.explosion(new THREE.Vector3(4,5,6),.5);assert.equal(fx.chunkCursor,2);tick(.1,1);upload();verifyDraw();assert.deepEqual(calls.splice(0),[{offset:0,bytes:128}]);
 const firstMatrix=gpu.get(attr).buffer.data.slice(0,64);tick(0,2);upload();verifyDraw();assert.notDeepEqual(gpu.get(attr).buffer.data.slice(0,64),firstMatrix);assert.deepEqual(calls.splice(0),[{offset:0,bytes:128}]);
 tick(3,5);upload();verifyDraw();assert.deepEqual(calls.splice(0),[{offset:0,bytes:128}]);const expiredVersion=attr.version;tick(.1,6);upload();verifyDraw();assert.equal(attr.version,expiredVersion);assert.equal(calls.length,0);
 fx.explosion(new THREE.Vector3(1,2,3),.5);tick(0,7);fx.explosion(new THREE.Vector3(7,8,9),.5);tick(0,8);upload();verifyDraw();assert.deepEqual(calls.splice(0),[{offset:128,bytes:256}]);
 fx.clear();tick(0,8);fail=true;assert.throws(upload,/isolated chunk upload failure/);tick(0,8);upload();verifyDraw();assert.deepEqual(calls.splice(0),[{offset:128,bytes:256}]);
 // Real explosion producers overwrite the ring, and unconsumed updates stay bounded.
 while(fx.chunkCursor<fx.chunks.length+10){fx.explosion(new THREE.Vector3(fx.chunkCursor,2,3),2);tick(0,9);}assert(fx.chunkCursor>180);assert.equal(attr.updateRanges.length,1);upload();verifyDraw();assert.equal(calls.splice(0)[0].bytes,11520);
 fx.clear();fx.explosion(new THREE.Vector3(8,2,3),.5);tick(0,10);upload();verifyDraw();assert.equal(calls.splice(0)[0].bytes,11520);tick(0,11);upload();verifyDraw();assert.equal(calls.splice(0)[0].bytes,128);
 fx.clear();tick(0,11);upload();verifyDraw();calls.length=0;tick(0,11);upload();verifyDraw();assert.equal(calls.length,0);assert.strictEqual(attr.array,array);assert.equal(fx.chunkMesh.count,180);assert.equal(fx.chunks.length,180);assert.equal(fx.chunkMesh.frustumCulled,false);assert.equal(fx.capacity,5200);
});
