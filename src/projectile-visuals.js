import {createProjectileGlowMaterial} from './transient-combat-materials.js';
import * as THREE from 'three';
import {mountAsset,acquireWarmupAssets} from './asset-library.js';

export const PROJECTILE_LOOKS=Object.freeze({
 ark:{asset:'fx-ark-missile',color:'#7befff',size:1.65,width:.13,life:.65},
 hostile:{asset:'fx-hostile-missile',color:'#ff536d',size:1.9,width:.15,life:.8},
 swarm:{asset:'fx-swarm-missile',color:'#ffba68',size:1.25,width:.1,life:.85},
 siege:{asset:'fx-siege-torpedo',color:'#ff914f',size:2.6,width:.23,life:1},
 ion:{asset:'fx-ion-bolt',color:'#84faff',size:1.1,width:.07,life:.18},
 plasma:{asset:'fx-plasma-bolt',axisSign:1,color:'#ff5d94',size:1.4,width:.1,life:.28},
});
export function projectileLook(shot){return shot.type==='missile'?(shot.visualVariant==='barrage'?'swarm':'ark'):shot.type==='enemyMissile'?'hostile':shot.type==='boss'?'siege':shot.friendly?'ion':'plasma';}
const BODY=new THREE.CylinderGeometry(.12,.17,1,12),NOSE=new THREE.ConeGeometry(.12,.35,12),FIN=new THREE.BoxGeometry(.36,.28,.045),SPHERE=new THREE.SphereGeometry(1,12,8);
const UP=new THREE.Vector3(0,1,0);

