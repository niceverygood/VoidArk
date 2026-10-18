import * as THREE from 'three';

// Same MeshBasic color/alpha/depth pipeline as the source effects. Source
// meshes remain the CPU truth; only additive sphere/ring submission is shared.
export function createSimpleEffectMesh(geometry,capacity){
 const alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('aEffectOpacity',alpha);
 const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aEffectOpacity;varying float vEffectOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEffectOpacity=aEffectOpacity;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vEffectOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vEffectOpacity;');
 };
 material.customProgramCacheKey=()=> 'simple-effect-instanced-opacity-v1';
 const mesh=new THREE.InstancedMesh(geometry,material,capacity);
 mesh.name='combat-simple-effect-batch';mesh.userData.simpleEffectBatch=true;mesh.frustumCulled=false;
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.setColorAt(0,new THREE.Color(0xffffff));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
 mesh.count=0;mesh.matrixAutoUpdate=false;return mesh;
}
const upload=(a,count)=>{if(!count)return;const old=a.updateRanges[0];if(old){old.count=Math.max(old.start+old.count,count);old.start=0;}else a.addUpdateRange(0,count);a.needsUpdate=true;};
export class SimpleEffectBatch{
 constructor(scene,sphere,ring,capacity=128){
  this.scene=scene;this.enabled=true;this.sphereGeometry=sphere;this.ringGeometry=ring;
  this.meshes=[createSimpleEffectMesh(sphere.clone(),capacity),createSimpleEffectMesh(ring.clone(),capacity)];
  for(const mesh of this.meshes){mesh.visible=false;scene.add(mesh);}
 }
 accepts(item){return (item.kind==='sphere'||item.kind==='ring')&&item.mat?.isMeshBasicMaterial&&item.mat.blending===THREE.AdditiveBlending&&(item.mesh.geometry===this.sphereGeometry||item.mesh.geometry===this.ringGeometry);}
 add(item){if(!this.accepts(item))return;item.simpleBatched=true;if(this.enabled)item.mesh.removeFromParent();}
 update(items){
  let sphere=0,ring=0;
  for(const item of items){
   if(!item.simpleBatched)continue;
   if(!this.enabled){if(item.mesh.parent!==this.scene)this.scene.add(item.mesh);continue;}
   if(item.mesh.parent)item.mesh.removeFromParent();
   if(!item.mesh.visible)continue;
   const index=item.mesh.geometry===this.sphereGeometry?0:1,mesh=this.meshes[index],slot=index===0?sphere++:ring++;
   item.mesh.updateMatrix();mesh.setMatrixAt(slot,item.mesh.matrix);mesh.setColorAt(slot,item.mat.color);
   mesh.geometry.attributes.aEffectOpacity.array[slot]=item.mat.opacity;
  }
  for(let i=0;i<2;i++){
   const mesh=this.meshes[i],count=this.enabled?(i===0?sphere:ring):0;
   mesh.count=count;mesh.visible=count>0;upload(mesh.instanceMatrix,count*16);upload(mesh.instanceColor,count*3);upload(mesh.geometry.attributes.aEffectOpacity,count);
  }
 }
 setEnabled(enabled,items){this.enabled=!!enabled;this.update(items);}
 clear(){for(const mesh of this.meshes){mesh.count=0;mesh.visible=false;}}
 dispose(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}}
}
