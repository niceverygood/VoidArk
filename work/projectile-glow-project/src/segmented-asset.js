import * as THREE from 'three';
import {mountAsset} from './asset-library.js';
import {notifyAssetBatchAttached,notifyAssetBatchChanged} from './asset-batch-events.js';
import {markHiddenMatrixBranch} from './hidden-world-matrices.js';
import {splitBossGeometry} from './segmented-geometry.js';
// Visual segmentation follows the existing HP-driven boss destruction sequence.
// It does not introduce independent damage or collision regions.
export function mountBossHull(root,frame,nation='y',options={}){
 const parts=root.userData.parts,owned=[];
 mountAsset(root,options.assetId||`nation-${nation}-carrier`,{parent:frame,size:options.size||31,onUnavailable:options.onUnavailable,onReady:instance=>{
  frame.updateMatrixWorld(true);const inverse=frame.matrixWorld.clone().invert();
  instance.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
   try{for(const {geometry:g,material,part} of splitBossGeometry(geometry,mesh.material,parts)){owned.push(g);const slice=new THREE.Mesh(g,material);slice.name='meshy-boss-section';slice.userData.meshy=true;part.add(slice);notifyAssetBatchAttached(slice);}}
   finally{geometry.dispose();}
  });
  instance.visible=false;for(const part of parts)for(const child of part.children)if(child.name==='baked-armor')child.visible=false;
  root.userData.meshyBossSections=owned.length;for(const o of options.hide||[]){o.visible=false;o.userData.assetReplaced=true;markHiddenMatrixBranch(o);notifyAssetBatchChanged(o);}options.onReady?.(instance);
  const previous=root.userData.dispose;let released=false;root.userData.dispose=()=>{if(released)return;released=true;for(const geometry of owned)geometry.dispose();previous?.();};
 }});
}
