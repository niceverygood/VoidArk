import {propagateVisibleMatrices,propagateVisibleMatricesHoisted} from './hidden-world-matrices.js';
import * as THREE from 'three';
import {bindAssetBatchScene,unbindAssetBatchScene} from './asset-batch-events.js';

// Keep the original GLB transform hierarchy, animations, LOD and visibility.
// Only the GPU submission of identical opaque meshes is shared. The asset pool
// retains ownership of geometry/textures; this class owns instance buffers/materials.
const numeric=['opacity','roughness','metalness','emissiveIntensity','envMapIntensity','side','alphaTest','depthTest','depthWrite','flatShading','vertexColors','normalMapType','wireframe'];
const maps=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','alphaMap','bumpMap','displacementMap','envMap','lightMap'];
function nativeNormalRequired(matrix){const e=matrix.elements,a=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],b=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],c=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];if(a*b*c<1e-18)return true;const xy=e[0]*e[4]+e[1]*e[5]+e[2]*e[6],xz=e[0]*e[8]+e[1]*e[9]+e[2]*e[10],yz=e[4]*e[8]+e[5]*e[9]+e[6]*e[10];return xy*xy>a*b*1e-12||xz*xz>a*c*1e-12||yz*yz>b*c*1e-12||e[0]*(e[5]*e[10]-e[6]*e[9])-e[4]*(e[1]*e[10]-e[2]*e[9])+e[8]*(e[1]*e[6]-e[2]*e[5])<0;}
export function assetBatchKey(mesh,proceduralEnabled=true){
 const m=mesh.material;
 const procedural=!mesh.userData.meshy&&mesh.userData.proceduralBatch&&proceduralEnabled;
 if(procedural){if(mesh.userData.staticBatch&&!mesh.geometry?.userData.isBatch)return null;for(let p=mesh;p;p=p.parent)if(p.userData.assetReplaced)return null;}
 if((!mesh.userData.meshy&&!procedural)||!mesh.isMesh||mesh.isSkinnedMesh||mesh.morphTargetInfluences||Array.isArray(m)||!m?.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.transparent||m.clippingPlanes?.length||mesh.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender)return null;
 if(procedural&&(m.stencilWrite||(m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile&&m.customProgramCacheKey()!=='hostile-hull-identification-v1')))return null;
 return [procedural?'procedural':'GLB',mesh.geometry.uuid,procedural?'compatible':m.userData.meshyBatchSource||m.uuid,m.customProgramCacheKey(),m.color.getHexString(),m.emissive.getHexString(),m.normalScale.toArray().join(','),...numeric.map(k=>m[k]),...maps.map(k=>m[k]?.uuid||''),mesh.renderOrder,mesh.receiveShadow,m.opacity,m.fog,m.colorWrite,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.alphaHash,m.premultipliedAlpha,m.stencilWrite].join('|');
}
export class AssetInstanceBatch {
 constructor(scene){
  this.scene=scene;this.groups=new Map();this.buckets=new Map();this.candidates=new Map();this.pending=new Set();this.touched=new Set();this.nextRetirement=0;this.inverse=new THREE.Matrix4();this.matrix=new THREE.Matrix4();this.timings={};
  this.allocations=0;this.releases=0;this.grows=0;this.added=0;this.returned=0;this.stats={groups:0,instances:0,savedCalls:0};
  this.camera=null;this.hoistHiddenWorldGuards=true;this.cullingEnabled=true;this.proceduralEnabled=true;this.craftCullingEnabled=true;this.frustum=new THREE.Frustum();this.projection=new THREE.Matrix4();this.sphere=new THREE.Sphere();this.visibility=new WeakMap();this.craftVisibility=new WeakMap();this.visibilityEpoch=0;
  this.eventMs=0;this.treeVisits=0;this.keyComputations=0;this.registrations=0;this.removals=0;this.fullSceneScans=1;this.auditScans=0;
  this.onAdded=e=>{if(!e.child.userData.assetInstanceBatch)this.registerTree(e.child);};
  this.onRemoved=e=>{if(!e.child.userData.assetInstanceBatch)this.unregisterTree(e.child);};
  this.onMeshRemoved=e=>this.unregisterTree(e.target);
  bindAssetBatchScene(scene,this);scene.addEventListener('childadded',this.onAdded);scene.addEventListener('childremoved',this.onRemoved);
  this.registerTree(scene); // One bootstrap scan; subsequent visits are changed branches only.
 }
 registerTree(root){
  const started=performance.now();root.traverse(o=>{this.treeVisits++;if(o.userData.assetInstanceBatch||!o.isMesh||this.candidates.has(o))return;
   if(!o.userData.meshy&&!o.userData.proceduralBatch){let craft=o.parent;while(craft&&!craft.userData.visualRoot)craft=craft.parent;if(craft&&o.material?.isMeshStandardMaterial&&!o.material.transparent&&!o.userData.staticBatch)o.userData.proceduralBatch=true;}
   if(!o.userData.meshy&&!o.userData.proceduralBatch)return;
   this.candidates.set(o,{key:null});this.pending.add(o);o.addEventListener('removed',this.onMeshRemoved);this.registrations++;
  });this.eventMs+=performance.now()-started;
 }
 unregisterTree(root){
  const started=performance.now();root.traverse(o=>{this.treeVisits++;const state=this.candidates.get(o);if(!state)return;
   this.removeFromBucket(o,state.key);this.candidates.delete(o);this.pending.delete(o);o.removeEventListener('removed',this.onMeshRemoved);this.removals++;
  });this.eventMs+=performance.now()-started;
 }
 markTree(root){
  const started=performance.now();root.traverse(o=>{this.treeVisits++;if(this.candidates.has(o))this.pending.add(o);});this.eventMs+=performance.now()-started;
 }
 removeFromBucket(object,key){
  if(key===null)return;this.buckets.get(key)?.delete(object);this.touched.add(key);
  const group=this.groups.get(key),entry=group?.members.get(object);if(entry)this.returnSlot(group,object,entry);
 }
 makeMesh(original,material,capacity){
  const mesh=new THREE.InstancedMesh(original.geometry,material,capacity);mesh.userData.assetInstanceBatch=true;mesh.userData.proceduralInstanceBatch=!!original.userData.proceduralBatch&&!original.userData.meshy;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.renderOrder=original.renderOrder;mesh.receiveShadow=original.receiveShadow;mesh.castShadow=original.castShadow;mesh.count=0;
  // It has no local animation. Its parent scene can still move.
  mesh.matrixAutoUpdate=false;this.scene.add(mesh);mesh.matrixWorld.copy(this.scene.matrixWorld);this.allocations++;return mesh;
 }
 capacityFor(count){return 2**Math.ceil(Math.log2(Math.max(8,count)));}
 createGroup(original,count){
  const material=original.material.clone();material.userData.meshyBatchSource=original.material.userData.meshyBatchSource||original.material.uuid;material.onBeforeCompile=original.material.onBeforeCompile;material.customProgramCacheKey=original.material.customProgramCacheKey.bind(original.material);
  const capacity=this.capacityFor(count);
  return {mesh:this.makeMesh(original,material,capacity),material,capacity,members:new Map(),visible:[],emptySince:null};
 }
 hideSlot(group,entry){
  if(entry.slot<0)return;const slot=entry.slot,last=group.visible.pop();
  if(last!==entry){group.visible[slot]=last;last.slot=slot;last.dirty=true;}
  entry.slot=-1;
 }
 returnSlot(group,object,entry){
  this.hideSlot(group,entry);
  if(object.userData.assetInstanceGroup===group){object.layers.mask=entry.mask;delete object.userData.assetInstanceGroup;}
  group.members.delete(object);this.returned++;
 }
 release(group){
  for(const [object,entry] of group.members)this.returnSlot(group,object,entry);
  group.mesh.removeFromParent();group.mesh.dispose();group.material.dispose();this.releases++;
 }
 flushChanges(now){
  const start=performance.now();let classified=0;
  for(const object of this.pending){const state=this.candidates.get(object);if(!state)continue;classified++;this.keyComputations++;const key=assetBatchKey(object,this.proceduralEnabled);if(state.key===key)continue;
   this.removeFromBucket(object,state.key);state.key=key;
   if(key!==null){let parts=this.buckets.get(key);if(!parts)this.buckets.set(key,parts=new Set());parts.add(object);this.touched.add(key);}
  }
  this.pending.clear();const scanned=performance.now();this.timings.batchSearch=scanned-start;
  for(const key of this.touched){const parts=this.buckets.get(key);
   if(!parts?.size){this.buckets.delete(key);const group=this.groups.get(key);if(group)group.emptySince??=now;continue;}
   let group=this.groups.get(key);if(!group){if(parts.size<3)continue;group=this.createGroup(parts.values().next().value,parts.size);this.groups.set(key,group);}
   group.emptySince=null;
   if(parts.size>group.capacity){
    const old=group.mesh;group.capacity=this.capacityFor(parts.size);group.mesh=this.makeMesh(parts.values().next().value,group.material,group.capacity);
    old.removeFromParent();old.dispose();this.grows++;for(const entry of group.members.values())entry.dirty=true;
   }
   for(const object of parts)if(!group.members.has(object)){
    // A material/LOD change can move a mesh between groups. All removals run first.
    let craft=null;if(object.userData.proceduralBatch&&!object.userData.meshy){craft=object.parent;while(craft&&!craft.userData.factionIdentity?.lod)craft=craft.parent;}
    const entry={object,craft,mask:object.layers.mask,slot:-1,matrix:new THREE.Matrix4(),dirty:true};
    group.members.set(object,entry);object.layers.disable(0);object.userData.assetInstanceGroup=group;this.added++;
   }
  }
  this.touched.clear();
  // Keep short-lived empty batches warm, but bound their retained GPU buffers.
  if(now>=this.nextRetirement){this.nextRetirement=now+500;const idle=[...this.groups].filter(([,g])=>g.emptySince!==null).sort((a,b)=>a[1].emptySince-b[1].emptySince);
   for(let i=0;i<idle.length;i++)if(i<idle.length-32||now-idle[i][1].emptySince>=3000){this.release(idle[i][1]);this.groups.delete(idle[i][0]);}
  }
  this.timings.batchBuffers=performance.now()-scanned;return classified;
 }
 // Camera selection rewrites compact GPU slots only; world transforms and asset
 // membership are prepared once. A subview restores the primary selection.
 setCullingEnabled(value){this.cullingEnabled=!!value;}
 setProceduralEnabled(value){value=!!value;if(this.proceduralEnabled===value)return;this.proceduralEnabled=value;for(const o of this.candidates.keys())if(o.userData.proceduralBatch&&!o.userData.meshy)this.pending.add(o);}
 setCraftCullingEnabled(value){this.craftCullingEnabled=!!value;}
 craftInFrustum(root){
  if(!root)return true;const cached=this.craftVisibility.get(root);if(cached?.epoch===this.visibilityEpoch)return cached.visible;
  const lod=root.userData.factionIdentity?.lod;if(!lod)return true;const e=root.matrixWorld.elements,one=Math.max(Math.abs(e[0])+Math.abs(e[1])+Math.abs(e[2]),Math.abs(e[4])+Math.abs(e[5])+Math.abs(e[6]),Math.abs(e[8])+Math.abs(e[9])+Math.abs(e[10])),infinity=Math.max(Math.abs(e[0])+Math.abs(e[4])+Math.abs(e[8]),Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]),Math.abs(e[2])+Math.abs(e[6])+Math.abs(e[10]));
  // LOD bounds cover the full restored craft. Extra radius allows its existing
  // rotating joints, escort bob and core pulse; each retained mesh still has
  // its own exact conservative sphere test below.
  this.sphere.center.setFromMatrixPosition(root.matrixWorld);this.sphere.radius=(lod.radius*2+10)*Math.sqrt(one*infinity);const visible=!Number.isFinite(this.sphere.radius)||this.frustum.intersectsSphere(this.sphere);
  if(cached){cached.epoch=this.visibilityEpoch;cached.visible=visible;}else this.craftVisibility.set(root,{epoch:this.visibilityEpoch,visible});return visible;
 }
 visibleInScene(object){
  const cached=this.visibility.get(object);if(cached?.epoch===this.visibilityEpoch)return cached.visible;
  const visible=object===this.scene?object.visible:!!object.parent&&object.visible&&this.visibleInScene(object.parent);
  if(cached){cached.epoch=this.visibilityEpoch;cached.visible=visible;}else this.visibility.set(object,{epoch:this.visibilityEpoch,visible});return visible;
 }
 inFrustum(object){
  if(!object.frustumCulled||object.material.displacementMap)return true;
  const geometry=object.geometry;if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  const sphere=geometry.boundingSphere;if(!sphere||!Number.isFinite(sphere.radius))return true;
  // sqrt(||A||1 * ||A||infinity) bounds the spectral norm even when nested
  // nonuniform scales introduce shear. A small pad covers float roundoff.
  const e=object.matrixWorld.elements;
  const one=Math.max(Math.abs(e[0])+Math.abs(e[1])+Math.abs(e[2]),Math.abs(e[4])+Math.abs(e[5])+Math.abs(e[6]),Math.abs(e[8])+Math.abs(e[9])+Math.abs(e[10]));
  const infinity=Math.max(Math.abs(e[0])+Math.abs(e[4])+Math.abs(e[8]),Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]),Math.abs(e[2])+Math.abs(e[6])+Math.abs(e[10]));
  this.sphere.center.copy(sphere.center).applyMatrix4(object.matrixWorld);
  this.sphere.radius=sphere.radius*Math.sqrt(one*infinity)*1.02+.03;
  return this.frustum.intersectsSphere(this.sphere);
 }
 selectCamera(camera=null){
  const selecting=performance.now();this.camera=camera;this.visibilityEpoch++;if(camera){camera.updateMatrixWorld();this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);}
  const writing=performance.now();this.inverse.copy(this.scene.matrixWorld).invert();let instances=0,savedCalls=0,capacity=0,uploads=0,activeGroups=0,tested=0,culled=0,bufferBytes=0,cullMs=0;
  const culling=this.cullingEnabled&&!!camera;
  for(const group of this.groups.values()){
   const boundsStart=performance.now();
   for(const [object,entry] of group.members){
    if(group.mesh.userData.proceduralInstanceBatch)object.layers.disable(0);
    if(culling&&this.craftCullingEnabled&&entry.craft&&object.frustumCulled&&!object.material.displacementMap&&!this.craftInFrustum(entry.craft)){tested++;culled++;this.hideSlot(group,entry);continue;}
    // Terminal members are visited once per selection; only their ancestors
    // reuse visibility results. Nonleaf meshes retain their own parent cache.
    const visible=!!(entry.mask&1)&&(!camera||!!(camera.layers.mask&1))&&(object.children.length?this.visibleInScene(object):!!object.parent&&object.visible&&this.visibleInScene(object.parent));
    if(!visible){this.hideSlot(group,entry);continue;}
    // Three's instanced normal transform assumes orthogonal positive columns.
    // Keep reflected/sheared/singular craft parts native instead of changing
    // lighting or winding. Camera restoration also restores this layer state.
    if(group.mesh.userData.proceduralInstanceBatch&&nativeNormalRequired(object.matrixWorld)){object.layers.mask=entry.mask;this.hideSlot(group,entry);continue;}
    if(culling){tested++;if(!this.inFrustum(object)){culled++;this.hideSlot(group,entry);continue;}}
    if(entry.slot<0){entry.slot=group.visible.length;group.visible.push(entry);entry.dirty=true;}
   }
   cullMs+=performance.now()-boundsStart;const attribute=group.mesh.instanceMatrix;attribute.clearUpdateRanges();let first=Infinity,last=-1;
   for(const entry of group.visible){
    this.matrix.multiplyMatrices(this.inverse,entry.object.matrixWorld);
    if(entry.dirty||!entry.matrix.equals(this.matrix)){group.mesh.setMatrixAt(entry.slot,this.matrix);entry.matrix.copy(this.matrix);entry.dirty=false;first=Math.min(first,entry.slot);last=Math.max(last,entry.slot);uploads++;}
   }
   const count=group.visible.length;group.mesh.count=count;group.mesh.visible=count>0;group.mesh.matrixWorld.copy(this.scene.matrixWorld);
   if(last>=0){attribute.addUpdateRange(first*16,(last-first+1)*16);attribute.needsUpdate=true;}
   instances+=count;savedCalls+=Math.max(0,count-1);capacity+=group.capacity;bufferBytes+=attribute.array.byteLength;if(count)activeGroups++;
  }
  this.timings.batchInstances=performance.now()-writing;
  Object.assign(this.stats,{groups:this.groups.size,activeGroups,instances,savedCalls,capacity,bufferBytes,uploads,cullingEnabled:culling,cullTested:tested,culled,cullMs,cameraSelectionMs:performance.now()-selecting,allocations:this.allocations,releases:this.releases,grows:this.grows,added:this.added,returned:this.returned});
 }
 update(now,camera=this.camera){
  this.timings={batchWorld:0,batchSearch:0,batchBuffers:0,batchInstances:0,batchEvents:this.eventMs};this.eventMs=0;const start=performance.now();(this.hoistHiddenWorldGuards?propagateVisibleMatricesHoisted:propagateVisibleMatrices)(this.scene,this.hiddenMatrices??={});this.timings.batchWorld=performance.now()-start;
  const classified=this.flushChanges(now);this.selectCamera(camera);
  Object.assign(this.stats,{matrixVisited:this.hiddenMatrices.visited,matrixDeferred:this.hiddenMatrices.deferred,matrixCustom:this.hiddenMatrices.custom,candidates:this.candidates.size,pending:this.pending.size,classified,keyComputations:this.keyComputations,treeVisits:this.treeVisits,registrations:this.registrations,removals:this.removals,fullSceneScans:this.fullSceneScans,auditScans:this.auditScans});
 }
 // QA-only exhaustive oracle. Never called by normal update or diagnostics.
 audit(){
  this.auditScans++;const expected=new Map(),errors=[];this.scene.traverse(o=>{if(o.userData.assetInstanceBatch)return;const key=assetBatchKey(o,this.proceduralEnabled);if(key!==null)expected.set(o,key);});
  for(const [object,key] of expected){const state=this.candidates.get(object);if(!state)errors.push('missing candidate '+object.uuid);else if(state.key!==key)errors.push('stale key '+object.uuid);
   const group=this.groups.get(key);if(group&&(!group.members.has(object)||object.userData.assetInstanceGroup!==group))errors.push('missing membership '+object.uuid);
   if(!group&&this.buckets.get(key)?.size>=3)errors.push('missing group '+key);
  }
  for(const [object,state] of this.candidates){let parent=object;while(parent&&parent!==this.scene)parent=parent.parent;if(parent!==this.scene)errors.push('detached candidate '+object.uuid);if(state.key!==null&&!expected.has(object))errors.push('ineligible candidate '+object.uuid);}
  const members=new Set();for(const [key,group] of this.groups){
   const renderedKey=assetBatchKey({isMesh:true,userData:{meshy:!group.mesh.userData.proceduralInstanceBatch,proceduralBatch:group.mesh.userData.proceduralInstanceBatch},geometry:group.mesh.geometry,material:group.material,renderOrder:group.mesh.renderOrder,receiveShadow:group.mesh.receiveShadow,onBeforeRender:THREE.Object3D.prototype.onBeforeRender},this.proceduralEnabled);
   if(group.members.size&&renderedKey!==key)errors.push('stale rendered geometry/material '+key);
   for(const [index,entry] of group.visible.entries())if(entry.slot!==index||group.members.get(entry.object)!==entry||index>=group.capacity)errors.push('invalid camera slot');
   for(const object of group.members.keys()){if(members.has(object))errors.push('duplicate membership '+object.uuid);members.add(object);if(expected.get(object)!==key)errors.push('wrong membership '+object.uuid);}
  }
  return {valid:errors.length===0,errors,eligible:expected.size,registered:this.candidates.size,members:members.size,pending:this.pending.size,fullSceneScans:this.fullSceneScans,auditScans:this.auditScans};
 }
 dispose(){
  this.scene.removeEventListener('childadded',this.onAdded);this.scene.removeEventListener('childremoved',this.onRemoved);unbindAssetBatchScene(this.scene,this);
  for(const object of this.candidates.keys())object.removeEventListener('removed',this.onMeshRemoved);
  for(const group of this.groups.values())this.release(group);this.groups.clear();this.candidates.clear();this.pending.clear();this.buckets.clear();this.touched.clear();this.visibility=new WeakMap();this.camera=null;
 }
}
