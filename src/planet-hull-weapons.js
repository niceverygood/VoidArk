import * as THREE from 'three';
import {PLANET_ENEMIES} from './planet-enemies.js';
const layouts=new Map(),roles=new Set(['striker','guard','gunner','support','flagship']);
export function anchorPlanetHullWeapons(root,mount,role){
 const frame=root.userData.visualRoot,turrets=root.userData.turrets;
 if(!frame||!mount||!turrets?.length||root.userData.planetHullWeapons)return;
 const id=root.userData.planetAssetId,theme=root.userData.planetTheme;
 const key=PLANET_ENEMIES[theme]&&roles.has(role)&&id==='enemy-'+theme+'-'+(role==='flagship'?'capital':'fighter')?id+':'+role:null;
 let points=key&&layouts.get(key),raycasts=0;const cacheHit=!!points;
 if(!points){
  frame.updateWorldMatrix(true,true);
  const inverse=frame.matrixWorld.clone().invert(),bounds=new THREE.Box3(),meshes=[];
  mount.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;meshes.push(mesh);mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));});
  if(bounds.isEmpty())return;
  const top=bounds.max.y+Math.max(1,bounds.max.y-bounds.min.y),direction=new THREE.Vector3(0,-1,0).transformDirection(frame.matrixWorld),ray=new THREE.Raycaster();
  const contact=p=>{ray.set(new THREE.Vector3(p.x,top,p.z).applyMatrix4(frame.matrixWorld),direction);raycasts++;const hit=ray.intersectObjects(meshes,false)[0];return hit?hit.point.clone().applyMatrix4(inverse):null;};
  let centers;
  const upperCenters=()=>{
   if(centers)return centers;centers=[];
   const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3();
   for(const mesh of meshes){const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
    for(let i=0,n=index?index.count:positions.count;i+2<n;i+=3){a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(transform);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(transform);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(transform);normal.subVectors(b,a).cross(edge.subVectors(c,a));if(normal.y>1e-8)centers.push(a.clone().add(b).add(c).multiplyScalar(1/3));}
   }return centers;
  };
  points=[];
  for(const turret of turrets){
   const target=turret.position,core=root.userData.core;
   const clear=p=>!core||Math.hypot(p.x-core.position.x,p.z-core.position.z)>=core.scale.x+(turret.userData.scale||.5)*.55+.03;
   let point=contact(target);
   if(!point||!clear(point)){
    let best,distance=Infinity;for(const p of upperCenters())if(clear(p)){const d=(p.x-target.x)**2+(p.z-target.z)**2;if(d<distance){distance=d;best=p;}}
    if(best)point=contact(best);
   }
   if(!point)return;
   point.y+=(turret.userData.scale||.5)*.245+.02;points.push(point.toArray());
  }
  if(key)layouts.set(key,points);
 }
 turrets.forEach((turret,i)=>{const delta=new THREE.Vector3().fromArray(points[i]).sub(turret.position);for(const footing of turret.userData.planetHullFootings||[])footing.position.add(delta);turret.position.fromArray(points[i]);});
 root.userData.planetHullWeapons={positions:points.map(p=>[...p]),cacheHit,raycasts};
}
