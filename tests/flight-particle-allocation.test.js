import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Effects} from '../src/effects.js';

// Frozen pre-optimization methods are the behavioral oracle, including operation
// order, the three random draws per flight particle, and caller-owned colors.
function originalFlight(ship,dt,{enemy=false,boost=false}={}){
 if(dt<=0)return;const p=ship.position,state=ship.userData.flightFX||(ship.userData.flightFX={last:p.clone(),elapsed:0,ring:0});
 const delta=p.clone().sub(state.last),distance=delta.length();state.last.copy(p);if(distance>30)return;
 const speed=distance/dt;state.elapsed+=dt;state.ring+=dt;if(speed<1||state.elapsed<.08)return;state.elapsed=0;
 const direction=delta.normalize(),color=enemy?'#ff7497':boost?'#aaffff':'#6be5ff';
 if(boost){const nozzle=ship.userData.engines?.[0];if(nozzle){const at=nozzle.localToWorld(new THREE.Vector3(0,0,nozzle.userData.length+1));this.atlas.emit(at,'engine',nozzle.userData.radius*7,.25,color);}}
 for(let i=0;i<(boost?12:4);i++){const at=p.clone().add(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(4));this.particle(at,color,boost?.8:.35,direction.clone().multiplyScalar(-Math.min(22,speed*.35)),boost?.8:.45,.5);}
 if((boost||Math.abs(direction.y)>.3)&&state.ring>.8){state.ring=0;this.shock(p,boost?6:3,color,.45,true,.35);}
}
function originalParticle(position,color,size=1,velocity=null,life=.5,drag=1){
 const i=this.cursor++%this.capacity,p=this.particles[i];p.life=life;p.max=life;p.drag=drag;
 p.v.copy(velocity||new THREE.Vector3());const j=i*3;this.positions[j]=position.x;this.positions[j+1]=position.y;this.positions[j+2]=position.z;
 const c=color instanceof THREE.Color?color:new THREE.Color(color);this.colors[j]=c.r;this.colors[j+1]=c.g;this.colors[j+2]=c.b;this.sizes[i]=size;this.alphas[i]=1;
 this.particleDirtyStart=Math.min(this.particleDirtyStart,i);this.particleDirtyEnd=Math.max(this.particleDirtyEnd,i+1);
}
function fixture(original=false,count=120){
 const fx=Object.create(Effects.prototype);Object.assign(fx,{scene:new THREE.Scene(),capacity:128,cursor:0,particleDirtyStart:128,particleDirtyEnd:0,positions:new Float32Array(384),colors:new Float32Array(384),sizes:new Float32Array(128),alphas:new Float32Array(128),particles:Array.from({length:128},()=>({v:new THREE.Vector3()})),items:[],atlasLog:[]});
 fx.addItem=item=>fx.items.push(item);fx.atlas={emit(position,...args){fx.atlasLog.push({position:position.toArray(),args,roll:Math.random()});}};
 if(original){fx.flight=originalFlight;fx.particle=originalParticle;}
 const ships=Array.from({length:count},(_,i)=>{const ship=new THREE.Group(),nozzle=new THREE.Group();nozzle.position.set(.2,.3,.4);nozzle.userData={length:2,radius:.8};ship.add(nozzle);ship.userData.engines=[nozzle];ship.position.set(i*.3,i*.1,-i);return ship;});
 return {fx,ships};
}
function seeded(callback){const previous=Math.random;let seed=91471,calls=0;Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{return {value:callback(),calls};}finally{Math.random=previous;}}
function run(original){const {fx,ships}=fixture(original);return seeded(()=>{
 for(let frame=0;frame<65;frame++)for(let i=0;i<ships.length;i++){
  const ship=ships[i];ship.position.x+=.3;ship.position.y+=i%3===0?.2:0;ship.position.z-=.1;if(frame===27)ship.position.x+=100;if(frame===28)ship.position.x-=100;
  fx.flight(ship,[0,.01,.0167,.09][frame%4],{enemy:i%3!==0,boost:i%11===0});
 }
 return {cursor:fx.cursor,positions:[...fx.positions],colors:[...fx.colors],sizes:[...fx.sizes],alphas:[...fx.alphas],particles:fx.particles.map(p=>({life:p.life,max:p.max,drag:p.drag,v:p.v.toArray()})),dirty:[fx.particleDirtyStart,fx.particleDirtyEnd],atlas:fx.atlasLog,items:fx.items.map(item=>({kind:item.kind,position:item.mesh.position.toArray(),rotation:item.mesh.rotation.toArray(),color:item.mat.color.toArray(),opacity:item.mat.opacity,life:item.life,max:item.max,size:item.size,billboard:item.billboard})),flightStates:ships.map(ship=>({last:ship.userData.flightFX.last.toArray(),elapsed:ship.userData.flightFX.elapsed,ring:ship.userData.flightFX.ring}))};
 });}

test('120-ship actual flight/particle paths match original RNG, Float32 buffers, velocities, atlas and shock items exactly',()=>{
 const before=run(true),after=run(false);assert.equal(after.calls,before.calls);assert.deepEqual(after.value,before.value);assert.ok(after.value.atlas.length>0);assert.ok(after.value.items.length>0);assert.ok(after.value.cursor>128);
});
test('particle caching never mutates caller color/vector, resets absent velocity and stays bounded across color-management changes',()=>{
 const before=fixture(true,0).fx,after=fixture(false,0).fx,position=new THREE.Vector3(1,2,3),velocity=new THREE.Vector3(4,5,6),color=new THREE.Color('#abcdef'),original=color.toArray(),colorManagement=THREE.ColorManagement.enabled;
 try{
  for(const enabled of [true,false,true]){THREE.ColorManagement.enabled=enabled;for(const value of [color,'#ff7497',0x6be5ff,undefined,null,{isColor:true,r:.2,g:.3,b:.4}]){before.particle(position,value,.3,velocity,.4,.5);after.particle(position,value,.3,velocity,.4,.5);before.particle(position,value,.3,null,.4,.5);after.particle(position,value,.3,null,.4,.5);}}
  assert.deepEqual([...after.colors],[...before.colors]);assert.deepEqual(after.particles.map(p=>p.v.toArray()),before.particles.map(p=>p.v.toArray()));assert.deepEqual(color.toArray(),original);assert.deepEqual(velocity.toArray(),[4,5,6]);
  for(let i=0;i<1000;i++)after.particle(position,i);assert.ok(after.particleColors.values.size<=32);
 }finally{THREE.ColorManagement.enabled=colorManagement;}
});
