import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ThrusterTrails} from '../src/thruster-trails.js';

test('packed trails retain both layer transforms, colors and fades through sparse expiry and wrapping',()=>{
 const t=new ThrusterTrails(new THREE.Scene(),5);t.cursor=13;
 for(let i=0;i<5;i++){
  t.maxLife[i]=2;t.life[i]=i%2?0:1;
  for(let k=0;k<16;k++){t.matrices[0][i*16+k]=i*100+k;t.matrices[1][i*16+k]=-i*100-k;}
  for(let k=0;k<3;k++)t.tints[i*3+k]=(i+k)/10;
 }
 const original=Float32Array.prototype.subarray;let views=0;
 try{Float32Array.prototype.subarray=function(...args){views++;return original.apply(this,args);};t.update(.25);}finally{Float32Array.prototype.subarray=original;}
 assert.equal(views,0);assert.equal(t.meshes[0].count,3);assert.equal(t.meshes[1].count,3);
 for(const [slot,source] of [0,2,4].entries()){
  for(let k=0;k<16;k++)for(let layer=0;layer<2;layer++)assert.equal(t.meshes[layer].instanceMatrix.array[slot*16+k],t.matrices[layer][source*16+k]);
  for(let k=0;k<3;k++)assert.equal(t.meshes[0].instanceColor.array[slot*3+k],t.tints[source*3+k]);
  assert.ok(Math.abs(t.renderFade[slot]-Math.pow(.75/2,1.7))<1e-7);
 }
 assert.equal(t.meshes[0].instanceColor,t.meshes[1].instanceColor);
 assert.deepEqual(t.meshes[0].instanceMatrix.updateRanges,[{start:0,count:48}]);
 assert.deepEqual(t.geometry.attributes.aFade.updateRanges,[{start:0,count:3}]);
 const version=t.meshes[0].instanceMatrix.version;t.update(2);assert.equal(t.meshes[0].count,0);assert.equal(t.meshes[0].instanceMatrix.version,version);
 t.clear();assert.equal(t.cursor,0);assert.equal(t.meshes[1].count,0);
});
