import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';import {WebGLAttributes} from '../node_modules/three/src/renderers/webgl/WebGLAttributes.js';
import {Effects} from '../src/effects.js';

test('particle color and size writes survive skipped draws, ring wrap, clear and failed uploads',()=>{
 const scene=new THREE.Scene(),fx=new Effects(scene),camera=new THREE.PerspectiveCamera(),attrs=fx.geometry.attributes,arrays=[fx.colors,fx.sizes,fx.positions,fx.alphas];
 let bound,fail=false;const calls=[];const gl={FLOAT:5126,createBuffer:()=>({data:null}),bindBuffer(type,buffer){bound=buffer;},bufferData(type,array){bound.data=new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice();},bufferSubData(type,offset,array,start=0,count=array.length){if(fail){fail=false;throw Error('isolated upload failure');}const bytes=new Uint8Array(array.buffer,array.byteOffset+start*array.BYTES_PER_ELEMENT,count*array.BYTES_PER_ELEMENT);bound.data.set(bytes,offset);calls.push({array,offset,bytes:bytes.byteLength});},deleteBuffer(){}};
 const gpu=WebGLAttributes(gl),upload=()=>{for(const a of Object.values(attrs))gpu.update(a,34962);},verify=()=>{for(const a of [attrs.color,attrs.aSize])assert.deepEqual(gpu.get(a).buffer.data,new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));},staticCalls=()=>calls.filter(c=>c.array===fx.colors||c.array===fx.sizes),tick=dt=>fx.update(dt,dt,camera,720);
 const spawn=n=>fx.particle(new THREE.Vector3(n,2,3),new THREE.Color((n%100)/100,.4,.7),n%7+.5,new THREE.Vector3(2,0,0),1,.2);
 upload();spawn(0);tick(.1);upload();verify();assert.deepEqual(staticCalls().map(c=>c.bytes),[12,4]);calls.length=0;
 const versions=[attrs.color.version,attrs.aSize.version];tick(.1);upload();verify();assert.deepEqual([attrs.color.version,attrs.aSize.version],versions);assert.equal(staticCalls().length,0);assert.deepEqual(calls.map(c=>c.bytes),[12,4]);calls.length=0;
 // Multiple updates without rendering retain all distinct slot writes.
 spawn(1);tick(0);spawn(2);spawn(3);tick(0);tick(0);upload();verify();assert.deepEqual(staticCalls().map(c=>({offset:c.offset,bytes:c.bytes})),[{offset:12,bytes:36},{offset:4,bytes:12}]);calls.length=0;
 // Expiring and clearing do not edit color/size, or lose their pending writes.
 spawn(4);tick(0);fx.clear();tick(2);upload();verify();assert.deepEqual(staticCalls().map(c=>c.bytes),[12,4]);assert(fx.alphas.every(a=>a===0));calls.length=0;
 for(let i=5;i<fx.capacity-1;i++)spawn(i);tick(0);upload();verify();calls.length=0;
 spawn(fx.capacity-1);spawn(fx.capacity);tick(0);upload();verify();assert.deepEqual(staticCalls().map(c=>c.bytes),[62400,20800]);calls.length=0;
 // A native failure leaves the pending range usable on the next renderer retry.
 spawn(fx.capacity+1);tick(0);fail=true;assert.throws(()=>gpu.update(attrs.color,34962),/isolated upload failure/);tick(0);upload();verify();assert.deepEqual(staticCalls().map(c=>c.bytes),[12,4]);calls.length=0;
 fx.clear();spawn(fx.capacity+2);tick(0);upload();verify();assert.equal(staticCalls().reduce((n,c)=>n+c.bytes,0),16);
 assert.deepEqual([fx.colors,fx.sizes,fx.positions,fx.alphas],arrays);assert.strictEqual(attrs.color.array,arrays[0]);assert.strictEqual(attrs.aSize.array,arrays[1]);assert.equal(fx.capacity,5200);assert.equal(fx.points.geometry,fx.geometry);assert.equal(fx.items.length,0);
});
