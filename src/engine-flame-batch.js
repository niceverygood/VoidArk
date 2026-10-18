import * as THREE from 'three';
import {ENGINE_VERTEX,ENGINE_FRAGMENT} from './engine-material.js';
const scenes=new WeakMap();
export function engineFlamesFor(scene){return scenes.get(scene);}
export function notifyEngineFlamesAttached(root){let o=root;while(o&&!o.isScene)o=o.parent;scenes.get(o)?.registerTree(root);}
function keyFor(o){
 const kind=o.userData.engineBatchKind,m=o.material;
 if(!kind||Array.isArray(m)||o.isSkinnedMesh)return null;
 if(kind==='flame'&&(!m.isShaderMaterial||m.vertexShader!==ENGINE_VERTEX||m.fragmentShader!==ENGINE_FRAGMENT))return null;
 if(kind==='hot'&&!m.isMeshBasicMaterial)return null;
 return [kind,o.geometry.uuid,m.side,m.depthTest,m.depthWrite,m.blending,m.toneMapped,o.renderOrder].join('|');
}
// Keep every existing nozzle, animation and material as the source of truth.
// Only its GPU submission is replaced. Additive blending is order independent;
// hot cores retain MeshBasicMaterial's tone mapping and color-space pipeline.
export class EngineFlameBatch {
 constructor(scene){
  this.scene=scene;this.entries=new Map();this.groups=new Map();this.branches=new Map();this.enabled=true;this.camera=null;
  this.inverse=new THREE.Matrix4();this.matrix=new THREE.Matrix4();this.projection=new THREE.Matrix4();this.frustum=new THREE.Frustum();this.sphere=new THREE.Sphere();this.tint=new THREE.Color();
  this.allocations=0;this.releases=0;this.grows=0;this.shrinks=0;this.registrations=0;this.removals=0;this.scans=0;this.nextRetirement=0;this.stats={};
  this.onAdded=e=>{if(!e.child.userData.engineFlameBatch)this.registerTree(e.child);};this.onRemoved=e=>{if(!e.child.userData.engineFlameBatch)this.unregisterTree(e.child);};this.onMeshRemoved=e=>this.unregisterTree(e.target);this.onBranchRemoved=e=>this.unregisterTree(e.target);
  scenes.set(scene,this);scene.addEventListener('childadded',this.onAdded);scene.addEventListener('childremoved',this.onRemoved);this.registerTree(scene);
 }
 registerTree(root){this.scans++;root.traverse(o=>{if(this.entries.has(o)||o.userData.engineFlameBatch)return;const key=keyFor(o);if(!key)return;
  let group=this.groups.get(key);if(!group){group={key,kind:o.userData.engineBatchKind,source:o,members:new Set(),visible:[],mesh:null,geometry:null,material:null,capacity:0,lowSince:null,emptySince:null};this.groups.set(key,group);}
  group.source??=o;
  let branch=o.parent;while(branch&&branch!==this.scene&&branch.name!=='engine-nozzle')branch=branch.parent;if(branch===this.scene)branch=null;
  if(branch){if(!this.branches.has(branch))branch.addEventListener('removed',this.onBranchRemoved);this.branches.set(branch,(this.branches.get(branch)||0)+1);}
  const entry={object:o,group,branch,mask:o.layers.mask,slot:-1,matrix:new THREE.Matrix4(),dirty:true};this.entries.set(o,entry);group.members.add(entry);group.emptySince=null;o.addEventListener('removed',this.onMeshRemoved);if(this.enabled)o.layers.disable(0);this.registrations++;
 });}
 hideSlot(entry){const g=entry.group;if(entry.slot<0)return;const slot=entry.slot,last=g.visible.pop();if(last!==entry){g.visible[slot]=last;last.slot=slot;last.dirty=true;}entry.slot=-1;}
 unregisterTree(root){root.traverse(o=>{const entry=this.entries.get(o);if(!entry)return;this.hideSlot(entry);entry.group.members.delete(entry);if(entry.group.source===o)entry.group.source=entry.group.members.values().next().value?.object||null;if(entry.branch){const n=this.branches.get(entry.branch)-1;if(n)this.branches.set(entry.branch,n);else{entry.branch.removeEventListener('removed',this.onBranchRemoved);this.branches.delete(entry.branch);}}o.layers.mask=entry.mask;o.removeEventListener('removed',this.onMeshRemoved);this.entries.delete(o);this.removals++;});}
 capacityFor(n){return 2**Math.ceil(Math.log2(Math.max(16,n)));}
 makeMaterial(g){const m=g.source.material,flags={side:m.side,depthTest:m.depthTest,depthWrite:m.depthWrite,blending:m.blending,transparent:true,toneMapped:m.toneMapped};
  if(g.kind==='flame')return new THREE.ShaderMaterial({...flags,
   vertexShader:'attribute vec3 aEngineTint;attribute float aEngineTime;attribute float aEngineOpacity;varying vec2 vUv;varying vec3 tint;varying float time;varying float opacity;void main(){vUv=uv;tint=aEngineTint;time=aEngineTime;opacity=aEngineOpacity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:ENGINE_FRAGMENT.replace('uniform vec3 tint;uniform float time;uniform float opacity;','varying vec3 tint;varying float time;varying float opacity;')});
  const material=new THREE.MeshBasicMaterial({...flags,color:0xffffff,opacity:1});
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aEngineOpacity;varying float vEngineOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEngineOpacity=aEngineOpacity;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vEngineOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vEngineOpacity;');};
  material.customProgramCacheKey=()=> 'engine-hot-instanced-v1';return material;
 }
 resize(g,capacity){
  const old=g.mesh;g.material??=this.makeMaterial(g);const geometry=g.source.geometry.clone();
  geometry.setAttribute('aEngineOpacity',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
  if(g.kind==='flame'){geometry.setAttribute('aEngineTint',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('aEngineTime',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));}
  const mesh=new THREE.InstancedMesh(geometry,g.material,capacity);mesh.name='engine-batch:'+g.kind;mesh.userData.engineFlameBatch=true;mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;mesh.renderOrder=g.source.renderOrder;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;
  if(g.kind==='hot'){mesh.setColorAt(0,this.tint.set(0xffffff));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);}
  this.scene.add(mesh);mesh.matrixWorld.copy(this.scene.matrixWorld);if(old){old.removeFromParent();old.dispose();g.geometry.dispose();this.releases++;if(capacity>g.capacity)this.grows++;else this.shrinks++;}
  g.mesh=mesh;g.geometry=geometry;g.capacity=capacity;this.allocations++;for(const e of g.members)e.dirty=true;
 }
 setEnabled(value){this.enabled=!!value;for(const e of this.entries.values()){e.object.layers.mask=e.mask;if(this.enabled)e.object.layers.disable(0);}for(const g of this.groups.values())if(g.mesh)g.mesh.visible=this.enabled&&g.visible.length>0;}
 isVisible(e,camera){const o=e.object;if(!(e.mask&camera.layers.mask))return false;let p=o;while(p&&p!==this.scene){if(!p.visible)return false;p=p.parent;}if(p!==this.scene)return false;
  if(!o.frustumCulled)return true;if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();this.sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);return this.frustum.intersectsSphere(this.sphere);
 }
 update(camera,now=performance.now()){
  this.camera=camera;const start=performance.now();if(!this.enabled){this.stats={...this.stats,enabled:false,calls:0,instances:0,ms:performance.now()-start};return;}
  this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);this.inverse.copy(this.scene.matrixWorld).invert();
  let uploads=0,attributes=0,instances=0,calls=0,capacity=0;
  for(const e of this.entries.values()){if(this.isVisible(e,camera)){if(e.slot<0){e.slot=e.group.visible.length;e.group.visible.push(e);e.dirty=true;}}else this.hideSlot(e);}
  for(const g of this.groups.values()){
   if(!g.members.size){if(g.mesh){g.mesh.count=0;g.mesh.visible=false;}g.emptySince??=now;if(now-g.emptySince>2000){this.release(g);this.groups.delete(g.key);}continue;}
   const count=g.visible.length;if(count>g.capacity)this.resize(g,this.capacityFor(count));
   if(g.mesh&&count<g.capacity/4){g.lowSince??=now;if(now-g.lowSince>5000&&g.capacity>16){this.resize(g,this.capacityFor(count));g.lowSince=null;}}else g.lowSince=null;
   if(!g.mesh)continue;const matrix=g.mesh.instanceMatrix,opacity=g.geometry.attributes.aEngineOpacity;matrix.clearUpdateRanges();for(const a of Object.values(g.geometry.attributes))if(a.isInstancedBufferAttribute)a.clearUpdateRanges();let matrixDirty=false,colorDirty=false,alphaDirty=false,timeDirty=false;
   for(const e of g.visible){const i=e.slot,o=e.object,m=o.material;this.matrix.multiplyMatrices(this.inverse,o.matrixWorld);
    if(e.dirty||!e.matrix.equals(this.matrix)){g.mesh.setMatrixAt(i,this.matrix);e.matrix.copy(this.matrix);matrixDirty=true;uploads++;}
    const alpha=g.kind==='flame'?m.uniforms.opacity.value:m.opacity;if(e.dirty||opacity.array[i]!==Math.fround(alpha)){opacity.array[i]=alpha;alphaDirty=true;attributes++;}
    if(g.kind==='flame'){const tint=g.geometry.attributes.aEngineTint,time=g.geometry.attributes.aEngineTime,c=m.uniforms.tint.value;for(let k=0;k<3;k++){const v=Math.fround(k===0?c.r:k===1?c.g:c.b);if(e.dirty||tint.array[i*3+k]!==v){tint.array[i*3+k]=v;colorDirty=true;attributes++;}}const v=Math.fround(m.uniforms.time.value);if(e.dirty||time.array[i]!==v){time.array[i]=v;timeDirty=true;attributes++;}}
    else{const color=g.mesh.instanceColor,c=m.color;if(e.dirty||color.array[i*3]!==Math.fround(c.r)||color.array[i*3+1]!==Math.fround(c.g)||color.array[i*3+2]!==Math.fround(c.b)){g.mesh.setColorAt(i,c);colorDirty=true;attributes++;}}
    e.dirty=false;
   }
   if(matrixDirty){matrix.addUpdateRange(0,count*16);matrix.needsUpdate=true;}if(alphaDirty){opacity.addUpdateRange(0,count);opacity.needsUpdate=true;}if(colorDirty){const color=g.kind==='flame'?g.geometry.attributes.aEngineTint:g.mesh.instanceColor;color.addUpdateRange(0,count*3);color.needsUpdate=true;}if(timeDirty){g.geometry.attributes.aEngineTime.addUpdateRange(0,count);g.geometry.attributes.aEngineTime.needsUpdate=true;}
   g.mesh.count=count;g.mesh.visible=count>0;g.mesh.matrixWorld.copy(this.scene.matrixWorld);instances+=count;if(count)calls+=g.material.side===THREE.DoubleSide&&!g.material.forceSinglePass?2:1;
  }
  let bufferBytes=0;for(const g of this.groups.values()){capacity+=g.capacity;if(g.mesh){bufferBytes+=g.mesh.instanceMatrix.array.byteLength+(g.mesh.instanceColor?.array.byteLength||0)+(g.geometry.index?.array.byteLength||0);for(const a of Object.values(g.geometry.attributes))bufferBytes+=a.array.byteLength;}}
  this.stats={enabled:true,ms:performance.now()-start,registered:this.entries.size,groups:this.groups.size,calls,instances,savedCalls:Math.max(0,instances-calls),capacity,bufferBytes,uploads,attributes,allocations:this.allocations,releases:this.releases,grows:this.grows,shrinks:this.shrinks,registrations:this.registrations,removals:this.removals,scans:this.scans};
 }
 release(g){g.mesh?.removeFromParent();g.mesh?.dispose();g.geometry?.dispose();g.material?.dispose();this.releases++;}
 audit(){const errors=[];let slots=0;for(const g of this.groups.values()){for(const [i,e] of g.visible.entries()){slots++;if(e.slot!==i||!g.members.has(e)||this.entries.get(e.object)!==e)errors.push('invalid slot');if(!g.mesh||i>=g.capacity)errors.push('invalid capacity');}for(const e of g.members)if(this.entries.get(e.object)!==e)errors.push('stale member');}for(const e of this.entries.values()){let p=e.object;while(p&&p!==this.scene)p=p.parent;if(p!==this.scene)errors.push('detached source');if(this.enabled&&(e.object.layers.mask&1))errors.push('double render');}return {valid:!errors.length,errors,registered:this.entries.size,slots};}
 dispose(){this.scene.removeEventListener('childadded',this.onAdded);this.scene.removeEventListener('childremoved',this.onRemoved);for(const e of this.entries.values()){e.object.layers.mask=e.mask;e.object.removeEventListener('removed',this.onMeshRemoved);}for(const branch of this.branches.keys())branch.removeEventListener('removed',this.onBranchRemoved);for(const g of this.groups.values())this.release(g);this.groups.clear();this.entries.clear();this.branches.clear();if(scenes.get(this.scene)===this)scenes.delete(this.scene);}
}
