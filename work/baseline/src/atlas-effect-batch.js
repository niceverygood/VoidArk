import * as THREE from 'three';

const vertex=`attribute float atlasFrame;attribute float atlasOpacity;attribute vec3 atlasTint;varying vec2 vUv;varying float vFrame;varying float vOpacity;varying vec3 vTint;void main(){vUv=uv;vFrame=atlasFrame;vOpacity=atlasOpacity;vTint=atlasTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const fragment=`varying vec2 vUv;varying float vFrame;varying float vOpacity;varying vec3 vTint;uniform sampler2D atlas;void main(){float f=floor(clamp(vFrame,0.,15.));vec2 uv=(vUv+vec2(mod(f,4.),3.-floor(f/4.)))/4.;vec4 c=texture2D(atlas,uv);gl_FragColor=vec4(c.rgb*vTint,c.a*vOpacity);if(gl_FragColor.a<.004)discard;}`;

// Slots keep their native meshes/uniforms. Only additive draw representation changes.
export class AtlasEffectBatcher {
  constructor(scene,quad,textures,capacity=96) {
    this.groups=new Map();this.closed=false;this.locations=new WeakMap();
    for(const [type,texture] of textures) {
      if(type==='smoke')continue;
      const geometry=quad.clone(),frame=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage),opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage),tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('atlasFrame',frame);geometry.setAttribute('atlasOpacity',opacity);geometry.setAttribute('atlasTint',tint);
      const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{atlas:{value:texture}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
      const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='atlas-batch:'+type;mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.visible=false;scene.add(mesh);
      this.groups.set(type,{mesh,frame,opacity,tint,count:0,members:[]});
    }
  }
  begin(){for(const group of this.groups.values()){group.count=0;group.members.length=0;}}
  pack(group,index,slot) {
    const uniforms=slot.mesh.material.uniforms;slot.mesh.updateMatrix();group.mesh.setMatrixAt(index,slot.mesh.matrix);
    group.frame.setX(index,uniforms.frame.value);group.opacity.setX(index,uniforms.opacity.value);group.tint.setXYZ(index,uniforms.tint.value.r,uniforms.tint.value.g,uniforms.tint.value.b);
    group.members[index]=slot;let location=this.locations.get(slot);if(!location){location={};this.locations.set(slot,location);}location.group=group;location.index=index;
  }
  write(slot) {
    const group=this.groups.get(slot.type);if(!group||this.closed)return false;
    this.pack(group,group.count++,slot);return true;
  }
  publish(group) {
    const count=group.count;group.mesh.count=count;group.mesh.visible=count>0;
    if(!count)return;
    for(const attribute of [group.mesh.instanceMatrix,group.frame,group.opacity,group.tint]){attribute.clearUpdateRanges();attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;}
  }
  refresh(slot) {
    if(this.closed)return;
    const next=this.groups.get(slot.type),location=this.locations.get(slot);
    if(location&&location.group.members[location.index]===slot) {
      const prior=location.group,index=location.index;
      if(prior===next){this.pack(prior,index,slot);this.publish(prior);return;}
      const last=prior.members.pop();prior.count--;
      if(index<prior.count)this.pack(prior,index,last);
      this.publish(prior);
    }
    if(next){this.pack(next,next.count++,slot);this.publish(next);}
  }
  finish() {
    for(const group of this.groups.values())this.publish(group);
  }
  clear(){for(const group of this.groups.values()){group.count=0;group.members.length=0;group.mesh.count=0;group.mesh.visible=false;}}
  objects(){return [...this.groups.values()].map(group=>group.mesh);}
  dispose(){if(this.closed)return;this.closed=true;for(const {mesh} of this.groups.values()){mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}this.groups.clear();}
}
