import * as THREE from 'three';
import {assetBatchKey} from './asset-instance-batch.js';
// QA-only inspection of Three's already-built render list; never walks or
// changes the scene/materials, and is requested explicitly through ?qa=1.
export function renderSubmissionReport(renderer,scene){
 const list=renderer.renderLists.get(scene,0),groups=new Map(),nativeReasons={},rejected={};let items=0,estimatedCalls=0,additiveDoublePass=0;
 for(const queue of ['opaque','transmissive','transparent'])for(const item of list[queue]){
  const o=item.object,m=item.material,two=m.transparent&&m.side===THREE.DoubleSide&&!m.forceSinglePass;
  const eligible=two&&m.blending===THREE.AdditiveBlending;
  const kind=o.userData.engineFlameBatch?'engineBatch':o.userData.assetInstanceBatch?'assetBatch':o.isSprite?'Sprite':o.isPoints?'Points':o.isLine?'Line':o.userData.meshy?'nativeGLB':'nativeMesh';
  if(kind==='nativeMesh'&&m.isMeshStandardMaterial){const reason=o.userData.assetInstanceGroup?'member-native-fallback':assetBatchKey(o)?'eligible-small-group':o.userData.staticBatch?'static-batch-ineligible':o.userData.proceduralBatch?'procedural-ineligible':'not-registered';nativeReasons[reason]=(nativeReasons[reason]||0)+1;}
  if(kind==='nativeMesh'&&o.userData.proceduralBatch&&!assetBatchKey(o)){
   let replaced=false;for(let p=o;p;p=p.parent)if(p.userData.assetReplaced)replaced=true;
   const reason=o.userData.assetReplaced?'replaced-self':replaced?'replaced-ancestor':o.userData.staticBatch&&!o.geometry.userData.isBatch?'static-geometry':o.isSkinnedMesh?'skinned':o.morphTargetInfluences?'morph':m.isMeshPhysicalMaterial?'physical':m.transparent?'transparent':o.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender?'custom-render':m.stencilWrite?'stencil':m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile&&m.customProgramCacheKey()!=='hostile-hull-identification-v1'?'custom-compile':'other';
   if(!rejected[reason]){const ancestors=[];for(let p=o;p;p=p.parent)ancestors.push({name:p.name,type:p.type,visible:p.visible,replaced:!!p.userData.assetReplaced,meshy:!!p.userData.meshy});rejected[reason]={count:0,example:{name:o.name,geometry:o.geometry.type,shaderKey:m.customProgramCacheKey(),morph:o.morphTargetInfluences,sourceBatch:o.userData.staticBatch,geometryBatch:o.geometry.userData.isBatch,ancestors}};}rejected[reason].count++;
  }
  const key=[queue,kind,m.type,m.blending,m.side,two?'doublePass':'singlePass'].join('|');
  if(!groups.has(key))groups.set(key,{queue,kind,material:m.type,blending:m.blending,side:m.side,doublePass:two,items:0,estimatedCalls:0,examples:[]});
  const row=groups.get(key);row.items++;row.estimatedCalls+=two?2:1;if(row.examples.length<4)row.examples.push({name:o.name,geometry:item.geometry.type,opacity:m.opacity,instances:o.count??1});
  items++;estimatedCalls+=two?2:1;if(eligible)additiveDoublePass++;
 }
 return {items,estimatedCalls,additiveDoublePass,nativeReasons,rejected,groups:[...groups.values()].sort((a,b)=>b.estimatedCalls-a.estimatedCalls)};
}
