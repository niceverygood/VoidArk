import * as THREE from 'three';
import {PLANET_ENEMIES} from './planet-enemies.js';
const surfaces=new Map();
export function anchorPlanetHullEngines(root,mount){
 const frame=root.userData.visualRoot,engines=root.userData.engines;
 if(!frame||!mount||engines?.length!==2||root.userData.planetHullEngines)return;
 const id=root.userData.planetAssetId,theme=root.userData.planetTheme;
 const key=PLANET_ENEMIES[theme]&&['fighter','capital'].some(role=>id==='enemy-'+theme+'-'+role)?id:null;
 let points=key&&surfaces.get(key),raycasts=0;const cacheHit=!!points;
 if(!points){
  frame.updateWorldMatrix(true,true);
  const inverse=frame.matrixWorld.clone().invert(),bounds=new THREE.Box3(),meshes=[];
  mount.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;meshes.push(mesh);mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));});
  if(bounds.isEmpty())return;
  const back=bounds.max.z+Math.max(1,bounds.max.z-bounds.min.z),direction=new THREE.Vector3(0,0,-1).transformDirection(frame.matrixWorld),ray=new THREE.Raycaster();
  const contact=p=>{ray.set(new THREE.Vector3(p.x,p.y,back).applyMatrix4(frame.matrixWorld),direction);raycasts++;const hit=ray.intersectObjects(meshes,false)[0];return hit?hit.point.clone().applyMatrix4(inverse):null;};
  let centers;
  const rearCenters=()=>{
   if(centers)return centers;centers=[];
   const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3();
   for(const mesh of meshes){const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
    for(let i=0,n=index?index.count:positions.count;i+2<n;i+=3){a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(transform);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(transform);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(transform);normal.subVectors(b,a).cross(edge.subVectors(c,a));if(normal.z>1e-8)centers.push(a.clone().add(b).add(c).multiplyScalar(1/3));}
   }return centers;
  };
  points=[];const minimum=(engines[0].userData.radius+engines[1].userData.radius)*1.1;
  for(const engine of engines){
   const target=engine.position,clear=p=>!points.length||Math.hypot(p.x-points[0][0],p.y-points[0][1])>=minimum;
   let point=contact(target);
   if(!point||!clear(point)){
    let best,distance=Infinity;for(const p of rearCenters())if(clear(p)){const d=(p.x-target.x)**2+(p.y-target.y)**2;if(d<distance){distance=d;best=p;}}
    if(best)point=contact(best);
   }
   if(!point||!clear(point))return;points.push(point.toArray());
  }
  if(key)surfaces.set(key,points);
 }
 engines.forEach((engine,i)=>{engine.position.fromArray(points[i]);engine.position.z+=engine.userData.length*.3;});
 root.userData.planetHullEngines={positions:points.map(p=>[...p]),cacheHit,raycasts};
}
