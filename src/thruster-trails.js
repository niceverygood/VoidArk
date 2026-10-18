import * as THREE from 'three';

// Fixed pool: trails stay in world space instead of following the ship.
export class ThrusterTrails {
  constructor(scene,capacity=10000) {
    this.capacity=capacity;this.cursor=0;this.time=0;this.tracks=new Map();
    this.life=new Float32Array(capacity);this.maxLife=new Float32Array(capacity);
    this.fade=new Float32Array(capacity);this.renderFade=new Float32Array(capacity);this.matrices=[new Float32Array(capacity*16),new Float32Array(capacity*16)];this.tints=new Float32Array(capacity*3);this.geometry=new THREE.CylinderGeometry(1,1,1,6,1,true);
    this.geometry.setAttribute('aFade',new THREE.InstancedBufferAttribute(this.renderFade,1).setUsage(THREE.DynamicDrawUsage));
    const material=opacity=>new THREE.ShaderMaterial({
      uniforms:{opacity:{value:opacity}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
      vertexShader:'attribute float aFade; varying float fade; varying vec3 tint; void main(){fade=aFade;tint=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float opacity; varying float fade; varying vec3 tint; void main(){if(fade<=0.)discard;gl_FragColor=vec4(tint,fade*opacity);}',
    });
    this.meshes=[new THREE.InstancedMesh(this.geometry,material(.38),capacity),new THREE.InstancedMesh(this.geometry,material(.8),capacity)];
    this.dummy=new THREE.Object3D();this.up=new THREE.Vector3(0,1,0);this.delta=new THREE.Vector3();this.origin=new THREE.Vector3();this.color=new THREE.Color();
    for(const mesh of this.meshes){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.setColorAt(0,this.color);mesh.count=0;scene.add(mesh);}
    this.meshes[1].instanceColor=this.meshes[0].instanceColor;
  }
  emit(ship,dt,{enemy=false,boost=false,scale=1}={}) {
    if(dt<=0)return;
    ship.updateWorldMatrix(true,false);
    for(const nozzle of ship.userData.engines||[]) {
      if(!nozzle.visible)continue;nozzle.updateWorldMatrix(true,false);
      this.origin.set(0,0,nozzle.userData.length*.6).applyMatrix4(nozzle.matrixWorld);
      let track=this.tracks.get(nozzle.uuid);
      if(!track){track={last:this.origin.clone(),elapsed:0,seen:this.time};this.tracks.set(nozzle.uuid,track);}
      track.seen=this.time;track.elapsed+=dt;
      if(track.elapsed<1/30)continue;
      track.elapsed=0;this.delta.copy(this.origin).sub(track.last);
      const distance=this.delta.length();
      if(distance>.025&&distance<12){
        const i=this.cursor++%this.capacity;
        this.life[i]=this.maxLife[i]=boost?3.6:enemy?2.2:2.8;
        this.fade[i]=1;
        this.dummy.position.copy(this.origin).add(track.last).multiplyScalar(.5);
        this.dummy.quaternion.setFromUnitVectors(this.up,this.delta.multiplyScalar(1/distance));
        const width=Math.max(.1,nozzle.userData.radius*.95*scale)*(boost?2.2:1);
        this.color.set(enemy?0xff557e:(ship.userData.trailColor||0x35eaff));
        this.meshes.forEach((mesh,index)=>{
          this.dummy.scale.set(width*(index?.28:1),distance+.04,width*(index?.28:1));this.dummy.updateMatrix();
          this.dummy.matrix.toArray(this.matrices[index],i*16);this.color.toArray(this.tints,i*3);
          mesh.count=Math.min(this.cursor,this.capacity);
        });
      }
      track.last.copy(this.origin);
    }
  }
  update(dt) {
    this.time+=dt;
    const limit=Math.min(this.cursor,this.capacity),first=this.meshes[0],second=this.meshes[1];
    const a=first.instanceMatrix.array,b=second.instanceMatrix.array,colors=first.instanceColor.array;
    let live=0,start=-1,destination=0;
    // Matrix/color sources stay in ring-slot order. Copy uninterrupted live
    // spans together while packing the visible prefix in that same order.
    const flush=end=>{
      if(start<0)return;
      const count=end-start;
      if(count>=4){
        a.set(this.matrices[0].subarray(start*16,end*16),destination*16);
        b.set(this.matrices[1].subarray(start*16,end*16),destination*16);
        colors.set(this.tints.subarray(start*3,end*3),destination*3);
      }else for(let i=0;i<count;i++){
        const source=(start+i)*16,target=(destination+i)*16;
        for(let j=0;j<16;j++){a[target+j]=this.matrices[0][source+j];b[target+j]=this.matrices[1][source+j];}
        for(let j=0;j<3;j++)colors[(destination+i)*3+j]=this.tints[(start+i)*3+j];
      }
      start=-1;
    };
    for(let i=0;i<limit;i++){
      this.life[i]=Math.max(0,this.life[i]-dt);
      this.fade[i]=Math.pow(this.life[i]/this.maxLife[i],1.7);
      if(this.life[i]<=0){flush(i);continue;}
      if(start<0){start=i;destination=live;}
      this.renderFade[live]=this.fade[i];live++;
    }
    flush(limit);
    for(const mesh of this.meshes)mesh.count=live;
    for(const [id,track] of this.tracks)if(this.time-track.seen>.2)this.tracks.delete(id);
    if(live){
      const fade=this.geometry.attributes.aFade;fade.clearUpdateRanges();fade.addUpdateRange(0,live);fade.needsUpdate=true;
      first.instanceColor.clearUpdateRanges();first.instanceColor.addUpdateRange(0,live*3);first.instanceColor.needsUpdate=true;
      for(const mesh of this.meshes){mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,live*16);mesh.instanceMatrix.needsUpdate=true;}
    }
  }
  clear(){this.life.fill(0);this.fade.fill(0);this.cursor=0;this.tracks.clear();for(const mesh of this.meshes)mesh.count=0;}
}


