import * as THREE from 'three';
import {acquireFactionMarker} from './faction-marker-texture.js';

const batches = new WeakMap(), registrations = new Set();
const FACTIONS = ['enemy', 'ally', 'boss'], PADDING = 32;
const FACTION_COLORS={enemy:0xff514b,ally:0x42e4de,boss:0xffb33e};
export function factionMarkerBatchFor(scene){return batches.get(scene)?.api||null;}
function sceneOf(root) { for (let p=root;p;p=p.parent) if(p.isScene)return p; return null; }
function restore(entry) { if(entry.owned){if(entry.layer0)entry.marker.layers.enable(0);entry.owned=false;} }
function attach(entry) {
  const next=batches.get(sceneOf(entry.root));
  if(entry.batch===next)return;
  restore(entry);entry.batch?.entries.delete(entry);entry.batch=next;next?.entries.add(entry);
}
// Registration is inert unless the containing scene explicitly owns a batch.
export function registerFactionMarker(root,marker,faction) {
  const entry={root,marker,faction,owned:false,layer0:false,batch:null};registrations.add(entry);
  const added=()=>attach(entry),removed=()=>{restore(entry);entry.batch?.entries.delete(entry);entry.batch=null;};
  root.addEventListener('added',added);root.addEventListener('removed',removed);attach(entry);
  let released=false;
  return ()=>{if(released)return;released=true;removed();registrations.delete(entry);root.removeEventListener('added',added);root.removeEventListener('removed',removed);};
}

function patchShader(shader) {
  const attributes=`
attribute vec3 factionViewPosition;
attribute vec3 factionBasisX;
attribute vec3 factionBasisY;
attribute vec2 factionCenter;
attribute vec2 factionRotationOpacity;
attribute vec4 factionRegion;
attribute vec3 factionColor;
varying float vFactionOpacity;
varying vec3 vFactionColor;
`;
  shader.vertexShader=attributes+shader.vertexShader
    .replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv = factionRegion.xy + vMapUv * factionRegion.zw;\nvFactionOpacity = factionRotationOpacity.y;\nvFactionColor = factionColor;')
    .replace('vec4 mvPosition = modelViewMatrix[ 3 ];','vec4 mvPosition = vec4( factionViewPosition, 1.0 );')
    .replace('vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );','vec2 scale = vec2( length( factionBasisX ), length( factionBasisY ) );')
    .replace('( center - vec2( 0.5 ) )','( factionCenter - vec2( 0.5 ) )')
    .replaceAll('cos( rotation )','cos( factionRotationOpacity.x )').replaceAll('sin( rotation )','sin( factionRotationOpacity.x )');
  shader.fragmentShader='varying float vFactionOpacity;\nvarying vec3 vFactionColor;\n'+shader.fragmentShader
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse * vFactionColor, opacity * vFactionOpacity );');
}

function supported(entry) {
  const s=entry.marker,m=s.material,t=m?.map;
  if(!FACTIONS.includes(entry.faction)||!s.isSprite||s.renderOrder!==1000||!m?.isSpriteMaterial||!m.transparent||m.blending!==THREE.NormalBlending||m.depthTest||m.depthWrite||m.toneMapped||!m.sizeAttenuation||m.alphaMap||m.alphaTest||m.alphaHash||m.premultipliedAlpha||m.clippingPlanes?.length||!m.fog)return false;
  if(!t?.image?.width||!t.image.height||t.colorSpace!==THREE.SRGBColorSpace||!t.flipY||t.channel!==0||t.wrapS!==THREE.ClampToEdgeWrapping||t.wrapT!==THREE.ClampToEdgeWrapping||t.minFilter!==THREE.LinearMipmapLinearFilter||t.magFilter!==THREE.LinearFilter||t.offset.x||t.offset.y||t.repeat.x!==1||t.repeat.y!==1||t.rotation)return false;
  // Layer-zero is the only native render path this batch takes over.
  if(s.layers.mask&~1)return false;
  for(let p=s.parent;p;p=p.parent)if(p.isGroup&&p.renderOrder!==0)return false;
  return true;
}
function visibleInScene(marker,scene) {
  for(let p=marker;p;p=p.parent){if(!p.visible)return false;if(p===scene)return true;}
  return false;
}

