import * as THREE from 'three';
import {notifyAssetBatchChanged} from './asset-batch-events.js';
const cache=new WeakMap();
// These wrappers share the source's full-detail buffers. Only planetary role
// equipment selects the small distant silhouette; the cached GLB is untouched.
export function installPlanetEquipmentLOD(mount,role){
 if(!['shield','reactor'].includes(role))return;
 mount.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.isSkinnedMesh||mesh.morphTargetInfluences?.length)return;
  const source=mesh.geometry;if(!source?.attributes.position)return;
  if(source.userData.planetEquipmentRole===role)return;
  let variants=cache.get(source);if(!variants){cache.set(source,variants=new Map());const release=()=>{source.removeEventListener('dispose',release);cache.delete(source);for(const geometry of variants.values()){geometry.userData.distantLOD.dispose();geometry.dispose();}variants.clear();};source.addEventListener('dispose',release);}
  let geometry=variants.get(role);
  if(!geometry){
   source.computeBoundingBox();const size=source.boundingBox.getSize(new THREE.Vector3()),center=source.boundingBox.getCenter(new THREE.Vector3());
   if(!size.toArray().every(Number.isFinite)||Math.max(...size.toArray())<=0)return;
   const low=role==='shield'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(.5,.5,1,8,1);
   low.scale(size.x,size.y,size.z).translate(center.x,center.y,center.z);low.computeBoundingSphere();
   geometry=new THREE.BufferGeometry();for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);geometry.setIndex(source.index);for(const group of source.groups)geometry.addGroup(group.start,group.count,group.materialIndex);geometry.setDrawRange(source.drawRange.start,source.drawRange.count);geometry.boundingBox=source.boundingBox.clone();geometry.boundingSphere=source.boundingSphere?.clone()||null;geometry.userData={...source.userData,distantLOD:low,planetEquipmentRole:role};variants.set(role,geometry);
  }
  mesh.geometry=geometry;notifyAssetBatchChanged(mesh);
 });
}
