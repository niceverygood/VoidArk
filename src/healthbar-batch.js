import * as THREE from 'three';
import {renderGroupsFor} from './render-scene-index.js';

const batches=new WeakMap();
const nativeBefore=THREE.Object3D.prototype.onBeforeRender,nativeAfter=THREE.Object3D.prototype.onAfterRender;
const nativeMaterialBefore=THREE.Material.prototype.onBeforeRender,nativeCompile=THREE.Material.prototype.onBeforeCompile,nativeKey=THREE.Material.prototype.customProgramCacheKey;
const textureFields=['map','alphaMap','aoMap','lightMap','specularMap','envMap'];
export function healthBarsFor(scene){return batches.get(scene)||null;}
function sceneOf(object){for(let p=object;p;p=p.parent)if(p.isScene)return p;return null;}
function visibleInScene(object,scene){for(let p=object;p;p=p.parent){if(!p.visible)return false;if(p===scene)return true;}return false;}
function patchShader(shader){
 shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute mat4 healthModelView;
attribute float healthOpacity;
flat varying vec3 vHealthColor;
flat varying float vHealthOpacity;`)
  .replace('#include <color_vertex>','#include <color_vertex>\nvHealthColor=instanceColor;\nvHealthOpacity=healthOpacity;')
  .replace('#include <project_vertex>','vec4 mvPosition = healthModelView * vec4( transformed, 1.0 );\ngl_Position = projectionMatrix * mvPosition;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nflat varying vec3 vHealthColor;\nflat varying float vHealthOpacity;')
  .replace('#include <color_fragment>','diffuseColor.rgb *= vHealthColor;\ndiffuseColor.a *= vHealthOpacity;');
}
function makeMesh(transparent,capacity){
 const geometry=new THREE.PlaneGeometry(1,1),view=new THREE.InstancedBufferAttribute(new Float32Array(capacity*16),16).setUsage(THREE.DynamicDrawUsage),alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('healthModelView',view);geometry.setAttribute('healthOpacity',alpha);view.array.set(new THREE.Matrix4().elements);alpha.array[0]=1;
 const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent,opacity:1,depthTest:false,depthWrite:true});
 material.onBeforeCompile=patchShader;material.customProgramCacheKey=()=> 'healthbar-native-basic-view-v1';
 const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=transparent?'healthbar-background-batch':'healthbar-fill-batch';mesh.userData.healthBarBatch=true;mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;mesh.frustumCulled=false;mesh.visible=false;mesh.count=0;
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.setColorAt(0,new THREE.Color(0xffffff));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
 return mesh;
}
function supportedMaterial(material,transparent){
 return material?.isMeshBasicMaterial&&!Array.isArray(material)&&material.type==='MeshBasicMaterial'&&material.precision===null&&(!material.defines||!Object.keys(material.defines).length)&&material.transparent===transparent&&material.blending===THREE.NormalBlending&&material.side===THREE.FrontSide&&material.depthTest===false&&material.depthWrite===true&&material.colorWrite===true&&material.toneMapped===true&&material.fog===true&&!material.vertexColors&&!material.wireframe&&!material.stencilWrite&&!material.clippingPlanes?.length&&!material.alphaTest&&!material.alphaHash&&!material.alphaToCoverage&&!material.premultipliedAlpha&&!material.dithering&&!material.polygonOffset&&!material.transmission&&textureFields.every(name=>!material[name])&&material.onBeforeRender===nativeMaterialBefore&&material.onBeforeCompile===nativeCompile&&material.customProgramCacheKey===nativeKey&&Number.isFinite(material.opacity)&&[material.color.r,material.color.g,material.color.b].every(Number.isFinite);
}
function sameArray(a,b){if(!a||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function supportedMesh(mesh,transparent,reference){
 const geometry=mesh?.geometry;
 return !!mesh?.isMesh&&!mesh.isSkinnedMesh&&!mesh.isInstancedMesh&&mesh.boundingSphere===undefined&&mesh.children.length===0&&mesh.renderOrder===0&&!(mesh.layers.mask&~1)&&!mesh.castShadow&&!mesh.receiveShadow&&!mesh.morphTargetInfluences&&mesh.onBeforeRender===nativeBefore&&mesh.onAfterRender===nativeAfter&&supportedMaterial(mesh.material,transparent)&&geometry?.type==='PlaneGeometry'&&!Object.keys(geometry.morphAttributes).length&&geometry.groups.length===0&&geometry.drawRange.start===0&&geometry.drawRange.count===Infinity&&sameArray(geometry.attributes.position?.array,reference.attributes.position.array)&&sameArray(geometry.index?.array,reference.index.array);
}

// Sources, including hidden/full-health bars, remain the CPU truth. Only the
// default layer's draw submission is borrowed; no source resource is owned.
// Native opaque fills and transparent backgrounds retain separate render passes.
export class HealthBarBatch {
 constructor(scene,{enabled=false,capacity=512}={}){
  if(batches.has(scene))return batches.get(scene);
  this.scene=scene;this.enabled=!!enabled;this.capacity=Math.max(1,Math.min(8192,Math.floor(Number(capacity)||512)));this.camera=null;this.closed=false;
  this.entries=new Map();this.selected=new Set();this.fills=[];this.backgrounds=[];
  this.modelView=new THREE.Matrix4();this.clipMatrix=new THREE.Matrix4();this.point=new THREE.Vector4();this.frustum=new THREE.Frustum();
  this.group=new THREE.Group();this.group.name='healthbar-batches';this.group.userData.healthBarBatch=true;this.group.renderOrder=10;this.group.matrixAutoUpdate=false;this.group.matrixWorldAutoUpdate=false;
  this.fillMesh=makeMesh(false,this.capacity);this.backgroundMesh=makeMesh(true,this.capacity);this.group.add(this.fillMesh,this.backgroundMesh);
  this.warmObjects=[this.fillMesh,this.backgroundMesh].map(mesh=>{const proxy=Object.create(mesh);proxy.count=1;proxy.visible=true;return proxy;});
  this.stats={registered:0,instances:0,fills:0,backgrounds:0,calls:0,uploadBytes:0,fallback:null,orderedFillIds:[],orderedBackgroundIds:[]};
  scene.add(this.group);batches.set(scene,this);
 }
 restore(entry){for(const source of entry.sources)if(entry.owned.delete(source))source.layers.enable(0);}
 register(root,bar){
  if(this.closed)return ()=>{};
  const previous=this.entries.get(bar);if(previous?.root===root)return previous.release;previous?.release();
  const entry={root,bar,sources:[...bar.children],owned:new Set(),items:[],release:null};entry.items=entry.sources.map(source=>({source,entry,z:0}));
  const removed=()=>this.restore(entry);root.addEventListener('removed',removed);bar.addEventListener('removed',removed);for(const source of entry.sources)source.addEventListener('removed',removed);
  let released=false;entry.release=()=>{if(released)return;released=true;this.restore(entry);this.entries.delete(bar);root.removeEventListener('removed',removed);bar.removeEventListener('removed',removed);for(const source of entry.sources)source.removeEventListener('removed',removed);};
  this.entries.set(bar,entry);return entry.release;
 }
 reset(reason=null){
  for(const entry of this.entries.values())this.restore(entry);
  for(const mesh of [this.fillMesh,this.backgroundMesh]){mesh.count=0;mesh.visible=false;for(const attribute of [mesh.instanceColor,mesh.geometry.attributes.healthModelView,mesh.geometry.attributes.healthOpacity])attribute.clearUpdateRanges();}
  this.fills.length=this.backgrounds.length=0;this.selected.clear();Object.assign(this.stats,{registered:this.entries.size,instances:0,fills:0,backgrounds:0,calls:0,uploadBytes:0,fallback:reason});this.stats.orderedFillIds.length=this.stats.orderedBackgroundIds.length=0;return this.stats;
 }
 setEnabled(enabled){this.enabled=!!enabled&&!this.closed;if(!this.enabled)this.reset();return this.enabled;}
 conflict(camera,groups){
  for(const group of groups)if(group!==this.group&&group.renderOrder===10&&!this.entries.has(group)&&group.layers.test(camera.layers)&&visibleInScene(group,this.scene))return true;
  return false;
 }
 collect(item,list,camera,worldMatricesFresh){
  const {source,entry}=item;
  if(!source.layers.isEnabled(0)&&!entry.owned.has(source))return;
  if(!visibleInScene(source,this.scene)||!source.material.visible)return;
  if(!worldMatricesFresh)source.updateWorldMatrix(true,false);
  if(source.frustumCulled&&!this.frustum.intersectsObject(source))return;
  const geometry=source.geometry;if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  this.point.copy(geometry.boundingSphere.center).applyMatrix4(source.matrixWorld).applyMatrix4(this.clipMatrix);
  item.z=this.point.z;list.push(item);this.selected.add(source);
 }
 pack(mesh,list,ids){
  const view=mesh.geometry.attributes.healthModelView,alpha=mesh.geometry.attributes.healthOpacity,color=mesh.instanceColor;ids.length=list.length;
  for(let i=0;i<list.length;i++){
   const {source,entry}=list[i];this.modelView.multiplyMatrices(this.camera.matrixWorldInverse,source.matrixWorld);this.modelView.toArray(view.array,i*16);source.material.color.toArray(color.array,i*3);alpha.array[i]=source.material.opacity;ids[i]=source.id;
   if(!entry.owned.has(source)){entry.owned.add(source);source.layers.disable(0);}
  }
  for(const attribute of [view,alpha,color]){attribute.clearUpdateRanges();if(list.length){attribute.addUpdateRange(0,list.length*attribute.itemSize);attribute.needsUpdate=true;this.stats.uploadBytes+=list.length*attribute.itemSize*4;}}
  mesh.count=list.length;mesh.visible=!!list.length;
 }
 update(camera,{worldMatricesFresh=false}={}){
  this.camera=camera||null;
  if(this.closed||!this.enabled||!camera)return this.reset(this.closed?'closed':null);
  const groups=renderGroupsFor(this.scene);if(!groups||groups.closed)return this.reset('group-registry-unavailable');if(!groups.ready)return this.reset('group-registry-pending');
  if(this.scene.onBeforeRender!==nativeBefore||this.scene.onAfterRender!==nativeAfter||this.scene.overrideMaterial)return this.reset('scene-state');
  if(this.conflict(camera,groups))return this.reset('group-order-conflict');
  camera.updateMatrixWorld();this.clipMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.clipMatrix,camera.coordinateSystem,camera.reversedDepth);
  this.fills.length=this.backgrounds.length=0;this.selected.clear();this.stats.uploadBytes=0;
  for(const entry of this.entries.values()){
   const {bar,root}=entry;if(sceneOf(root)!==this.scene||sceneOf(bar)!==this.scene||!visibleInScene(bar,this.scene)||!camera.layers.isEnabled(0)){this.restore(entry);continue;}
   if(bar.parent!==root||!bar.isGroup||bar.renderOrder!==10||bar.children.length!==2||bar.children[0]!==entry.sources[0]||bar.children[1]!==entry.sources[1]||bar.userData.fill!==bar.children[1]||!bar.layers.test(camera.layers)||!supportedMesh(bar.children[0],true,this.backgroundMesh.geometry)||!supportedMesh(bar.children[1],false,this.fillMesh.geometry))return this.reset('unsupported-source');
   this.collect(entry.items[1],this.fills,camera,worldMatricesFresh);this.collect(entry.items[0],this.backgrounds,camera,worldMatricesFresh);
  }
  if(this.fills.length>this.capacity||this.backgrounds.length>this.capacity)return this.reset('capacity');
  this.fills.sort((a,b)=>a.source.material.id-b.source.material.id||a.z-b.z||a.source.id-b.source.id);this.backgrounds.sort((a,b)=>b.z-a.z||a.source.id-b.source.id);
  // Hidden/camera-culled sources also stay on their native layer. Their next
  // visible selection will take over again; no HP-based filtering is applied.
  for(const entry of this.entries.values())for(const source of entry.sources)if(entry.owned.has(source)&&!this.selected.has(source)){entry.owned.delete(source);source.layers.enable(0);}
  this.pack(this.fillMesh,this.fills,this.stats.orderedFillIds);this.pack(this.backgroundMesh,this.backgrounds,this.stats.orderedBackgroundIds);
  Object.assign(this.stats,{registered:this.entries.size,instances:this.fills.length+this.backgrounds.length,fills:this.fills.length,backgrounds:this.backgrounds.length,calls:Number(!!this.fills.length)+Number(!!this.backgrounds.length),fallback:null});return this.stats;
 }
 prepareObjects(){return this.closed?[]:this.warmObjects;}
 diagnostics(){const groups=renderGroupsFor(this.scene);return {...this.stats,enabled:this.enabled,closed:this.closed,capacity:this.capacity,sharedRegistry:!!groups,registryReady:!!groups?.ready,orderedFillIds:[...this.stats.orderedFillIds],orderedBackgroundIds:[...this.stats.orderedBackgroundIds]};}
 dispose(){if(this.closed)return;this.closed=true;this.enabled=false;this.reset('closed');for(const entry of [...this.entries.values()])entry.release();this.group.removeFromParent();for(const mesh of [this.fillMesh,this.backgroundMesh]){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}this.warmObjects.length=0;this.camera=null;if(batches.get(this.scene)===this)batches.delete(this.scene);}
}
