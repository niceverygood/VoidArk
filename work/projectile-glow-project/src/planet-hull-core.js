import * as THREE from 'three';
import {PLANET_ENEMIES} from './planet-enemies.js';
const surfaces=new Map();
// Fixed planetary hulls share local contact positions across ships and roles.
export function anchorPlanetHullCore(root,mount){
 const frame=root.userData.visualRoot,core=root.userData.core;
 if(!frame||!core||!mount||root.userData.planetHullCore)return;
 const id=root.userData.planetAssetId;
 const key=PLANET_ENEMIES[root.userData.planetTheme]&&['fighter','capital','fortress'].some(role=>id==='enemy-'+root.userData.planetTheme+'-'+role)?id:null;
 let point=key&&surfaces.get(key);const cacheHit=!!point;
 if(!point){
  frame.updateWorldMatrix(true,true);
  const inverse=frame.matrixWorld.clone().invert(),bounds=new THREE.Box3(),meshes=[];
  mount.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;meshes.push(mesh);mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));});
  if(bounds.isEmpty())return;
  const origin=new THREE.Vector3(core.position.x,bounds.max.y+Math.max(1,bounds.max.y-bounds.min.y),core.position.z).applyMatrix4(frame.matrixWorld);
  const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0).transformDirection(frame.matrixWorld));
  const hit=ray.intersectObjects(meshes,false)[0];if(!hit)return;
  point=hit.point.clone().applyMatrix4(inverse).toArray();point[1]+=.08;
  if(key)surfaces.set(key,point);
 }
 core.position.fromArray(point);
 root.userData.planetHullCore={position:[...point],cacheHit,raycasts:cacheHit?0:1};
}
