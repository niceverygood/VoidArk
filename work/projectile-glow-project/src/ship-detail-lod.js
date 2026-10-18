import * as THREE from 'three';
import {markHiddenMatrixBranch} from './hidden-world-matrices.js';
import {notifyAssetBatchChanged} from './asset-batch-events.js';
let secondaryView=null;
export function setShipDetailSubview(view){secondaryView=view;}

// One hierarchy, shared cached geometry. No proxy ship or per-frame tree scan.
// Pixels are CSS pixels (independent of dynamic resolution); use camera depth,
// so zoom, FOV and a ship at the screen edge retain conservative detail.
export function selectShipDetail(previous,depth,pixels){
 if(previous==='far')return depth<60||pixels>145?'near':'far';
 return depth>80&&pixels<110?'far':'near';
}
export class ShipDetailLOD {
 constructor(root){this.root=root;this.entries=[];this.branches=[];this.level='near';this.mode='adaptive';this.rebuilds=0;this.transitions=0;this.changes=0;this.checks=0;this.radius=1;this.world=new THREE.Vector3();this.local=new THREE.Matrix4();this.inverse=new THREE.Matrix4();this.scale=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.view=new THREE.Vector3();this.lastCamera=new THREE.Vector3(Infinity,0,0);this.nextCheck=0;this.disposed=false;}
 restore(){for(const b of this.branches){if(b.hidden){b.root.visible=b.root.userData.assetReplaced?false:b.visible;b.hidden=false;}}for(const e of this.entries){if(e.hidden){e.mesh.visible=e.mesh.userData.assetReplaced?false:e.visible;e.hidden=false;}if(e.mesh.geometry!==e.geometry){e.mesh.geometry=e.geometry;notifyAssetBatchChanged(e.mesh);}}this.level='near';}
 rebuild(){
  this.restore();this.entries.length=0;this.branches.length=0;this.root.updateWorldMatrix(true,true);this.inverse.copy(this.root.matrixWorld).invert();this.radius=1;
  // Keep the hull at all sizes. Subpixel equipment can disappear, but returns
  // with the same joints on approach. Never hide flames, trails or markers.
  const mounts=new Map(),branchEntries=new Map(),hotMeshes=new Set((this.root.userData.engines||[]).map(e=>e.userData.hot)),protectedMeshes=new Set([this.root.userData.core,this.root.userData.hitFlash,...(this.root.userData.rotors||[])]);
  this.root.traverse(o=>{
   if(!o.isMesh||!o.visible||o.userData.assetReplaced||(o.userData.staticBatch&&!o.geometry.userData.isBatch)||o.isSkinnedMesh||o.morphTargetInfluences?.length||Array.isArray(o.material)||(o.material?.transparent&&!hotMeshes.has(o)))return;
   for(let a=o;a&&a!==this.root;a=a.parent)if(a.userData.meshyAnimated)return;
   const geometry=o.geometry;if(!geometry.boundingSphere)geometry.computeBoundingSphere();this.local.multiplyMatrices(this.inverse,o.matrixWorld);this.local.decompose(this.world,this.rotation,this.scale);
   const center=geometry.boundingSphere.center.clone().applyMatrix4(this.local),radius=geometry.boundingSphere.radius*Math.max(Math.abs(this.scale.x),Math.abs(this.scale.y),Math.abs(this.scale.z));
   let mount=o.parent;while(mount&&mount!==this.root&&!mount.name.startsWith('meshy:'))mount=mount.parent;
   const entry={mesh:o,geometry,visible:o.visible,hidden:false,radius,effectDetail:hotMeshes.has(o),essential:protectedMeshes.has(o)||!!o.userData.planetHullEssential,signatureDetail:!!o.userData.planetSignatureDetail};this.entries.push(entry);this.radius=Math.max(this.radius,center.length()+radius);markHiddenMatrixBranch(o);
   if(mount&&mount!==this.root){let parts=branchEntries.get(mount);if(!parts)branchEntries.set(mount,parts=[]);parts.push(entry);}
   if(mount&&/^meshy:(enemy-|vessel-|nation-.*-(scout|cruiser|carrier)$)/.test(mount.name)){const largest=mounts.get(mount);if(!largest||radius>largest.radius)mounts.set(mount,entry);}
  });
  for(const e of mounts.values())e.essential=true;
  for(const [mount,parts] of branchEntries){let visibleMeshes=0;mount.traverse(o=>{if(o.isMesh&&o.visible)visibleMeshes++;});if(visibleMeshes===parts.length&&markHiddenMatrixBranch(mount))this.branches.push({root:mount,parts,visible:mount.visible,hidden:false});}
  // Never hide the main procedural hull if an asset failed to load.
  const largest=this.entries.reduce((a,b)=>!a||b.radius>a.radius?b:a,null);if(largest)largest.essential=true;
  this.rebuilds++;this.nextCheck=0;
 }
 update(camera,height=720,now=performance.now()){
  if(this.disposed)return;
  const projected=height*camera.projectionMatrix.elements[5],secondary=secondaryView?.camera;
  if(now<this.nextCheck&&this.lastMode===this.mode&&this.lastProjection===projected&&this.lastCamera.distanceToSquared(camera.position)<64&&this.lastSecondary===secondary)return;
  this.lastProjection=projected;this.lastMode=this.mode;this.lastCamera.copy(camera.position);this.lastSecondary=secondary;this.nextCheck=now+(this.mode==='legacy'?500:100);
  this.checks++;this.root.updateWorldMatrix(true,false);this.root.matrixWorld.decompose(this.world,this.rotation,this.scale);this.view.copy(this.world).applyMatrix4(camera.matrixWorldInverse);
  let depth=Math.max(camera.near,-this.view.z),projection=height*camera.projectionMatrix.elements[5]/(2*depth);const worldScale=Math.max(Math.abs(this.scale.x),Math.abs(this.scale.y),Math.abs(this.scale.z));
  if(secondaryView){this.view.copy(this.world).applyMatrix4(secondaryView.camera.matrixWorldInverse);const secondDepth=Math.max(secondaryView.camera.near,-this.view.z);if(this.view.z<0){projection=Math.max(projection,secondaryView.height*secondaryView.camera.projectionMatrix.elements[5]/(2*secondDepth));depth=Math.min(depth,secondDepth);}}
  const next=this.mode==='full'?'near':selectShipDetail(this.level,depth,2*this.radius*worldScale*projection);if(next!==this.level){this.level=next;this.transitions++;}
  if(this.mode==='legacy')this.root.updateWorldMatrix(true,true);
  for(const e of this.entries){
   const o=e.mesh;if(o.userData.assetReplaced||(o.userData.staticBatch&&!e.geometry.userData.isBatch))continue;
   let pixels=e.radius*worldScale*projection;
   if(this.mode==='legacy'){o.matrixWorld.decompose(this.view,this.rotation,this.scale);pixels=e.geometry.boundingSphere.radius*Math.max(this.scale.x,this.scale.y,this.scale.z)/Math.max(1,camera.position.distanceTo(this.view))*height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));}
   const far=this.mode==='legacy'||this.level==='far',hide=far&&(e.signatureDetail||((this.mode==='legacy'?!e.effectDetail:!e.essential)&&(this.mode==='legacy'?pixels<=2.5:e.hidden?pixels<4:pixels<2.5)));
   if(hide!==e.hidden){e.hidden=hide;o.visible=hide?false:e.visible;this.changes++;}
   const low=this.mode==='legacy'?e.geometry.userData.combatLOD:(e.geometry.userData.distantLOD||e.geometry.userData.combatLOD);
   const geometry=far&&low&&(this.mode==='legacy'?pixels<65:true)?low:e.geometry;
   if(o.geometry!==geometry){o.geometry=geometry;notifyAssetBatchChanged(o);this.changes++;}
  }
  for(const b of this.branches){const hide=this.mode!=='legacy'&&this.level==='far'&&b.parts.every(e=>e.hidden);if(hide!==b.hidden){b.hidden=hide;b.root.visible=hide?false:b.visible;this.changes++;}}
 }
 diagnostics(){return {level:this.level,mode:this.mode,meshes:this.entries.length,hidden:this.entries.filter(e=>e.hidden).length,reduced:this.entries.filter(e=>e.mesh.geometry!==e.geometry).length,rebuilds:this.rebuilds,transitions:this.transitions,changes:this.changes,checks:this.checks};}
 dispose(){if(this.disposed)return;this.restore();this.entries.length=0;this.branches.length=0;this.disposed=true;}
}

export function invalidateShipDetail(root){for(let o=root;o;o=o.parent)if(o.userData.factionIdentity){o.userData.factionIdentity.invalidate();break;}}
