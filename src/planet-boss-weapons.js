import * as THREE from 'three';
import {PLANET_ENEMIES} from './planet-enemies.js';
const anchors=new Map();
// Planetary bosses use imported hull surfaces rather than the fallback deck.
// Locate mounts once per fixed planetary asset; never raycast during combat.
export function anchorPlanetBossWeapons(root){
 if(root.userData.planetBossWeapons)return;
 const frame=root.userData.visualRoot,parts=root.userData.parts,turrets=root.userData.turrets;
 if(!frame||!parts?.length||!turrets?.length)return;
 const started=performance.now();let raycasts=0;
 const key=PLANET_ENEMIES[root.userData.planetTheme]?root.userData.planetAssetId:null;
 let mounts=key&&anchors.get(key);
 const cacheHit=!!mounts;
 if(!mounts){
  frame.updateWorldMatrix(true,true);
  const meshes=[];for(const part of parts)part.traverse(o=>{if(o.isMesh&&o.name==='meshy-boss-section')meshes.push(o);});
  if(!meshes.length)return;
  const bounds=new THREE.Box3(),inverse=frame.matrixWorld.clone().invert();for(const mesh of meshes){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));}const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(frame.matrixWorld);mounts=[];
  for(let i=0;i<turrets.length;i++){
   const side=i%2?-1:1;let hit;
   search:for(const lateral of [.22,.12,.32,0])for(const depth of [0,-.15,.15]){
    ray.set(new THREE.Vector3(center.x+side*size.x*lateral,bounds.max.y+Math.max(1,size.y),center.z+size.z*depth).applyMatrix4(frame.matrixWorld),down);
    raycasts++;
    hit=ray.intersectObjects(meshes,false)[0];if(hit)break search;
   }
   if(!hit)return;
   const section=parts.findIndex(part=>part===hit.object.parent),position=frame.worldToLocal(hit.point.clone());position.y+=.025;
   mounts.push({section,position:position.toArray()});
  }
  if(key)anchors.set(key,mounts);
 }
 for(let i=0;i<turrets.length;i++){
  const mount=mounts[i],part=parts[mount?.section];if(!part)continue;
  const offsets=(turrets[i].userData.planetBossFootings||[]).map(footing=>({footing,offset:footing.position.clone().sub(turrets[i].position)}));
  part.add(turrets[i]);turrets[i].position.fromArray(mount.position).sub(part.position);turrets[i].userData.bossPart=mount.section;
  for(const {footing,offset} of offsets){part.add(footing);footing.position.copy(turrets[i].position).add(offset);}
 }
 root.userData.planetBossWeapons=mounts.map(m=>({section:m.section,position:[...m.position]}));
 root.userData.planetBossWeaponPreparation={cacheHit,raycasts,durationMs:performance.now()-started};
}
