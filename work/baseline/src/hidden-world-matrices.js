import * as THREE from 'three';
const nativeUpdate = THREE.Object3D.prototype.updateMatrixWorld;

// Opt in only for replaced procedural branches or non-animated LOD meshes.
// Explicit getWorldPosition/updateWorldMatrix calls retain Three's native behavior.
export function markHiddenMatrixBranch(root) {
 let unsafe=false;
 for(let ancestor=root;ancestor;ancestor=ancestor.parent)if(ancestor.userData.meshyAnimated)unsafe=true;
 root.traverse(o=>{if(o.userData.meshyAnimated||o.isBone||o.isSkinnedMesh||o.morphTargetInfluences?.length||o.updateMatrixWorld!==nativeUpdate)unsafe=true;});
 if(!unsafe){
  root.userData.hiddenMatrixBranch=true;
  // Any later structural change invalidates the promise: a newly mounted rig
  // must never be silently frozen under an earlier safe fallback branch.
  const invalidate=()=>{delete root.userData.hiddenMatrixBranch;root.matrixWorldNeedsUpdate=true;};
  root.traverse(o=>o.addEventListener('childadded',invalidate));
 }else delete root.userData.hiddenMatrixBranch;
 return !unsafe;
}

export function propagateVisibleMatrices(root,stats={}) {
 stats.visited=stats.deferred=stats.custom=0;
 function visit(o,force){
  stats.visited++;
  if(o.updateMatrixWorld!==nativeUpdate){stats.custom++;o.updateMatrixWorld(force);return;}
  if(!o.visible&&o.userData.hiddenMatrixBranch){
   // Force all descendants to catch up if the branch becomes visible again.
   o.matrixWorldNeedsUpdate=true;stats.deferred++;return;
  }
  // Native propagation is retained for explicit coordinate queries.
  if(o.matrixAutoUpdate)o.updateMatrix();
  if(o.matrixWorldNeedsUpdate||force){
   if(o.matrixWorldAutoUpdate){if(o.parent===null)o.matrixWorld.copy(o.matrix);else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld,o.matrix);}
   o.matrixWorldNeedsUpdate=false;force=true;
  }
  for(const child of o.children)visit(child,force);
 }
 visit(root,false);return stats;
}

// Keep native/custom/hidden checks in the same order, but avoid a recursive
// call for children that delegate or defer immediately. Live native children
// retain the original matrix arithmetic and live for-of traversal semantics.
export function propagateVisibleMatricesHoisted(root,stats={}) {
 stats.visited=stats.deferred=stats.custom=0;
 function liveNativeBody(o,force){
  if(o.matrixAutoUpdate)o.updateMatrix();
  if(o.matrixWorldNeedsUpdate||force){
   if(o.matrixWorldAutoUpdate){if(o.parent===null)o.matrixWorld.copy(o.matrix);else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld,o.matrix);}
   o.matrixWorldNeedsUpdate=false;force=true;
  }
  for(const child of o.children){
   stats.visited++;
   if(child.updateMatrixWorld!==nativeUpdate){stats.custom++;child.updateMatrixWorld(force);continue;}
   if(!child.visible&&child.userData.hiddenMatrixBranch){child.matrixWorldNeedsUpdate=true;stats.deferred++;continue;}
   liveNativeBody(child,force);
  }
 }
 stats.visited++;
 if(root.updateMatrixWorld!==nativeUpdate){stats.custom++;root.updateMatrixWorld(false);return stats;}
 if(!root.visible&&root.userData.hiddenMatrixBranch){root.matrixWorldNeedsUpdate=true;stats.deferred++;return stats;}
 liveNativeBody(root,false);return stats;
}

// QA only: same scene, alternating order, no simulation advancement or resource edits.
export function compareHiddenMatrices(root,repeats=12){
 let nodes=0,hiddenNodes=0;const visible=[],walk=(o,hidden=false,deferred=false)=>{
  nodes++;hidden||=!o.visible;deferred||=hidden&&!!o.userData.hiddenMatrixBranch;
  if(deferred)hiddenNodes++;if(!hidden)visible.push(o);
  for(const child of o.children)walk(child,hidden,deferred);
 };walk(root);
 const samples=[],stats={},expected=new Map();let mismatches=0;
 for(let i=0;i<repeats;i++){
  const measure=optimized=>{const start=performance.now();if(optimized)propagateVisibleMatrices(root,stats);else root.updateMatrixWorld();return performance.now()-start;};
  let native,selective;if(i%2){selective=measure(true);native=measure(false);}else{native=measure(false);selective=measure(true);}
  root.updateMatrixWorld();for(const o of visible)expected.set(o,o.matrixWorld.clone());
  propagateVisibleMatrices(root,stats);for(const o of visible)if(!o.matrixWorld.equals(expected.get(o)))mismatches++;
  samples.push({nativeMs:native,selectiveMs:selective,...stats});
 }
 return {nodes,hiddenNodes,visibleNodes:visible.length,mismatches,samples};
}