export function createFactionMarkerBatch(scene,{capacity=512,enabled=true}={}) {
  if(batches.has(scene))return batches.get(scene).api;
  const entries=new Set(),ordered=[],slots=new Map(),warmLeases=new Map(),attributes={};
  const geometry=new THREE.BufferGeometry();
  geometry.setIndex([0,1,2,0,2,3]);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  for(const [name,size] of Object.entries({factionViewPosition:3,factionBasisX:3,factionBasisY:3,factionCenter:2,factionRotationOpacity:2,factionRegion:4,factionColor:3})){
    attributes[name]=new THREE.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,attributes[name]);
  }
  let canvas,context,atlas=null;
  try{canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;context=canvas.getContext('2d');if(context){context.imageSmoothingEnabled=false;atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;}}catch{/* Native sprites remain available when canvas allocation is unavailable. */}
  const material=new THREE.SpriteMaterial({map:atlas,depthTest:false,depthWrite:false,toneMapped:false});
  material.onBeforeCompile=patchShader;material.customProgramCacheKey=()=> 'faction-marker-batch-native-sprite-v1';
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='faction-marker-batch';mesh.center=new THREE.Vector2(.5,.5);mesh.renderOrder=1000;mesh.frustumCulled=false;mesh.count=0;mesh.visible=false;scene.add(mesh);
  const viewMatrix=new THREE.Matrix4(),clipMatrix=new THREE.Matrix4(),clip=new THREE.Vector4(),frustum=new THREE.Frustum();
  const stats={registered:0,instances:0,fallback:0,drawCalls:0,uploadBytes:0,atlasReady:!!atlas,warmedFactions:0,orderedIds:[]};
  let disposed=false;
  function copyImage(faction,image){
    if(!atlas)return null;
    const width=image.width,height=image.height;
    if(height!==80||width!==(faction==='boss'?256:80))return null;
    let slot=slots.get(faction);
    if(!slot){const x=faction==='enemy'?32:faction==='ally'?176:320,y=32;slot={x,y,width,height,image:null,uv:[x/1024,(256-y-height)/256,width/1024,height/256]};slots.set(faction,slot);}
    if(slot.image!==image){
      const {x,y}=slot,p=PADDING;context.clearRect(x-p,y-p,width+2*p,height+2*p);
      context.drawImage(image,x,y); // Exact source canvas pixels, with replicated edge/corner texels.
      context.drawImage(image,0,0,1,height,x-p,y,p,height);context.drawImage(image,width-1,0,1,height,x+width,y,p,height);
      context.drawImage(image,0,0,width,1,x,y-p,width,p);context.drawImage(image,0,height-1,width,1,x,y+height,width,p);
      for(const sx of [0,1])for(const sy of [0,1])context.drawImage(image,sx?(width-1):0,sy?(height-1):0,1,1,sx?x+width:x-p,sy?y+height:y-p,p,p);
      slot.image=image;atlas.needsUpdate=true;
    }
    return slot;
  }
  function slotFor(entry){return supported(entry)?copyImage(entry.faction,entry.marker.material.map.image):null;}
  function prepareAll(){
    if(disposed||!atlas)return false;
    let ready=true;
    for(const faction of FACTIONS){
      try{let lease=warmLeases.get(faction);if(!lease){lease=acquireFactionMarker(faction,FACTION_COLORS[faction]);warmLeases.set(faction,lease);}if(!copyImage(faction,lease.texture.image))ready=false;}
      catch{ready=false;} // Minimal Node/failed canvas contexts can keep the registered-source path.
    }
    stats.warmedFactions=[...warmLeases].filter(([faction,lease])=>slots.get(faction)?.image===lease.texture.image).length;
    return ready&&stats.warmedFactions===3;
  }
  function setEnabled(value){enabled=!!value&&!disposed;if(!enabled){for(const entry of entries)restore(entry);mesh.count=0;mesh.visible=false;}return enabled;}
  function update(camera,{worldMatricesFresh=false}={}){
    if(disposed)return stats;
    for(const entry of registrations)if(!entry.batch||sceneOf(entry.root)!==entry.batch.scene)attach(entry);
    ordered.length=0;stats.registered=entries.size;stats.fallback=0;stats.uploadBytes=0;
    if(!enabled||!atlas){for(const entry of entries)restore(entry);mesh.count=0;mesh.visible=false;stats.instances=stats.drawCalls=0;stats.orderedIds.length=0;return stats;}
    camera.updateMatrixWorld();clipMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(clipMatrix,camera.coordinateSystem,camera.reversedDepth);
    for(const entry of entries){
      const s=entry.marker,slot=slotFor(entry);
      if(!slot||(!entry.owned&&!s.layers.isEnabled(0))){restore(entry);stats.fallback++;continue;}
      if(!entry.owned){entry.layer0=s.layers.isEnabled(0);entry.owned=true;s.layers.disable(0);}
      if(!camera.layers.isEnabled(0)||!s.material.visible||!visibleInScene(s,scene))continue;
      if(worldMatricesFresh){if(s.matrixAutoUpdate)s.updateMatrix();if(s.parent)s.matrixWorld.multiplyMatrices(s.parent.matrixWorld,s.matrix);else s.matrixWorld.copy(s.matrix);}else s.updateWorldMatrix(true,false);
      if(s.frustumCulled&&!frustum.intersectsSprite(s))continue;
      // Three r180 projectObject sorts Sprite with Vector4.z, without w divide.
      clip.setFromMatrixPosition(s.matrixWorld).applyMatrix4(clipMatrix);entry.z=clip.z;entry.slot=slot;ordered.push(entry);
    }
    ordered.sort((a,b)=>b.z-a.z||a.marker.id-b.marker.id);
    // A split native/batched transparent pass cannot preserve interleaving.
    // Keep the entire scene's markers native on unsupported state or overflow.
    if(stats.fallback||ordered.length>capacity){for(const entry of entries)restore(entry);stats.fallback=entries.size;mesh.count=0;mesh.visible=false;stats.instances=stats.drawCalls=0;stats.orderedIds.length=0;return stats;}
    const count=Math.min(capacity,ordered.length);stats.orderedIds.length=count;
    for(let i=0;i<count;i++){
      const {marker:s,slot}=ordered[i],w=s.matrixWorld.elements;viewMatrix.multiplyMatrices(camera.matrixWorldInverse,s.matrixWorld);const v=viewMatrix.elements,m=s.material;
      attributes.factionViewPosition.setXYZ(i,v[12],v[13],v[14]);attributes.factionBasisX.setXYZ(i,w[0],w[1],w[2]);attributes.factionBasisY.setXYZ(i,w[4],w[5],w[6]);
      attributes.factionCenter.setXY(i,s.center.x,s.center.y);attributes.factionRotationOpacity.setXY(i,m.rotation,m.opacity);attributes.factionRegion.setXYZW(i,...slot.uv);attributes.factionColor.setXYZ(i,m.color.r,m.color.g,m.color.b);stats.orderedIds[i]=s.id;
    }
    for(const attribute of Object.values(attributes)){attribute.clearUpdateRanges();if(count){attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;stats.uploadBytes+=count*attribute.itemSize*4;}}
    mesh.count=count;mesh.visible=count>0;stats.instances=count;stats.drawCalls=count?1:0;return stats;
  }
  const record={scene,entries,api:null};
  const api={mesh,stats,update,setEnabled,prepareAll,prepareObjects(){if(disposed||!atlas)return [];prepareAll();for(const entry of entries)slotFor(entry);return [mesh];},dispose(){if(disposed)return;disposed=true;setEnabled(false);for(const entry of entries){restore(entry);entry.batch=null;}entries.clear();ordered.length=0;slots.clear();for(const lease of warmLeases.values())lease.release();warmLeases.clear();scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();atlas?.dispose();batches.delete(scene);}};
  record.api=api;batches.set(scene,record);for(const entry of registrations)if(sceneOf(entry.root)===scene)attach(entry);return api;
}
