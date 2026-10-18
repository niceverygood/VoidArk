import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WebGLAttributes} from '../node_modules/three/src/renderers/webgl/WebGLAttributes.js';
import {Effects} from '../src/effects.js';

test('particle GPU positions and alpha retain motion, final hiding and pending writes without idle uploads',()=>{
  const fx=new Effects(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
  const attrs=[fx.geometry.attributes.position,fx.geometry.attributes.aAlpha],arrays=attrs.map(a=>a.array);
  let bound,failedAttribute=null;
  const calls=[];
  const gl={FLOAT:5126,createBuffer:()=>({data:null}),bindBuffer(type,buffer){bound=buffer;},
    bufferData(type,array){bound.data=new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice();},
    bufferSubData(type,offset,array,start=0,count=array.length){
      if(array===failedAttribute){failedAttribute=null;throw Error('isolated particle upload failure');}
      const bytes=new Uint8Array(array.buffer,array.byteOffset+start*array.BYTES_PER_ELEMENT,count*array.BYTES_PER_ELEMENT);
      bound.data.set(bytes,offset);calls.push({array,offset,bytes:bytes.byteLength});
    },deleteBuffer(){}};
  const gpu=WebGLAttributes(gl),upload=()=>attrs.forEach(a=>gpu.update(a,34962));
  const tick=(dt,time=dt)=>fx.update(dt,time,camera,720);
  const verify=()=>attrs.forEach(a=>assert.deepEqual(gpu.get(a).buffer.data,new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)));
  const consume=()=>{upload();verify();return calls.splice(0).map(({array,...call})=>({attribute:array===fx.positions?'position':'alpha',...call}));};
  const spawn=(n,life=1,velocity=2)=>fx.particle(new THREE.Vector3(n,2,3),'#abcdef',.5,new THREE.Vector3(velocity,0,0),life,.2);
  const alphaGPU=()=>new Float32Array(gpu.get(attrs[1]).buffer.data.buffer);

  upload();tick(.1);assert.deepEqual(consume(),[]);
  spawn(1);tick(.25);
  assert.equal(fx.positions[0],1.5);assert.equal(fx.alphas[0],.75);
  assert.equal(fx.particles[0].v.x,2*Math.exp(-.05));
  assert.deepEqual(consume(),[{attribute:'position',offset:0,bytes:12},{attribute:'alpha',offset:0,bytes:4}]);
  const versions=attrs.map(a=>a.version);tick(0,99);assert.deepEqual(consume(),[]);assert.deepEqual(attrs.map(a=>a.version),versions);
  tick(.75);assert.equal(fx.alphas[0],0);assert(fx.positions[0]>1.5);
  assert.deepEqual(consume(),[{attribute:'position',offset:0,bytes:12},{attribute:'alpha',offset:0,bytes:4}]);
  assert(alphaGPU().every(a=>a===0));tick(.1);assert.deepEqual(consume(),[]);

  // Pending spawn, motion and expiration ranges accumulate across absent draws.
  spawn(2);tick(.1);spawn(3,.05);tick(.1);tick(0);
  assert.deepEqual(consume(),[{attribute:'position',offset:12,bytes:24},{attribute:'alpha',offset:4,bytes:8}]);
  assert.equal(alphaGPU()[2],0);assert(alphaGPU()[1]>0);
  fx.clear();tick(0);assert.deepEqual(consume(),[{attribute:'alpha',offset:4,bytes:4}]);
  assert(alphaGPU().every(a=>a===0));tick(0);assert.deepEqual(consume(),[]);

  // Stationary particles still fade, but their unchanged positions need no transfer.
  spawn(4,1,0);tick(0);consume();tick(.25);
  assert.deepEqual(consume(),[{attribute:'alpha',offset:12,bytes:4}]);
  fx.clear();spawn(5);tick(0);consume();
  fx.clear();tick(0);failedAttribute=fx.alphas;
  assert.throws(upload,/isolated particle upload failure/);tick(0);
  assert.deepEqual(consume(),[{attribute:'alpha',offset:16,bytes:4}]);assert(alphaGPU().every(a=>a===0));

  // The real producer wraps its original ring; both ends survive one bounded range.
  while(fx.cursor<fx.capacity-1)spawn(fx.cursor,.01);
  tick(.1);consume();spawn(fx.capacity-1);spawn(fx.capacity);tick(0);
  assert.equal(attrs[0].updateRanges.length,1);assert.equal(attrs[1].updateRanges.length,1);
  assert.deepEqual(consume(),[{attribute:'position',offset:0,bytes:62400},{attribute:'alpha',offset:0,bytes:20800}]);
  assert.equal(alphaGPU()[0],1);assert.equal(alphaGPU()[fx.capacity-1],1);
  spawn(fx.capacity+1);tick(.1);failedAttribute=fx.positions;
  assert.throws(upload,/isolated particle upload failure/);tick(.1);consume();
  fx.clear();spawn(fx.capacity+2);tick(0);consume();
  assert.equal(alphaGPU()[2],1);assert.equal(alphaGPU()[0],0);assert.equal(alphaGPU()[fx.capacity-1],0);
  fx.clear();tick(0);consume();tick(.1);assert.deepEqual(consume(),[]);
  assert.equal(fx.capacity,5200);assert.equal(fx.cursor,5203);assert.strictEqual(attrs[0].array,arrays[0]);assert.strictEqual(attrs[1].array,arrays[1]);
});
