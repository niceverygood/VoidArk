import * as THREE from 'three';

// Only the imported model's internal subtree is fixed. The mount wrapper and
// its animated hull, turret, engine, planet or projectile parent stay dynamic.
export function cacheModelLocalMatrices(root,{animated=false}={}){
 let unsafe=animated;root.traverse(o=>{if(o.isSkinnedMesh||o.isBone||o.morphTargetInfluences?.length)unsafe=true;});
 if(unsafe)return 0;
 let count=0;root.traverse(o=>{if(!o.matrixAutoUpdate)return;o.updateMatrix();o.matrixAutoUpdate=false;o.userData.cachedModelLocal=true;count++;});return count;
}

// Opt-in diagnostic, never used by the normal frame loop. Compose all automatic
// locals once, then measure native world propagation without composing twice.
// Local timing includes traversal/counting; it is not a precision per-call timer.
export function probeWorldMatrices(root){
 const started=performance.now();let nodes=0,automatic=0,importedAutomatic=0,cached=0;
 root.traverse(o=>{nodes++;if(o.userData.cachedModelLocal)cached++;if(o.matrixAutoUpdate){automatic++;if(o.userData.meshy)importedAutomatic++;o.updateMatrix();}});
 const composed=performance.now(),original=THREE.Object3D.prototype.updateMatrix;
 try{THREE.Object3D.prototype.updateMatrix=function(){};root.updateMatrixWorld();}
 finally{THREE.Object3D.prototype.updateMatrix=original;}
 const propagated=performance.now();return {nodes,automatic,importedAutomatic,cached,localMs:composed-started,worldMs:propagated-composed,totalMs:propagated-started};
}

// Same-scene A/B diagnostic: toggle only the locals we explicitly cached.
// Alternate order, leave all transforms/visibility unchanged and restore flags.
export function compareMatrixCache(root,repeats=12){
 const nodes=[];root.traverse(o=>{if(o.userData.cachedModelLocal)nodes.push([o,o.matrixAutoUpdate]);});
 const samples=[],measure=enabled=>{for(const [o] of nodes)o.matrixAutoUpdate=!enabled;return probeWorldMatrices(root);};
 try{for(let i=0;i<repeats;i++){let cached,uncached;if(i%2){cached=measure(true);uncached=measure(false);}else{uncached=measure(false);cached=measure(true);}samples.push({cached,uncached});}}
 finally{for(const [o,automatic] of nodes)o.matrixAutoUpdate=automatic;}
 return {cachedNodes:nodes.length,samples};
}
