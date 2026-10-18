import {markHiddenMatrixBranch} from './hidden-world-matrices.js';
import {notifyAssetBatchChanged,notifyAssetBatchAttached} from './asset-batch-events.js';
import {acquireStaticGeometry} from './static-geometry-cache.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
function mergeParts(parts){
 const geometries=parts.map(o=>{
  o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);
  for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
  if(!g.attributes.normal)g.computeVertexNormals();
  if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  return g;
 });
 try{return mergeGeometries(geometries,false);}finally{geometries.forEach(g=>g.dispose());}
}
export function batchStaticDetails(root,{shareGeometry=true}={}){
 const protectedMeshes=new Set([root.userData.core,root.userData.hitFlash,...(root.userData.rotors||[])]),owned=[];
 root.updateWorldMatrix(true,true);const parents=[];root.traverse(p=>{if(p.children?.length)parents.push(p);});
 for(const parent of parents){
  const groups=new Map();
  for(const o of parent.children){
   if(!o.isMesh||o.isSkinnedMesh||o.morphTargetInfluences||!o.visible||o.userData.meshy||o.userData.assetReplaced||o.userData.staticBatch||Array.isArray(o.material)||o.material.transparent||protectedMeshes.has(o))continue;
   let group=groups.get(o.material);if(!group)groups.set(o.material,group=[]);group.push(o);
  }
  for(const [material,parts] of groups){
   if(parts.length<3)continue;
   const lease=acquireStaticGeometry(parts,()=>mergeParts(parts),{shared:shareGeometry});if(!lease)continue;
   const geometry=lease.geometry;geometry.userData.isBatch=true;
   const mesh=new THREE.Mesh(geometry,material);mesh.userData.staticBatch=true;mesh.userData.proceduralBatch=true;parent.add(mesh);notifyAssetBatchAttached(mesh);
   for(const o of parts){o.visible=false;o.userData.staticBatch=true;markHiddenMatrixBranch(o);}
   owned.push({mesh,geometry,lease,parts});
  }
 }
 if(owned.length)notifyAssetBatchChanged(root);
 const retire=item=>{if(item.released)return;item.released=true;item.mesh.removeFromParent();item.lease.release();};
 const release=()=>{for(const item of owned)retire(item);};
 release.refresh=()=>{
  let changed=false;
  for(const item of owned){
   if(item.released||!item.parts.some(p=>p.userData.assetReplaced))continue;
   changed=true;retire(item);
   for(const p of item.parts){p.userData.staticBatch=false;p.visible=!p.userData.assetReplaced;}
  }
  if(changed)notifyAssetBatchChanged(root);
 };
 return release;
}
