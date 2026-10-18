import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {Effects as Before} from '../work/baseline/src/effects.js';import {Effects as After} from '../src/effects.js';
const camera=new THREE.PerspectiveCamera();
function sameVisible(before,after){
 assert.deepEqual(after.chunks,before.chunks);const a=after.chunkMesh.instanceMatrix,b=before.chunkMesh.instanceMatrix;
 assert.equal(a.version,b.version);assert.deepEqual(a.updateRanges,b.updateRanges);
 for(let i=0;i<180;i++){if(after.chunks[i].life>0)assert.deepEqual(a.array.subarray(i*16,i*16+16),b.array.subarray(i*16,i*16+16));else for(const word of [0,1,2,4,5,6,8,9,10])assert.equal(Math.abs(a.array[i*16+word]),0);}
}
test('inactive fragments skip matrix work after initial hiding and still submit activation and final hiding',()=>{
 const pair=[new Before(new THREE.Scene()),new After(new THREE.Scene())];let writes=0;const set=pair[1].chunkMesh.setMatrixAt.bind(pair[1].chunkMesh);pair[1].chunkMesh.setMatrixAt=(...args)=>{writes++;return set(...args);};
 function tick(dt,t,expected){writes=0;for(const fx of pair)fx.update(dt,t,camera,720);sameVisible(...pair);assert.equal(writes,expected);}
 tick(0,0,180);tick(.01,.01,0);
 for(const fx of pair)Object.assign(fx.chunks[83],{life:.15,scale:2});tick(.05,.06,1);tick(.2,.26,1);tick(.01,.27,0);
 for(const fx of pair){fx.chunks[83].life=1;fx.chunks[83].p.set(8,9,10);fx.chunks[83].v.set(1,2,3);}tick(.05,.32,1);
 for(const fx of pair)fx.clear();tick(0,.32,1);tick(0,.32,0);
});
test('visible fragments, wrap-style reuse and pending upload ranges retain native values',()=>{
 const pair=[new Before(new THREE.Scene()),new After(new THREE.Scene())];
 for(let frame=0;frame<120;frame++){
  if(frame%4===0)for(const fx of pair)for(let j=0;j<12;j++){const id=(frame*11+j*13)%180,c=fx.chunks[id];c.life=.03+j*.02;c.scale=.3+j*.1;c.p.set(frame,j,-j);c.v.set(.4,j*.1,-.2);c.r.set(j*.1,j*.2,j*.3);}
  if(frame===31||frame===82)for(const fx of pair)fx.clear();
  for(const fx of pair)fx.update(frame%3===0?0:.016,frame/60,camera,720);sameVisible(...pair);
  if(frame%5===0)for(const fx of pair)fx.chunkMesh.instanceMatrix.clearUpdateRanges();
 }
 for(const fx of pair)fx.update(3,5,camera,720);sameVisible(...pair);
});
