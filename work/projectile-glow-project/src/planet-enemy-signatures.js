import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const resources=new Map();
const supported=new Set(['saturn','uranus']);
function build(planet){
 const vertical=planet==='uranus',radius=3.05,axis=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(vertical?0:Math.PI/2,vertical?Math.PI/2:0,0));
 const parts=[new THREE.TorusGeometry(radius,.075,6,48).applyMatrix4(axis)],lights=[];
 const color=vertical?0x94dadc:0xc9b17d;
 const point=a=>new THREE.Vector3(vertical?0:Math.cos(a)*radius,vertical?Math.cos(a)*radius:0,Math.sin(a)*radius);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,p=point(a),rotation=vertical?new THREE.Euler(a,0,0):new THREE.Euler(0,-a,0);
  const matrix=new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromEuler(rotation),new THREE.Vector3(1,1,1));
  parts.push(new THREE.BoxGeometry(vertical?.12:.32,vertical?.32:.12,.34).applyMatrix4(matrix));
  lights.push(new THREE.BoxGeometry(vertical?.035:.19,vertical?.19:.035,.15).applyMatrix4(matrix));
 }
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2,p=point(a).multiplyScalar(.67),rotation=vertical?new THREE.Euler(a,0,0):new THREE.Euler(0,-a,0);
  const matrix=new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromEuler(rotation),new THREE.Vector3(1,1,1));
  parts.push(new THREE.BoxGeometry(vertical?.12:radius*.66,vertical?radius*.66:.12,.13).applyMatrix4(matrix));
 }
 const armor=mergeGeometries(parts,false),signal=mergeGeometries(lights,false);for(const g of [...parts,...lights])g.dispose();
 armor.computeBoundingSphere();signal.computeBoundingSphere();
 const distant=new THREE.TorusGeometry(radius,.075,4,32).applyMatrix4(axis);distant.computeBoundingSphere();armor.userData.distantLOD=distant;
 return {armor,signal,metal:new THREE.MeshStandardMaterial({color,metalness:.8,roughness:.32}),glow:new THREE.MeshStandardMaterial({color:vertical?0xc4ffff:0xffde9e,emissive:vertical?0x5ebfc9:0xc3984e,emissiveIntensity:.65,metalness:.45,roughness:.3})};
}
// Only the small fighter hulls whose generated designs lack open hoops need this.
// Resources are shared by two fixed profiles; no per-frame allocation or new textures.
export function installPlanetSignature(root,planet,hullRole){
 if(hullRole!=='fighter'||!supported.has(planet)||root.userData.planetSignature)return null;
 if(!resources.has(planet))resources.set(planet,build(planet));
 const data=resources.get(planet),group=new THREE.Group();group.name='planetary-orbital-frame';
 const armor=new THREE.Mesh(data.armor,data.metal),signal=new THREE.Mesh(data.signal,data.glow);armor.name='orbital-frame-armor';signal.name='orbital-frame-signals';signal.userData.planetSignatureDetail=true;group.add(armor,signal);
 root.userData.visualRoot.add(group);root.userData.planetSignature={planet,axis:planet==='uranus'?'vertical':'horizontal',group};return group;
}

