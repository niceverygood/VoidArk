import {createWarningMaterial,createOrbitMaterial} from './transient-combat-materials.js';
import {receivedImpact} from './received-impact.js';
import {BeamField} from './beam-field.js';
import {EnergyShieldMaterial} from './energy-shield.js';
import {AnimatedVFX} from './animated-vfx.js';
import {SimpleEffectBatch} from './simple-effect-batch.js';
import {mountAsset} from './asset-library.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

const vec=p=>new THREE.Vector3(p.x,p.y,p.z);
const CYL=new THREE.CylinderGeometry(1,1,1,7,1,true);
const SPHERE=new THREE.IcosahedronGeometry(1,2);
const RING=new THREE.TorusGeometry(1,.018,5,96);
const UP=new THREE.Vector3(0,1,0);
const WHITE=new THREE.Color('#ddffff');

export class Effects {
  constructor(scene) {
    this.scene=scene;this.beamField=new BeamField(scene);this.atlas=new AnimatedVFX(scene);this.items=[];this.maxItems=128;this.capacity=5200;this.cursor=0;this.particleDirtyStart=this.capacity;this.particleDirtyEnd=0;
    this.simpleBatch=new SimpleEffectBatch(scene,SPHERE,RING,this.maxItems);
    this.particles=Array.from({length:this.capacity},()=>({life:0,max:1,v:new THREE.Vector3(),drag:1}));
    const n=this.capacity;
    this.positions=new Float32Array(n*3);this.colors=new Float32Array(n*3);this.sizes=new Float32Array(n);this.alphas=new Float32Array(n);
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha',new THREE.BufferAttribute(this.alphas,1).setUsage(THREE.DynamicDrawUsage));
    this.material=new THREE.ShaderMaterial({
      vertexShader:'attribute float aSize; attribute float aAlpha; varying vec3 vColor; varying float vAlpha; uniform float uScale; void main(){vColor=color;vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uScale/max(1.,-mv.z),1.,140.);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'varying vec3 vColor; varying float vAlpha; void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float glow=pow(1.-d,2.);float core=pow(1.-d,8.);gl_FragColor=vec4(vColor*(1.+core),glow*vAlpha);}',
      uniforms:{uScale:{value:900}},vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
    });
    this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;scene.add(this.points);
    this.chunkMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.35,.18,.55),new THREE.MeshStandardMaterial({color:0x98a7b3,metalness:.85,roughness:.45,emissive:0xff6420,emissiveIntensity:.16}),180);
    this.chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.chunkMesh.frustumCulled=false;scene.add(this.chunkMesh);this.chunks=Array.from({length:180},()=>({life:0,p:new THREE.Vector3(),v:new THREE.Vector3(),r:new THREE.Vector3(),scale:1,matrixActive:false}));this.chunkMatricesReady=false;this.chunkCursor=0;this.dummy=new THREE.Object3D();
    this.chunkAsset=new THREE.Group();mountAsset(this.chunkAsset,'wreck-fragment',{size:.6,onReady:model=>{model.updateMatrixWorld(true);const pieces=[];let material;model.traverse(o=>{if(o.isMesh){const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);pieces.push(g);material??=Array.isArray(o.material)?o.material[0]:o.material;}});if(!pieces.length)return;const merged=mergeGeometries(pieces,false);for(const g of pieces)g.dispose();if(merged){this.chunkMesh.geometry.dispose();this.chunkMesh.material.dispose();this.chunkMesh.geometry=merged;this.chunkMesh.material=material;}}});
  }
  spectacle(position,kind='arrival',radius=8){
    if(kind==='boost'&&(this.fxClock||0)-(this.lastBoost??-99)<1)return;
    this.atlas.emit(position,kind==='boost'?'ion':'warp',radius*3,kind==='boost'?.45:1.4);this.atlas.emit(position,'shockwave',radius*4,1);
    if(kind==='boost'){this.lastBoost=this.fxClock||0;this.shock(position,radius,'#89efff',.6);this.burst(position,'#89efff',1.5,24);return;}
    const color=({arrival:'#9aefff',departure:'#68ffc9',dock:'#83ffcb',service:'#a9ffcd',invasion:'#ff995b',conquest:'#d8b0ff',dash:'#ff6796',boost:'#89efff',evolve:'#d6c3ff'})[kind]||'#a5eaff';
    for(let i=0;i<3;i++)this.shock(position,radius*(1+i*.6),color,.7+i*.3,i===1);
    this.burst(position,color,Math.min(6,radius*.35),kind==='invasion'||kind==='conquest'?160:80);
    this.flash(position,Math.min(3,radius*.2),'#dcffff',.22);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,end=vec(position).add(new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius*.35,Math.sin(a)*radius));this.beam(position,end,color,.07,.45);}
  }
  flight(ship,dt,{enemy=false,boost=false}={}){
    if(dt<=0)return;const p=ship.position,state=ship.userData.flightFX||(ship.userData.flightFX={last:p.clone(),elapsed:0,ring:0});
    const scratch=this.flightScratch??={delta:new THREE.Vector3(),at:new THREE.Vector3(),random:new THREE.Vector3(),velocity:new THREE.Vector3(),nozzle:new THREE.Vector3()};
    const delta=scratch.delta.copy(p).sub(state.last),distance=delta.length();state.last.copy(p);if(distance>30)return;
    const speed=distance/dt;state.elapsed+=dt;state.ring+=dt;if(speed<1||state.elapsed<.08)return;state.elapsed=0;
    const direction=delta.normalize(),color=enemy?'#ff7497':boost?'#aaffff':'#6be5ff';
    if(boost){const nozzle=ship.userData.engines?.[0];if(nozzle){const at=nozzle.localToWorld(scratch.nozzle.set(0,0,nozzle.userData.length+1));this.atlas.emit(at,'engine',nozzle.userData.radius*7,.25,color);}}
    for(let i=0;i<(boost?12:4);i++){const at=scratch.at.copy(p).add(scratch.random.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(4));this.particle(at,color,boost?.8:.35,scratch.velocity.copy(direction).multiplyScalar(-Math.min(22,speed*.35)),boost?.8:.45,.5);}
    if((boost||Math.abs(direction.y)>.3)&&state.ring>.8){state.ring=0;this.shock(p,boost?6:3,color,.45,true,.35);}
  }
  particle(position,color,size=1,velocity=null,life=.5,drag=1) {
    const i=this.cursor++%this.capacity,p=this.particles[i];p.life=life;p.max=life;p.drag=drag;
    if(velocity)p.v.copy(velocity);else p.v.set(0,0,0);const j=i*3;this.positions[j]=position.x;this.positions[j+1]=position.y;this.positions[j+2]=position.z;
    let c=color;
    if(!(color instanceof THREE.Color)){
      if(typeof color==='string'||typeof color==='number'){
        const cache=this.particleColors??={enabled:THREE.ColorManagement.enabled,space:THREE.ColorManagement.workingColorSpace,values:new Map()};
        if(cache.enabled!==THREE.ColorManagement.enabled||cache.space!==THREE.ColorManagement.workingColorSpace){cache.enabled=THREE.ColorManagement.enabled;cache.space=THREE.ColorManagement.workingColorSpace;cache.values.clear();}
        c=cache.values.get(color);if(!c){c=new THREE.Color(color);if(cache.values.size>=32)cache.values.clear();cache.values.set(color,c);}
      }else{c=this.particleColorScratch??=new THREE.Color();c.r=c.g=c.b=1;c.set(color);}
    }
    this.colors[j]=c.r;this.colors[j+1]=c.g;this.colors[j+2]=c.b;this.sizes[i]=size;this.alphas[i]=1;
    this.particleDirtyStart=Math.min(this.particleDirtyStart,i);this.particleDirtyEnd=Math.max(this.particleDirtyEnd,i+1);
  }
  release(item){this.scene.remove(item.mesh);item.mat?.dispose();item.materials?.forEach(m=>m.dispose());if(item.ownGeometry)item.mesh.geometry.dispose();}
  addItem(item){if(this.items.length>=this.maxItems){const index=this.items.findIndex(i=>i.kind!=='warning');if(index<0){this.release(item);return;}this.release(this.items.splice(index,1)[0]);}item.baseOpacity=item.mat?.opacity??1;this.items.push(item);this.simpleBatch.add(item);}
  flash(position,size,color,life=.16){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const mesh=new THREE.Mesh(SPHERE,mat);mesh.position.copy(vec(position));mesh.scale.setScalar(.15);this.scene.add(mesh);this.addItem({kind:'sphere',mesh,mat,life,max:life,size});
  }
  shock(position,size,color,life=.32,billboard=false,opacity=.85){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const mesh=new THREE.Mesh(RING,mat);mesh.position.copy(vec(position));mesh.rotation.x=Math.PI/2;this.scene.add(mesh);this.addItem({kind:'ring',mesh,mat,life,max:life,size,billboard});
  }
  muzzle(position,direction,type='cannon'){
    const color=type==='missile'?'#ffba72':type==='fighter'?'#81c6ff':'#8fefff';
    this.atlas.emit(position,'spark',type==='missile'?3:1.8,.12,color);
    this.flash(position,type==='missile'?1.3:.7,color,.09);this.burst(position,color,.85,type==='missile'?16:10);
    const end=vec(position).addScaledVector(vec(direction),type==='missile'?2.8:1.5);this.beam(position,end,'#eaffff',type==='missile'?.15:.09,.08);
  }
  impact(event,origin){
    const color=event.critical?'#ffe385':({chain:'#bc9bff',missile:'#ffae68',laser:'#83ffe1',lance:'#ffcf8f',fighter:'#91c6ff',pulse:'#78ecff',nova:'#ffc17c'})[event.source]||'#9feeff';
    const power=Math.min(2.4,.7+Math.sqrt(Math.max(0,event.damage||0))/14),size=Math.min(3.5,Math.max(.8,(event.radius||1)*.65))*power;
    this.atlas.emit(event.position,event.source==='missile'?'explosion':'energy',size*3,.45,color);
    this.burst(event.position,color,size,Math.round(20+power*12));this.flash(event.position,size*.7,'#eaffff',.11);this.shock(event.position,size*1.7,color,.28,true);
    if(['missile','laser','lance','chain'].includes(event.source))this.shock(event.position,size*2,color,.4);
    const dir=origin?vec(event.position).sub(vec(origin)).normalize():new THREE.Vector3(0,1,0);
    for(let i=0;i<6;i++){const end=vec(event.position).addScaledVector(dir,2+Math.random()*size).add(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(size*2));this.beam(event.position,end,color,.04,.12+Math.random()*.1);}
  }
  received(position,shielded,amount,radius=4,response=receivedImpact({shielded,amount})){
    if(!response.active)return;radius*=response.scale;
    this.atlas.emit(position,shielded>0?'energy':'explosion',radius*2,response.life);if(shielded<amount)this.atlas.emit(position,'smoke',radius*2,.55+response.severity*.45);
    const shield=shielded>0,color=shield?'#78ddff':'#ff734d';
    this.burst(position,color,response.size,response.burst);this.shock(position,radius*1.25,color,response.life,true);if(!response.reduced)this.shock(position,radius,color,response.life*.8);
    if(response.flash)this.flash(position,Math.min(radius*.55,2.2),'#ffb48c',.11);
    if(response.spill&&!response.reduced){this.burst(position,'#ff784a',response.size,response.spillBurst);this.shock(position,radius*1.1,'#ff9b65',response.life*.85,true);}
    if(response.pulse)this.pulse(position,radius,'#66cfff');
  }
  burst(position,color='#ff9d43',size=3,count=60) {
    const pos=vec(position),c=new THREE.Color(color);
    for(let i=0;i<count;i++){const dir=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();const speed=(3+Math.random()*12)*Math.sqrt(size);this.particle(pos,i%5===0?WHITE:c,Math.random()*size*.35+.2,dir.multiplyScalar(speed),.35+Math.random()*1.1,1.8);}
  }
  explosion(position,size=3,color='#ffac52') {
    this.atlas.emit(position,'explosion',size*5,1);this.atlas.emit(position,'smoke',size*6,2.4);this.atlas.emit(position,'shockwave',size*7,.8);
    size*=1.35;this.burst(position,color,size,Math.min(300,90+Math.floor(size*12)));this.flash(position,Math.min(5,size*.65),'#fff1c7',.14);this.shock(position,size*2.6,color,.9,true);
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const mesh=new THREE.Mesh(SPHERE,mat);mesh.position.copy(vec(position));mesh.scale.setScalar(.3);this.scene.add(mesh);this.addItem({kind:'sphere',mesh,mat,life:.5,max:.5,size});
    const ringMat=mat.clone();const ring=new THREE.Mesh(RING,ringMat);ring.position.copy(mesh.position);ring.rotation.x=Math.PI/2;this.scene.add(ring);this.addItem({kind:'ring',mesh:ring,mat:ringMat,life:.7,max:.7,size:size*2.1});
    for(let i=0;i<Math.min(36,Math.floor(size*4));i++){const chunk=this.chunks[this.chunkCursor++%this.chunks.length];chunk.life=1+Math.random();chunk.p.copy(mesh.position);chunk.v.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(6+Math.random()*size*2);chunk.r.set(Math.random()*6,Math.random()*6,Math.random()*6);chunk.scale=.5+Math.random()*Math.min(size,3);}
  }
  beam(from,to,color='#80faff',width=.2,life=.12) {
    this.beamField.emit(from,to,color,width,life);
    if(width>=.5){this.atlas.emit(from,'energy',Math.min(8,width*5),.22,color);this.atlas.emit(to,'spark',Math.min(10,width*7),.3,color);}
  }
  skill(id,position,heading=0,stage=0){
    const color=({pulse:'#69eaff',barrage:'#ffb773',overcharge:'#ff87d1',nova:'#ff8b47',stasis:'#a78bff',repair:'#79ffc1',lance:'#ffe5a0',countermeasure:'#e9a4ff',sentry:'#83baff'})[id]||'#7eeaff';
    const radius=5+stage*2,center=vec(position);
    // Each skill has a different spatial silhouette, not just a recolored flash.
    if(id==='barrage'){
      for(let side=-1;side<=1;side+=2){const p=center.clone().add(new THREE.Vector3(Math.cos(heading)*side*radius,1,-Math.sin(heading)*side*radius));this.atlas.emit(p,'smoke',radius*1.4,1);this.atlas.emit(p,'spark',radius,.25,color);this.shock(p,3,color,.45);}
      this.shock(center,radius*1.5,color,.6);return;
    }
    if(id==='lance'){
      const direction=new THREE.Vector3(-Math.sin(heading),0,-Math.cos(heading)),end=center.clone().addScaledVector(direction,16);
      this.beam(center,end,color,.85,.4);for(let i=0;i<4;i++)this.shock(center.clone().addScaledVector(direction,i*2),2.2+i*.7,color,.5,true);this.atlas.emit(center,'energy',12,.5,color);return;
    }
    if(id==='repair'){
      for(let i=0;i<28;i++){const a=i*2.399,p=center.clone().add(new THREE.Vector3(Math.cos(a)*radius,(i%7)-3,Math.sin(a)*radius));this.particle(p,color,.7,center.clone().sub(p).multiplyScalar(.8),1.3,.2);}
      this.shock(center,radius,color,1.2);this.shock(center,radius*.8,color,1.4,true);return;
    }
    if(id==='stasis'){
      for(let i=0;i<3;i++){const axis=new THREE.Vector3(i===0?1:0,i===1?1:0,i===2?1:0);this.orbit(center,radius*2.8,axis,color,1.8,i*.5);}
      this.atlas.emit(center,'warp',radius*4,1.2,color);return;
    }
    if(id==='countermeasure'){
      for(let i=0;i<12;i++){const a=i*Math.PI/6,end=center.clone().add(new THREE.Vector3(Math.cos(a)*18,Math.sin(i*2)*8,Math.sin(a)*18));this.beam(center,end,color,.14,.5);this.atlas.emit(end,'spark',3,.7,color);}
      return;
    }
    if(id==='sentry'){
      for(let i=0;i<4;i++){const a=heading+i*Math.PI/2,p=center.clone().add(new THREE.Vector3(Math.cos(a)*radius*2,2,Math.sin(a)*radius*2));this.orbit(p,2.5,new THREE.Vector3(0,1,0),color,1);this.atlas.emit(p,'warp',6,.8,color);}
      return;
    }
    if(id==='overcharge'){
      for(let i=0;i<3;i++)this.orbit(center,radius*(1+i*.3),new THREE.Vector3(0,1,0),color,1.8,i*.6);
      for(let i=0;i<6;i++){const a=i*Math.PI/3,p=center.clone().add(new THREE.Vector3(Math.cos(a)*radius,Math.sin(a*2)*3,Math.sin(a)*radius));this.chain([center,p]);}
      return;
    }
    this.atlas.emit(center,id==='nova'?'explosion':'energy',radius*4,.8,color);
    for(let i=0;i<3;i++)this.orbit(center,radius*(1.5+i*.7),new THREE.Vector3(i===1?1:0,i!==1?1:0,.3),color,.7+i*.2,i*.5);
    this.burst(center,color,id==='nova'?5:3,id==='nova'?110:50);
  }
  orbit(position,size,axis,color,life=1,phase=0){
    const mat=createOrbitMaterial(color);
    const mesh=new THREE.Mesh(RING,mat);mesh.position.copy(vec(position));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis.clone().normalize());mesh.rotateZ(phase);this.scene.add(mesh);this.addItem({kind:'orbit',mesh,mat,life,max:life,size,phase});
  }
  chain(points) {
    for(let n=0;n<points.length-1;n++){
      const from=vec(points[n]),to=vec(points[n+1]),line=to.clone().sub(from),segments=Math.max(4,Math.min(13,Math.ceil(line.length()/3)));let previous=from;
      for(let i=1;i<=segments;i++){const t=i/segments;const pos=from.clone().addScaledVector(line,t);if(i!==segments)pos.add(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(2.7));this.beam(previous,pos,'#a9a0ff',.23,.24);if(i%3===0){const branch=pos.clone().add(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(5));this.beam(pos,branch,'#69cfff',.09,.18);}previous=pos;}
      this.burst(to,'#a3d4ff',1.7,14);
    }
  }
  pulse(position,radius,color=0x61ddff) {
    const mat=new EnergyShieldMaterial({color,opacity:.4});
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,3),mat);mesh.position.copy(vec(position));this.scene.add(mesh);this.addItem({kind:'sphere',mesh,mat,ownGeometry:true,life:.8,max:.8,size:radius});
    for(let i=0;i<3;i++){const m=new THREE.MeshBasicMaterial({color:i===1?0xffffff:color,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});const ring=new THREE.Mesh(RING,m);ring.position.copy(mesh.position);ring.rotation.set(i===0?Math.PI/2:i===1?.3:1.1,0,i*.7);this.scene.add(ring);this.addItem({kind:'ring',mesh:ring,mat:m,life:.65,max:.65,size:radius});}
  }
  warning(from,to,life=.8) {
    const a=vec(from),b=vec(to),points=[a,b];const g=new THREE.BufferGeometry().setFromPoints(points),mat=createWarningMaterial();const mesh=new THREE.Line(g,mat);mesh.computeLineDistances();this.scene.add(mesh);this.addItem({kind:'warning',mesh,mat,life,max:life,ownGeometry:true});
  }
  markParticleUpload(attribute,start,count) {
    // Keep writes that the renderer has not consumed, including skipped draws.
    const pending=attribute.updateRanges[0];
    if(pending){const end=Math.max(pending.start+pending.count,start+count);pending.start=Math.min(pending.start,start);pending.count=end-pending.start;}
    else attribute.addUpdateRange(start,count);
    attribute.needsUpdate=true;
  }
  flushParticleUploads() {
    const start=this.particleDirtyStart,end=this.particleDirtyEnd;
    if(end<=start)return;
    this.markParticleUpload(this.geometry.attributes.color,start*3,(end-start)*3);
    this.markParticleUpload(this.geometry.attributes.aSize,start,end-start);
    this.particleDirtyStart=this.capacity;this.particleDirtyEnd=0;
  }
  update(dt,time,camera,height) {
    this.atlas.update(dt,camera);this.beamField.update(dt);
    this.fxClock=(this.fxClock||0)+dt;
    this.material.uniforms.uScale.value=height*.8;
    // Spawn writes and unconsumed ranges must survive pauses and skipped draws.
    let positionStart=this.particleDirtyStart,positionEnd=this.particleDirtyEnd;
    let alphaStart=positionStart,alphaEnd=positionEnd;
    for(let i=0;i<this.capacity;i++){
      const p=this.particles[i],alpha=this.alphas[i];
      if(p.life<=0){if(alpha!==0){this.alphas[i]=0;alphaStart=Math.min(alphaStart,i);alphaEnd=Math.max(alphaEnd,i+1);}continue;}
      p.life-=dt;const j=i*3,x=this.positions[j],y=this.positions[j+1],z=this.positions[j+2];
      this.positions[j]+=p.v.x*dt;this.positions[j+1]+=p.v.y*dt;this.positions[j+2]+=p.v.z*dt;
      p.v.multiplyScalar(Math.exp(-dt*p.drag));this.alphas[i]=Math.max(0,p.life/p.max);
      if(this.positions[j]!==x||this.positions[j+1]!==y||this.positions[j+2]!==z){positionStart=Math.min(positionStart,i);positionEnd=Math.max(positionEnd,i+1);}
      if(this.alphas[i]!==alpha){alphaStart=Math.min(alphaStart,i);alphaEnd=Math.max(alphaEnd,i+1);}
    }
    if(positionEnd>positionStart)this.markParticleUpload(this.geometry.attributes.position,positionStart*3,(positionEnd-positionStart)*3);
    if(alphaEnd>alphaStart)this.markParticleUpload(this.geometry.attributes.aAlpha,alphaStart,alphaEnd-alphaStart);
    this.flushParticleUploads();
    const first=!this.chunkMatricesReady;let start=this.chunks.length,end=0;
    for(let i=0;i<this.chunks.length;i++){const c=this.chunks[i];c.life-=dt;if(c.life>0){c.p.addScaledVector(c.v,dt);c.v.multiplyScalar(Math.exp(-dt*.7));this.dummy.position.copy(c.p);this.dummy.rotation.set(c.r.x+time*2,c.r.y+time,c.r.z+time*3);this.dummy.scale.setScalar(c.scale*Math.min(1,c.life));}else{if(!first&&!c.matrixActive)continue;this.dummy.scale.setScalar(0);}this.dummy.updateMatrix();this.chunkMesh.setMatrixAt(i,this.dummy.matrix);const active=c.life>0;if(first||active||c.matrixActive){start=Math.min(start,i);end=i+1;}c.matrixActive=active;}
    this.chunkMatricesReady=true;if(end>start)this.markParticleUpload(this.chunkMesh.instanceMatrix,start*16,(end-start)*16);
    this.items=this.items.filter(item=>{item.life-=dt;const t=1-Math.max(0,item.life/item.max);if(item.kind==='sphere'||item.kind==='ring')item.mesh.scale.setScalar(.2+item.size*t);if(item.kind==='orbit'){item.mesh.scale.setScalar(item.size*(.85+t*.15));item.mesh.rotateZ(dt*1.7);}if(item.billboard)item.mesh.quaternion.copy(camera.quaternion);if(item.mat?.uniforms?.time)item.mat.uniforms.time.value=time;if(item.mat)item.mat.opacity=item.baseOpacity*(1-t);if(item.mat?.uniforms?.opacity)item.mat.uniforms.opacity.value=item.baseOpacity*(1-t);for(const m of item.materials||[])m.opacity=Math.max(0,1-t);if(item.life<=0){this.release(item);return false;}return true;});
    this.simpleBatch.update(this.items);
  }
  setBatchRendering(enabled){this.simpleBatch.setEnabled(enabled,this.items);this.atlas.setBatchRendering?.(enabled);}
  preparationObjects(){return [...this.simpleBatch.meshes,...(this.atlas.preparationResources().objects||[])].map(source=>{const proxy=Object.create(source);proxy.visible=true;proxy.count=source.isInstancedMesh?1:source.count;return proxy;});}
  clear() {this.atlas.clear();this.beamField.clear();this.simpleBatch.clear();for(const item of this.items)this.release(item);this.items=[];this.particles.forEach(p=>p.life=0);this.chunks.forEach(c=>c.life=0);}
}
