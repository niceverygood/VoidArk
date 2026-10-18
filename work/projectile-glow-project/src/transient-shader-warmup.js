import * as THREE from 'three';
import {createWarningMaterial,createOrbitMaterial,createProjectileGlowMaterial} from './transient-combat-materials.js';
import {compileForTarget,createWarmDrawScene,warmDrawSlice} from './sortie-warmup.js';
import {createSimpleEffectMesh} from './simple-effect-batch.js';

// Short-lived warnings/effects dispose their own materials. Keep one owner of
// each program so gaps between effects do not discard and rebuild the program.
export function createTransientShaderWarmup(){
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0)]),createWarningMaterial());line.computeLineDistances();
 const objects=[line,new THREE.Mesh(new THREE.TorusGeometry(1,.018,5,16),createOrbitMaterial('#ffffff')),new THREE.Mesh(new THREE.SphereGeometry(1,8,4),createProjectileGlowMaterial('#ffffff'))];
 const simple=createSimpleEffectMesh(new THREE.IcosahedronGeometry(1,1),1);simple.count=1;simple.geometry.attributes.aEffectOpacity.array[0]=1;objects.push(simple);
 const root=new THREE.Group();for(const object of objects){object.frustumCulled=false;root.add(object);object.updateMatrixWorld();}
 let closed=false,released=false,preparing=0,ready=false;
 function release(){if(!closed||released||preparing)return;released=true;for(const object of objects){object.dispose?.();object.material.dispose();object.geometry.dispose();}root.clear();}
 return {objects,diagnostics:()=>({objects:objects.length,materials:objects.length,preparing,ready,closed,released}),
  async prepare(renderer,camera,scene,target){if(closed)return false;preparing++;try{
   await compileForTarget(renderer,root,camera,scene,target);if(closed)return false;
   // First-use uniforms/log checks also belong to the held preparation phase.
   // Use the actual target/color path; the next warm battlefield replaces it.
   const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
   try{warmDrawSlice(renderer,createWarmDrawScene(scene),camera,objects,0,target,objects.length);}
   finally{renderer.setClearColor(clearColor,clearAlpha);}
   ready=true;return true;
  }finally{preparing--;release();}},
  dispose(){closed=true;release();}
 };
}
