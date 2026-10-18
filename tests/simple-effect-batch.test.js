import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Effects} from '../src/effects.js';
import {createSimpleEffectMesh} from '../src/simple-effect-batch.js';
const position={x:12,y:-4,z:8};
const close=(actual,expected)=>{assert.equal(actual.length,expected.length);actual.forEach((x,i)=>assert.ok(Math.abs(x-expected[i])<2e-5,`${i}: ${x} vs ${expected[i]}`));};

test('batched flash and shock preserve native geometry, world transforms, color, alpha and billboard',()=>{
 const scene=new THREE.Scene();scene.position.set(10,20,30);scene.rotation.set(.1,.2,.3);scene.scale.set(2,3,4);
 const fx=new Effects(scene),camera=new THREE.PerspectiveCamera();camera.rotation.set(.3,-.5,.7);camera.updateMatrixWorld();
 for(let i=0;i<128;i++){if(i%2)fx.shock({...position,x:i},2+i/10,'#f69a70',1.2,i%3===0);else fx.flash({...position,y:i},3,'#8cffff',1.2);}
 fx.update(.2,1,camera,720);scene.updateMatrixWorld();
 const indices=[0,0],local=new THREE.Matrix4(),world=new THREE.Matrix4(),color=new THREE.Color();
 for(const item of fx.items){assert.equal(item.simpleBatched,true);assert.equal(item.mesh.parent,null);const index=item.kind==='sphere'?0:1,mesh=fx.simpleBatch.meshes[index],slot=indices[index]++;
  mesh.getMatrixAt(slot,local);world.multiplyMatrices(scene.matrixWorld,local);item.mesh.updateMatrix();const expected=new THREE.Matrix4().multiplyMatrices(scene.matrixWorld,item.mesh.matrix);close(world.elements,expected.elements);
  mesh.getColorAt(slot,color);close(color.toArray(),item.mat.color.toArray());assert.ok(Math.abs(mesh.geometry.attributes.aEffectOpacity.array[slot]-item.mat.opacity)<1e-6);
  assert.deepEqual(mesh.geometry.getAttribute('position').array,item.mesh.geometry.getAttribute('position').array);
  assert.equal(mesh.material.blending,item.mat.blending);assert.equal(mesh.material.depthWrite,item.mat.depthWrite);assert.equal(mesh.material.toneMapped,item.mat.toneMapped);
 }
 assert.deepEqual(indices,[64,64]);assert.deepEqual(fx.simpleBatch.meshes.map(m=>m.count),indices);
 fx.setBatchRendering(false);assert.ok(fx.items.every(i=>i.mesh.parent===scene));assert.ok(fx.simpleBatch.meshes.every(m=>m.count===0));
 fx.setBatchRendering(true);assert.ok(fx.items.every(i=>i.mesh.parent===null));assert.deepEqual(fx.simpleBatch.meshes.map(m=>m.count),indices);
 fx.clear();assert.ok(fx.simpleBatch.meshes.every(m=>m.count===0&&!m.visible));
});

test('warning, orbit and shield material stay native; dense recycling still protects warnings and releases source ownership',()=>{
 const scene=new THREE.Scene(),fx=new Effects(scene),camera=new THREE.PerspectiveCamera();fx.warning(position,{x:0,y:0,z:0},2);fx.orbit(position,4,new THREE.Vector3(0,1,0),'#8fffff',2);fx.pulse(position,8);const warning=fx.items[0],orbit=fx.items[1],shield=fx.items[2];
 fx.flash(position,2,'#ffffff',2);const first=fx.items.at(-1);let disposed=0;first.mat.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<300;i++)fx.impact({position,radius:2,damage:35,source:'laser'},{x:0,y:0,z:0});
 fx.update(.01,1,camera,720);assert.ok(fx.items.includes(warning));assert.equal(warning.mesh.parent,scene);assert.equal(disposed,1);assert.equal(fx.items.length,128);
 assert.equal(orbit.simpleBatched,undefined);assert.equal(shield.simpleBatched,undefined);
 assert.ok(fx.simpleBatch.meshes.reduce((n,m)=>n+m.count,0)<=128);assert.ok(fx.simpleBatch.meshes.filter(m=>m.visible).length<=2);
 fx.update(3,4,camera,720);assert.equal(fx.items.length,0);assert.ok(fx.simpleBatch.meshes.every(m=>m.count===0));
});

test('basic effect shader retains Three color/fog output pipeline and multiplies per-instance alpha',()=>{
 const mesh=createSimpleEffectMesh(new THREE.IcosahedronGeometry(1,1),1),shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
 mesh.material.onBeforeCompile(shader);assert.match(shader.vertexShader,/vEffectOpacity=aEffectOpacity/);assert.match(shader.fragmentShader,/diffuseColor.a\*=vEffectOpacity/);assert.match(shader.fragmentShader,/#include <colorspace_fragment>/);assert.match(shader.fragmentShader,/#include <fog_fragment>/);assert.equal(mesh.instanceColor.count,1);
 mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();
});
