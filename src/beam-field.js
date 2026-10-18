import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const UP=new THREE.Vector3(0,1,0);
export class BeamField{
 constructor(scene,capacity=512){
  this.capacity=capacity;this.cursor=0;this.active=0;this.from=new THREE.Vector3();this.to=new THREE.Vector3();this.delta=new THREE.Vector3();this.tint=new THREE.Color();this.alpha=new Float32Array(capacity);this.slots=Array.from({length:capacity},()=>({life:0,max:1}));this.dummy=new THREE.Object3D();
  const shell=new THREE.CylinderGeometry(2.8,2.8,1,16,1,true),core=new THREE.CylinderGeometry(.38,.38,1,12,1,true);
  shell.setAttribute('aCore',new THREE.BufferAttribute(new Float32Array(shell.attributes.position.count),1));core.setAttribute('aCore',new THREE.BufferAttribute(new Float32Array(core.attributes.position.count).fill(1),1));
  this.geometry=mergeGeometries([shell,core]);shell.dispose();core.dispose();this.geometry.setAttribute('aBeamAlpha',new THREE.InstancedBufferAttribute(this.alpha,1).setUsage(THREE.DynamicDrawUsage));
  this.material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'attribute float aCore;attribute float aBeamAlpha;varying float vCore;varying float vAlpha;varying vec3 vColor;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;void main(){vCore=aCore;vAlpha=aBeamAlpha;vColor=instanceColor;vUv=uv;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vNormal=normalize(mat3(modelViewMatrix)*mat3(instanceMatrix)*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform float time;varying float vCore;varying float vAlpha;varying vec3 vColor;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;void main(){if(vAlpha<.003)discard;float radial=pow(abs(dot(normalize(vNormal),normalize(vView))),1.4);float flow=.8+.2*sin(vUv.y*100.-time*42.);float flare=pow(1.-abs(vUv.y*2.-1.),.12);vec3 color=mix(vColor,vec3(1.,.96,.91),vCore*.95);gl_FragColor=vec4(color*(1.+vCore*.4),vAlpha*mix(.32*radial*flow,.96,vCore)*flare);}',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
  this.mesh=new THREE.InstancedMesh(this.geometry,this.material,capacity);this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.dummy.scale.setScalar(0);this.dummy.updateMatrix();for(let i=0;i<capacity;i++){this.mesh.setMatrixAt(i,this.dummy.matrix);this.mesh.setColorAt(i,new THREE.Color());}this.mesh.count=0;scene.add(this.mesh);
 }
 emit(from,to,color,width,life){
  const a=this.from.set(from.x,from.y,from.z),b=this.to.set(to.x,to.y,to.z),delta=this.delta.subVectors(b,a),length=delta.length();if(length<.01||!Number.isFinite(length))return;
  const i=this.active<this.capacity?this.active++:this.cursor++%this.capacity;this.slots[i].life=this.slots[i].max=life;this.dummy.position.copy(a).add(b).multiplyScalar(.5);this.dummy.quaternion.setFromUnitVectors(UP,delta.normalize());this.dummy.scale.set(width,length,width);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.mesh.setColorAt(i,this.tint.set(color));this.alpha[i]=1;this.mesh.count=this.active;this.mesh.instanceMatrix.needsUpdate=true;this.mesh.instanceColor.needsUpdate=true;this.geometry.attributes.aBeamAlpha.needsUpdate=true;
 }
 update(dt){
  this.material.uniforms.time.value+=dt;if(dt<=0||!this.active)return;
  let moved=false;for(let i=0;i<this.active;){const slot=this.slots[i];slot.life=Math.max(0,slot.life-dt);
   if(slot.life<=0){const last=--this.active;if(i!==last){this.slots[i]=this.slots[last];this.slots[last]=slot;this.mesh.instanceMatrix.array.copyWithin(i*16,last*16,last*16+16);this.mesh.instanceColor.array.copyWithin(i*3,last*3,last*3+3);this.alpha[i]=this.alpha[last];moved=true;}this.alpha[last]=0;continue;}
   this.alpha[i]=slot.life/slot.max;i++;
  }
  this.mesh.count=this.active;if(moved){this.mesh.instanceMatrix.needsUpdate=true;this.mesh.instanceColor.needsUpdate=true;}
  const attr=this.geometry.attributes.aBeamAlpha;attr.clearUpdateRanges();if(this.active)attr.addUpdateRange(0,this.active);attr.needsUpdate=true;
 }
 clear(){for(const slot of this.slots)slot.life=0;this.active=0;this.cursor=0;this.mesh.count=0;this.alpha.fill(0);this.geometry.attributes.aBeamAlpha.needsUpdate=true;}
}