export class ProjectileVisuals{
 constructor(scene,{acquireAssets=acquireWarmupAssets}={}){
  const assets=acquireAssets(Object.values(PROJECTILE_LOOKS).map(p=>p.asset));
  this.releasePreload=()=>assets.release();this.warmObjects=[];this.warmReady=false;this.warmClosed=false;
  this.preparationReady=assets.ready.then(sources=>{
   if(this.warmClosed)return false;
   // Read-only render proxies borrow the same materials/buffers as mounted
   // projectiles. The asset lease owns them; never dispose borrowed resources.
   for(const source of sources)source?.traverse(o=>{if(o.isMesh){const proxy=new THREE.Mesh(o.geometry,o.material);proxy.frustumCulled=false;proxy.receiveShadow=o.receiveShadow;this.warmObjects.push(proxy);}});
   this.warmReady=true;return true;
  });
  this.direction=new THREE.Vector3();this.delta=new THREE.Vector3();this.colors=new Map();this.capacity=4096;this.cursor=0;this.alpha=new Float32Array(this.capacity);this.renderAlpha=new Float32Array(this.capacity);this.matrices=new Float32Array(this.capacity*16);this.tints=new Float32Array(this.capacity*3);this.life=new Float32Array(this.capacity);this.max=new Float32Array(this.capacity);this.dummy=new THREE.Object3D();
  // Source buffers are fixed for this pool's lifetime; reuse views during
  // prefix compaction instead of allocating two per live wake every frame.
  this.matrixViews=Array.from({length:this.capacity},(_,i)=>this.matrices.subarray(i*16,i*16+16));
  this.tintViews=Array.from({length:this.capacity},(_,i)=>this.tints.subarray(i*3,i*3+3));
  this.geometry=new THREE.CylinderGeometry(1,1,1,12,1,true);
  this.geometry.setAttribute('aFade',new THREE.InstancedBufferAttribute(this.renderAlpha,1).setUsage(THREE.DynamicDrawUsage));
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
   vertexShader:'attribute float aFade;varying float fade;varying vec3 tint;varying vec2 vUv;void main(){fade=aFade;tint=instanceColor;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:'varying float fade;varying vec3 tint;varying vec2 vUv;void main(){if(fade<.002)discard;float soft=pow(sin(vUv.x*3.14159265),2.);gl_FragColor=vec4(mix(tint,vec3(1.),fade*.25),fade*.62*soft);}' });
  this.mesh=new THREE.InstancedMesh(this.geometry,this.material,this.capacity);this.mesh.setColorAt(0,new THREE.Color());this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.mesh);
 }
 create(shot){
  const look=PROJECTILE_LOOKS[projectileLook(shot)],root=new THREE.Group(),fallback=new THREE.Group(),bodyMat=new THREE.MeshStandardMaterial({color:shot.friendly?'#c5d8d9':'#443039',metalness:.85,roughness:.28}),glowMat=createProjectileGlowMaterial(look.color);
  const body=new THREE.Mesh(BODY,bodyMat),nose=new THREE.Mesh(NOSE,bodyMat);nose.position.y=.65;fallback.add(body,nose);
  for(let i=0;i<4;i++){const fin=new THREE.Mesh(FIN,bodyMat);fin.position.y=-.32;fin.rotation.y=i*Math.PI/2;fallback.add(fin);}fallback.scale.setScalar(look.size*.7);root.add(fallback);
  const plume=new THREE.Mesh(SPHERE,glowMat);plume.rotation.z=Math.PI;plume.position.y=-look.size*.85;plume.scale.set(look.width*1.1,look.size*.65,look.width*1.1);root.add(plume);
  const coreMat=glowMat.clone();coreMat.uniforms.tint.value.set('#fff6d9');coreMat.uniforms.strength.value=.68;const core=new THREE.Mesh(SPHERE,coreMat);core.rotation.z=Math.PI;core.position.y=-look.size*.7;core.scale.set(look.width*.8,look.size*.5,look.width*.8);root.add(core);
  if(['ion','plasma'].includes(projectileLook(shot))){const aura=new THREE.Mesh(SPHERE,glowMat);aura.scale.set(.15,look.size*.48,.15);root.add(aura);}
  root.userData.glowMaterials=[glowMat,coreMat];root.userData.look=look;root.userData.plume=plume;root.userData.dispose=()=>{bodyMat.dispose();glowMat.dispose();coreMat.dispose();};
  mountAsset(root,look.asset,{size:look.size,longAxis:'y',axisSign:look.axisSign||-1,hide:[fallback],onReady:()=>{root.userData.ready=true;}});return root;
 }
 update(root,shot,dt,time,active=true){
  root.position.set(shot.position.x,shot.position.y,shot.position.z);const direction=this.direction.set(shot.direction.x,shot.direction.y,shot.direction.z);if(direction.lengthSq()>.0001)root.quaternion.setFromUnitVectors(UP,direction.normalize());
  for(const mat of root.userData.glowMaterials)mat.uniforms.time.value=time;const look=root.userData.look;root.userData.plume.scale.y=look.size*(.8+Math.sin(time*32+shot.id)*.055);
  if(!active||dt<=0)return;
  const previous=root.userData.last;
  if(previous){const end=root.position,delta=this.delta.copy(end).sub(previous),length=delta.length();if(length>.01&&length<20){const i=this.cursor++%this.capacity;this.life[i]=this.max[i]=look.life;this.alpha[i]=1;this.dummy.position.copy(previous).add(end).multiplyScalar(.5);this.dummy.quaternion.setFromUnitVectors(UP,delta.normalize());this.dummy.scale.set(look.width,length+.025,look.width);this.dummy.updateMatrix();this.dummy.matrix.toArray(this.matrices,i*16);this.mesh.setMatrixAt(i,this.dummy.matrix);if(!this.colors.has(look.color))this.colors.set(look.color,new THREE.Color(look.color));this.colors.get(look.color).toArray(this.tints,i*3);this.mesh.count=Math.min(this.capacity,this.cursor);}}
  if(!root.userData.last)root.userData.last=root.position.clone();else root.userData.last.copy(root.position);
 }
 tick(dt){
  const end=Math.min(this.cursor,this.capacity);
  for(let i=0;i<end;i++){this.life[i]=Math.max(0,this.life[i]-dt);this.alpha[i]=Math.pow(this.life[i]/this.max[i],1.5);}
  let live=0;
  for(let i=0;i<end;i++){if(this.life[i]<=0)continue;this.renderAlpha[live]=this.alpha[i];this.mesh.instanceMatrix.array.set(this.matrixViews[i],live*16);this.mesh.instanceColor.array.set(this.tintViews[i],live*3);live++;}
  this.mesh.count=live;if(!live)return;
  // Compaction draws only this prefix; replace pending ranges after shrinkage.
  const fade=this.geometry.attributes.aFade,matrix=this.mesh.instanceMatrix,color=this.mesh.instanceColor;
  fade.clearUpdateRanges();fade.addUpdateRange(0,live);fade.needsUpdate=true;
  matrix.clearUpdateRanges();matrix.addUpdateRange(0,live*16);matrix.needsUpdate=true;
  color.clearUpdateRanges();color.addUpdateRange(0,live*3);color.needsUpdate=true;
 }
 clear(){this.life.fill(0);this.alpha.fill(0);this.cursor=0;this.mesh.count=0;}
 preparationResources(){return {ready:this.warmReady&&!this.warmClosed,objects:this.warmObjects};}
 dispose(){if(this.warmClosed)return;this.warmClosed=true;this.warmReady=false;this.warmObjects=[];this.releasePreload();this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
