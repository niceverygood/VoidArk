import * as THREE from 'three';
import {mountAsset} from './asset-library.js';
import {accretionMaterial,stormMaterial} from './cosmic-material.js';
export function createCosmicModel(h){
 const root=new THREE.Group(),color=h.cosmic==='storm'?0xffac46:0xb584ff;
 const material=(c,opacity=1)=>new THREE.MeshBasicMaterial({color:c,transparent:opacity<1,opacity,depthWrite:opacity===1,toneMapped:false,side:THREE.DoubleSide});
 if(h.cosmic==='blackhole'){
 root.add(new THREE.Mesh(new THREE.SphereGeometry(4.5,24,16),material(0x010008)));
 const disk=new THREE.Mesh(new THREE.RingGeometry(5.5,13,128),accretionMaterial());disk.rotation.x=Math.PI/2-.3;root.add(disk);
 const lens=new THREE.Mesh(new THREE.RingGeometry(5.5,13,128),accretionMaterial());lens.scale.y=.32;root.add(lens);
 for(const [radius,c] of [[5,0xffe2a1],[13,0xff7544],[h.radius,0xb584ff]]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,radius===h.radius?.07:.22,6,64),material(c,.8));ring.rotation.x=Math.PI/2-.3;root.add(ring);}
 }else if(h.cosmic==='storm'){
 const shell=new THREE.Mesh(new THREE.SphereGeometry(h.radius,40,24),stormMaterial(color,h.radius));root.add(shell);
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(h.radius*(.65+i*.12),.12,5,64),material(color,.6));ring.rotation.set(i*.8,0,i*.6);root.add(ring);}
 }else{
 const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(h.radius,1),new THREE.MeshStandardMaterial({color:0x58413b,emissive:0xe14b15,emissiveIntensity:1.2,roughness:.9}));root.add(rock);
 const tail=new THREE.Mesh(new THREE.ConeGeometry(2,20,10),material(0xffb16a,.35));tail.position.y=-10;root.add(tail);
 }
 const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});root.userData.dispose=()=>{for(const r of resources)r.dispose();};if(h.cosmic==='meteor')mountAsset(root,'asteroid-basalt',{size:h.radius*2,hide:root.children.filter(o=>o.isMesh&&o.material.isMeshStandardMaterial)});return root;
}
export function animateCosmic(root,h,time){root.position.set(h.position.x,h.position.y,h.position.z);if(h.velocity){root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(h.velocity.x,h.velocity.y,h.velocity.z).normalize());}else root.rotation.y=time*.25;
 const scale=h.warning>0?.85+Math.sin(time*9)*.06:1;root.scale.setScalar(scale);for(const child of root.children){if(child.material?.transparent){const opacity=(h.warning>0?.25:.65)*(h.life<2?h.life/2:1);child.material.opacity=opacity;if(child.material.uniforms){child.material.uniforms.opacity.value=opacity;child.material.uniforms.time.value=time;}}}
}
