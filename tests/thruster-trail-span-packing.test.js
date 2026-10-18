import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WebGLAttributes} from '../node_modules/three/src/renderers/webgl/WebGLAttributes.js';
import {ThrusterTrails} from '../src/thruster-trails.js';
import {ThrusterTrails as OriginalTrails} from '../work/dense-optimization-20261017-trails-before.js';

function pair(capacity=32){
 const before=new OriginalTrails(new THREE.Scene(),capacity),after=new ThrusterTrails(new THREE.Scene(),capacity);
 const each=fn=>{fn(before);fn(after);};
 const equal=()=>{
  assert.equal(after.cursor,before.cursor);assert.equal(after.time,before.time);assert.deepEqual(after.tracks,before.tracks);
  for(const name of ['life','maxLife','fade','renderFade','tints','matrices'])assert.deepEqual(after[name],before[name]);
  for(let layer=0;layer<2;layer++){
   const a=after.meshes[layer],b=before.meshes[layer];assert.equal(a.count,b.count);
   for(const key of ['instanceMatrix','instanceColor']){assert.deepEqual(a[key].array,b[key].array);assert.equal(a[key].version,b[key].version);assert.deepEqual(a[key].updateRanges,b[key].updateRanges);}
  }
  assert.deepEqual(after.geometry.attributes.aFade.array,before.geometry.attributes.aFade.array);
  assert.deepEqual(after.geometry.attributes.aFade.updateRanges,before.geometry.attributes.aFade.updateRanges);
 };
 return {before,after,each,equal};
}

function gpuFor(trails){
 const attributes=[trails.meshes[0].instanceMatrix,trails.meshes[1].instanceMatrix,trails.meshes[0].instanceColor,trails.geometry.attributes.aFade];
 let bound,fail=null;const calls=[];
 const gl={FLOAT:5126,createBuffer:()=>({bytes:null}),bindBuffer(type,buffer){bound=buffer;},
  bufferData(type,array){bound.bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice();},
  bufferSubData(type,offset,array,start=0,count=array.length){if(array===fail){fail=null;throw Error('isolated trail upload failure');}bound.bytes.set(new Uint8Array(array.buffer,array.byteOffset+start*array.BYTES_PER_ELEMENT,count*array.BYTES_PER_ELEMENT),offset);calls.push(count*array.BYTES_PER_ELEMENT);},deleteBuffer(){}};
 const gpu=WebGLAttributes(gl);
 return {attributes,calls,upload(){for(const attribute of attributes)gpu.update(attribute,34962);},failOnce(attribute){fail=attribute.array;},visible(){return attributes.map(attribute=>new Float32Array(gpu.get(attribute).buffer.bytes.buffer).slice(0,trails.meshes[0].count*attribute.itemSize));}};
}

function seed(trails,alive){
 trails.cursor=trails.capacity*3+7;
 const transform=new THREE.Object3D();
 for(let i=0;i<trails.capacity;i++){
  trails.maxLife[i]=1+i%3;trails.life[i]=alive(i)?(.25+i%5*.15):0;
  for(let layer=0;layer<2;layer++){transform.position.set(i*1.25,layer*.7,i*-.2);transform.rotation.set(i*.01,layer*.04,i*-.015);transform.scale.set(1+layer*.2,2+i*.03,.5);transform.updateMatrix();transform.matrix.toArray(trails.matrices[layer],i*16);}
  trails.tints.set([i/trails.capacity,.7,1-i/trails.capacity],i*3);
 }
}

test('long live spans and isolated trails match original GPU prefixes through sparse expiry',()=>{
 const p=pair(),originalGPU=gpuFor(p.before),packedGPU=gpuFor(p.after);
 originalGPU.upload();packedGPU.upload();
 const alive=i=>i>=1&&i<=7||i===9||i>=12&&i<=15||i>=18&&i<=20||i===31;
 p.each(t=>seed(t,alive));const sources=p.after.matrices.map(array=>array.slice());
 for(const dt of [0,.12,.16,.4,2]){
  p.each(t=>t.update(dt));p.equal();originalGPU.upload();packedGPU.upload();
  assert.deepEqual(packedGPU.visible(),originalGPU.visible());
  assert.deepEqual(p.after.matrices,sources); // Packing never moves ring-slot sources.
 }
 assert.equal(p.after.meshes[0].count,0);assert.equal(p.after.meshes[1].count,0);
 originalGPU.calls.length=packedGPU.calls.length=0;p.each(t=>t.update(.1));originalGPU.upload();packedGPU.upload();
 assert.deepEqual(packedGPU.calls,[]);assert.deepEqual(originalGPU.calls,[]);
});

test('skipped GPU consumption, upload retry, clear and real producer wrapping retain newest visible trails',()=>{
 const p=pair(16),originalGPU=gpuFor(p.before),packedGPU=gpuFor(p.after);
 originalGPU.upload();packedGPU.upload();p.each(t=>seed(t,i=>i!==0&&i!==8));
 p.each(t=>t.update(0)); // Leave the first compacted range unconsumed.
 p.each(t=>{t.life[2]=0;t.life[10]=0;t.update(.2);t.life[15]=.8;t.update(0);});
 p.equal();originalGPU.upload();packedGPU.upload();assert.deepEqual(packedGPU.visible(),originalGPU.visible());
 p.each(t=>t.update(.1));originalGPU.failOnce(originalGPU.attributes[1]);packedGPU.failOnce(packedGPU.attributes[1]);
 assert.throws(()=>originalGPU.upload(),/isolated trail/);assert.throws(()=>packedGPU.upload(),/isolated trail/);
 p.each(t=>{t.life[3]=0;t.update(.07);});p.equal();originalGPU.upload();packedGPU.upload();assert.deepEqual(packedGPU.visible(),originalGPU.visible());
 p.each(t=>t.clear());p.each(t=>t.update(0));p.equal();assert.equal(p.after.meshes[0].count,0);
 const ship=new THREE.Group(),frame=new THREE.Group(),nozzle=new THREE.Group();ship.add(frame);frame.add(nozzle);ship.userData.engines=[nozzle];nozzle.userData={length:1,radius:.4};ship.scale.set(1.2,.8,1.4);
 for(let i=0;i<42;i++){
  ship.position.set(i*.5,Math.sin(i*.2),0);frame.rotation.y=i*.01;
  p.each(t=>{t.emit(ship,.05,{enemy:true,boost:i%7===0});t.update(.05);});
  if(i%5===0){p.equal();originalGPU.upload();packedGPU.upload();assert.deepEqual(packedGPU.visible(),originalGPU.visible());}
 }
 p.equal();originalGPU.upload();packedGPU.upload();assert.deepEqual(packedGPU.visible(),originalGPU.visible());
 assert.equal(p.after.cursor,41);assert.equal(p.after.meshes[0].count,16);assert.equal(p.after.meshes[0].instanceColor,p.after.meshes[1].instanceColor);
});
