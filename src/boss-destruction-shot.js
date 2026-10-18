import * as THREE from 'three';
import {animateShip} from './models.js';
import {AnimatedVFX} from './animated-vfx.js';
export const BOSS_DESTRUCTION_SECONDS=5;
export function createBossDestructionShot(boss){
 const group=new THREE.Group();group.add(boss);boss.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(boss),center=bounds.getCenter(new THREE.Vector3()),radius=Math.max(5,...bounds.getSize(new THREE.Vector3()).toArray())*.5;
 const parts=(boss.userData.parts||[]).map((part,i)=>({part,position:part.position.clone(),rotation:part.rotation.clone(),drift:new THREE.Vector3(Math.sin(i*2.4)*1.8,.4+Math.cos(i), (i-3)*.55)}));
 const geometry=new THREE.IcosahedronGeometry(1,2),ringGeometry=new THREE.TorusGeometry(1,.035,6,64),materials=[];
 const fire=Array.from({length:9},(_,i)=>{const material=new THREE.MeshBasicMaterial({color:i===0?0xfff0c4:i%2?0xff8a35:0xbb74ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});materials.push(material);const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(center).add(new THREE.Vector3(Math.sin(i*2.3),Math.cos(i*1.7)*.4,Math.cos(i*2.3)).multiplyScalar(i?radius*.65:0));group.add(mesh);return mesh;});
 const rings=Array.from({length:2},(_,i)=>{const material=new THREE.MeshBasicMaterial({color:i?0xa77cff:0xffbd72,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});materials.push(material);const mesh=new THREE.Mesh(ringGeometry,material);mesh.position.copy(center);mesh.rotation.x=i?Math.PI/3:Math.PI/2;group.add(mesh);return mesh;});
 const light=new THREE.PointLight(0xffa34c,0,radius*10);light.position.copy(center);group.add(light);const atlas=new AnimatedVFX(group);for(const mesh of fire){atlas.emit(mesh.position,'explosion',radius*2,1.3);atlas.emit(mesh.position,'smoke',radius*2,2.2);}let disposed=false,started=false,lastTime=0;const fired=new Set();
 return {group,async prepare(cancelled=()=>false){for(let i=0;i<300&&!atlas.preparationResources().ready;i++){if(cancelled())return false;await new Promise(done=>setTimeout(done,16));}return !cancelled()&&atlas.preparationResources().ready;},update(t,camera){
  if(!started){atlas.clear();started=true;}const time=Math.max(0,t),split=Math.max(0,time-2.1),active=time<BOSS_DESTRUCTION_SECONDS;group.visible=active;boss.visible=time<4.65;
  animateShip(boss,time,{thrust:.35});
  for(const entry of parts){entry.part.position.copy(entry.position).addScaledVector(entry.drift,split*split*.65);entry.part.rotation.copy(entry.rotation);entry.part.rotation.x+=split*.12;entry.part.rotation.z+=split*.15;entry.part.visible=true;}
  fire.forEach((mesh,i)=>{const age=time-(i?1.45+i*.095:2.1),duration=i?1.3:1.5,u=Math.max(0,Math.min(1,age/duration));mesh.visible=false;if(age>=0&&!fired.has(i)){fired.add(i);atlas.emit(mesh.position,'explosion',radius*(i?1.25:3),i?1.2:1.5);atlas.emit(mesh.position,'smoke',radius*(i?1.4:3.2),2.2);}mesh.scale.setScalar(radius*(i?.14:.85)*(.1+u*2.5));mesh.material.opacity=age<0?0:Math.sin(u*Math.PI)*(i?.65:.9);});
  rings.forEach((mesh,i)=>{const age=time-2.15-i*.12;mesh.visible=age>=0&&age<2;mesh.scale.setScalar(radius*(.3+Math.max(0,age)*2.4));mesh.material.opacity=Math.max(0,1-age/2)*.65;});
  light.intensity=time<1.4?0:Math.max(0,Math.sin((time-1.4)*Math.PI/2))*radius*35;
  const dolly=Math.min(1,time/2.1),distance=radius*(2.85-dolly*.55);camera.position.copy(center).add(new THREE.Vector3(Math.sin(.35+time*.07)*distance,radius*.75,Math.cos(.35+time*.07)*distance));camera.lookAt(center);camera.updateMatrixWorld(true);atlas.update(Math.max(0,Math.min(.1,time-lastTime)),camera);lastTime=time;
  return {phase:time<1.45?'closeup':time<2.1?'chain-explosions':time<5?'hull-destruction':'complete',active};
 },dispose(){if(disposed)return;disposed=true;group.removeFromParent();boss.userData.dispose?.();atlas.dispose();geometry.dispose();ringGeometry.dispose();materials.forEach(m=>m.dispose());}};
}
