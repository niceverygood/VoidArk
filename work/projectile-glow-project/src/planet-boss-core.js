import * as THREE from 'three';
import {PLANET_ENEMIES} from './planet-enemies.js';
const surfaces=new Map();
// Keep the glow on the surviving bow, including after the central hull is lost.
export function anchorPlanetBossCore(root){
 const frame=root.userData.visualRoot,part=root.userData.parts?.[6],core=root.userData.core;
 if(!frame||!part||!core||root.userData.planetBossCore)return;
 const key=PLANET_ENEMIES[root.userData.planetTheme]?root.userData.planetAssetId:null;
 let point=key&&surfaces.get(key);
 if(!point){
  part.updateWorldMatrix(true,true);
  const inverse=part.matrixWorld.clone().invert(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  let highest=-Infinity;
  part.traverse(mesh=>{
   if(!mesh.isMesh||mesh.name!=='meshy-boss-section')return;
   const positions=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
   const transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
   for(let i=0,n=index?index.count:positions.count;i+2<n;i+=3){
    a.fromBufferAttribute(positions,index?index.getX(i):i);
    b.fromBufferAttribute(positions,index?index.getX(i+1):i+1);
    c.fromBufferAttribute(positions,index?index.getX(i+2):i+2);
    a.add(b).add(c).multiplyScalar(1/3).applyMatrix4(transform);
    if(a.y>highest){highest=a.y;point=a.toArray();}
   }
  });
  if(!point)return;
  if(key)surfaces.set(key,point);
 }
 part.add(core);core.position.fromArray(point);core.position.y+=.08;
 core.userData.bossPart=6;
 root.userData.planetBossCore={section:6,position:core.position.toArray()};
}
