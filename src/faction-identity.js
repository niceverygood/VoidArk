import {acquireFactionMarker} from './faction-marker-texture.js';
import {registerFactionMarker} from './faction-marker-batch.js';
import {ShipDetailLOD} from './ship-detail-lod.js';
import {batchStaticDetails} from './static-detail-batch.js';
import {notifyAssetBatchChanged} from './asset-batch-events.js';
import * as THREE from 'three';
const colors={enemy:0xff514b,ally:0x42e4de,boss:0xffb33e};
// The same owned material is used by live hulls and render-only preparation.
export function createFactionHullMaterial(source,faction='enemy',{preservePalette=false}={}){
 if(!source.isMeshStandardMaterial||source.emissiveIntensity>1)return source;
 const m=source.clone();
 if(faction!=='ally'&&!preservePalette){
  m.color.set(0x923e3b);const original=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{original?.(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.65, 0.08, 0.055) * (0.35 + diffuseColor.rgb), 0.65);');};
  m.customProgramCacheKey=()=> 'hostile-hull-identification-v1';
 }else if(faction==='ally')m.color.lerp(new THREE.Color(colors.ally),.2);
 return m;
}
export function installFactionIdentity(root,faction='enemy',{shareStaticGeometry=true}={}){
 const color=colors[faction],owned=new Map(),seen=new WeakSet(),ignored=new WeakSet(),watched=new WeakSet();
 for(const engine of root.userData.engines||[])engine.traverse(o=>ignored.add(o));
 const markerLease=acquireFactionMarker(faction,color),texture=markerLease.texture;const material=new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false});const marker=new THREE.Sprite(material);marker.renderOrder=1000;root.add(marker);
 const releaseMarkerBatch=registerFactionMarker(root,marker,faction);
 const scale=new THREE.Vector3(),world=new THREE.Vector3();let disposed=false,dirty=true;const batches=[];let batchAt=performance.now()+3000+Math.random()*2000;const lod=faction==='boss'?null:new ShipDetailLOD(root),matrixRotation=new THREE.Quaternion();
 const invalidate=()=>{dirty=true;};root.addEventListener('childadded',invalidate);root.addEventListener('childremoved',invalidate);watched.add(root);
 function update(camera,radius=4){
  // Newly loaded GLB meshes receive their own materials; cached source models stay untouched.
  const now=performance.now();if(now>=batchAt){batchAt=Infinity;lod?.restore();batches.push(batchStaticDetails(root,{shareGeometry:shareStaticGeometry}));dirty=true;}
  if(dirty){dirty=false;lod?.restore();batches.forEach(b=>b.refresh());root.traverse(o=>{if(!watched.has(o)){watched.add(o);o.addEventListener('childadded',invalidate);o.addEventListener('childremoved',invalidate);}if(seen.has(o)||ignored.has(o))return;seen.add(o);if(!o.isMesh||!o.material)return;const convert=source=>{if(!source.isMeshStandardMaterial||source.emissiveIntensity>1)return source;if(!owned.has(source))owned.set(source,createFactionHullMaterial(source,faction,{preservePalette:!!root.userData.planetTheme}));return owned.get(source);};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);notifyAssetBatchChanged(o);});lod?.rebuild();}
  lod?.update(camera,window.innerHeight);
  root.updateWorldMatrix(true,false);root.matrixWorld.decompose(world,matrixRotation,scale);const distance=camera.position.distanceTo(world),worldWidth=distance*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(faction==='boss'?108:26)/Math.max(400,window.innerHeight);
  marker.position.set(0,(radius+(faction==='boss'?8:2))/scale.y,0);marker.scale.set(worldWidth/scale.x,worldWidth*(faction==='boss'?.3125:1)/scale.y,1);marker.visible=distance<(faction==='boss'?camera.far:280);material.opacity=faction==='boss'?1:distance>200?Math.max(.25,(280-distance)/80):1;
 }
 const previous=root.userData.dispose;root.userData.dispose=()=>{if(disposed)return;disposed=true;releaseMarkerBatch();root.traverse(o=>{o.removeEventListener('childadded',invalidate);o.removeEventListener('childremoved',invalidate);});lod?.dispose();root.remove(marker);batches.forEach(release=>release());markerLease.release();material.dispose();for(const m of owned.values())m.dispose();previous?.();};root.userData.factionIdentity={faction,marker,update,lod,invalidate(){dirty=true;}};return root;
}






