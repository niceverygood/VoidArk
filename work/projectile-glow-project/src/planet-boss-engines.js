import * as THREE from 'three';
import {PLANET_ENEMIES} from './planet-enemies.js';
const surfaces=new Map();
export function anchorPlanetBossEngines(root){
 const part=root.userData.parts?.[5],engines=root.userData.engines;
 if(!part||engines?.length!==2||root.userData.planetBossEngines)return;
 const key=PLANET_ENEMIES[root.userData.planetTheme]?root.userData.planetAssetId:null;
 let points=key&&surfaces.get(key);
 if(!points){
  part.updateWorldMatrix(true,true);
  const inverse=part.matrixWorld.clone().invert(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),centers=[];
  part.traverse(mesh=>{
   if(!mesh.isMesh||mesh.name!=='meshy-boss-section')return;
   const positions=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
   for(let i=0,n=index?index.count:positions.count;i+2<n;i+=3){
    a.fromBufferAttribute(positions,index?index.getX(i):i);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2);
    centers.push(a.add(b).add(c).multiplyScalar(1/3).applyMatrix4(transform).clone());
   }
  });
  if(!centers.length)return;
  const bounds=new THREE.Box3().setFromPoints(centers),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const tail=centers.filter(p=>p.z>=bounds.max.z-size.z*.2);
  points=[-1,1].map(side=>{
   const target=new THREE.Vector3(center.x+side*size.x*.25,center.y,bounds.max.z);
   let best=tail[0],distance=Infinity;for(const p of tail){const d=p.distanceToSquared(target);if(d<distance){distance=d;best=p;}}
   return best.toArray();
  });
  const minimum=((engines[0].userData.radius||0)+(engines[1].userData.radius||0))*1.1;
  const first=new THREE.Vector3().fromArray(points[0]);
  const separate=p=>Math.hypot(p.x-first.x,p.y-first.y)>=minimum;
  if(!separate(new THREE.Vector3().fromArray(points[1]))){
   const target=new THREE.Vector3(center.x+size.x*.25,center.y,bounds.max.z);
   // Narrow tail tips may put both nozzles on the same surface patch.
   // Broaden only within the surviving tail section; keep real hull contact.
   for(const band of [.2,.5,1]){
    let best=null,distance=Infinity;
    for(const p of centers)if(p.z>=bounds.max.z-size.z*band&&separate(p)){
     const d=p.distanceToSquared(target);if(d<distance){distance=d;best=p;}
    }
    if(best){points[1]=best.toArray();break;}
   }
  }
  if(key)surfaces.set(key,points);
 }
 engines.forEach((engine,i)=>{part.add(engine);engine.position.fromArray(points[i]);engine.position.z+=(engine.userData.length||.6)*.3;engine.userData.bossPart=5;});
 root.userData.planetBossEngines=points.map(p=>({section:5,position:[...p]}));
}
