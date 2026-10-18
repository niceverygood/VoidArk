import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createBakedNebula,findNebulaDome,nebulaCoefficientShader} from '../src/baked-nebula.js';

const models=fs.readFileSync(new URL('../src/models.js',import.meta.url),'utf8'),environment=models.slice(models.indexOf('export function createEnvironment('));
const authoredVertex=/vertexShader:\s*`([\s\S]*?)`/.exec(environment)[1],authoredFragment=/fragmentShader:\s*`([\s\S]*?)`/.exec(environment)[1];
function fixture(){
 const geometry=new THREE.SphereGeometry(1130,8,6),source=new THREE.ShaderMaterial({uniforms:{sectorTeal:{value:new THREE.Color(.013,.22,.25)},sectorViolet:{value:new THREE.Color(.19,.035,.29)}},vertexShader:authoredVertex,fragmentShader:authoredFragment,side:THREE.BackSide,depthTest:false,depthWrite:false,fog:false,toneMapped:false});
 const dome=new THREE.Mesh(geometry,source),scene=new THREE.Scene();scene.add(dome);
 const listeners=new Map(),state={target:new THREE.WebGLRenderTarget(4,4),face:2,mip:1,viewport:new THREE.Vector4(4,5,1280,720),scissor:new THREE.Vector4(3,7,320,180),scissorTest:true,clearColor:new THREE.Color('#123456'),clearAlpha:.4};
 const initial={...state,viewport:state.viewport.clone(),scissor:state.scissor.clone(),clearColor:state.clearColor.clone()},calls=[];
 const renderer={coordinateSystem:THREE.WebGLCoordinateSystem,capabilities:{maxCubemapSize:4096},extensions:{has:()=>true},domElement:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},xr:{enabled:true},autoClear:false,getRenderTarget:()=>state.target,getActiveCubeFace:()=>state.face,getActiveMipmapLevel:()=>state.mip,setRenderTarget(target,face=0,mip=0){state.target=target;state.face=face;state.mip=mip;},getViewport:v=>v.copy(state.viewport),setViewport:v=>state.viewport.copy(v),getScissor:v=>v.copy(state.scissor),setScissor:v=>state.scissor.copy(v),getScissorTest:()=>state.scissorTest,setScissorTest:v=>state.scissorTest=v,getClearColor:v=>v.copy(state.clearColor),getClearAlpha:()=>state.clearAlpha,setClearColor(c,a){state.clearColor.set(c);state.clearAlpha=a;},initRenderTarget(){},compileAsync:async()=>{calls.push({kind:'compile',target:state.target});},getContext:()=>({FRAMEBUFFER:1,FRAMEBUFFER_COMPLETE:2,checkFramebufferStatus:()=>2,isContextLost:()=>false}),render(s,c){calls.push({kind:'render',scene:s,camera:c,target:state.target,face:state.face});}};
 return {geometry,source,dome,scene,renderer,state,initial,calls,listeners,cleanup(){geometry.dispose();source.dispose();initial.target.dispose();}};
}
function restored(f){assert.equal(f.state.target,f.initial.target);assert.equal(f.state.face,2);assert.equal(f.state.mip,1);assert.deepEqual(f.state.viewport.toArray(),f.initial.viewport.toArray());assert.deepEqual(f.state.scissor.toArray(),f.initial.scissor.toArray());assert.equal(f.state.scissorTest,true);assert.equal(f.state.clearColor.getHex(),f.initial.clearColor.getHex());assert.equal(f.state.clearAlpha,.4);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.xr.enabled,true);}

test('coefficient bake reuses the complete authored field and rejects changed color equations',()=>{
 const shader=nebulaCoefficientShader(authoredFragment),prefix=authoredFragment.slice(0,authoredFragment.indexOf('vec3 teal = sectorTeal;'));
 assert.ok(shader.startsWith(prefix));assert.ok(!shader.includes('#include <colorspace_fragment>'));assert.match(shader,/noise\(d \* 230.0\)/);assert.match(shader,/temperature, filaments \* mass \* 0.2 \* grain/);
 assert.throws(()=>nebulaCoefficientShader(authoredFragment.replace('color *= 0.68','color *= 0.67')),/changed/);
 for(let i=0;i<100;i++){
  const mass=i/100,lanes=(i*17%100)/100,temp=(i*31%100)/100,filament=(i*13%100)/100,grain=.68+(i*19%100)/100*.32;
  for(const palettes of [[[.013,.22,.25],[.19,.035,.29]],[[.36,.086,.035],[.39,.082,.17]],[[.027,.09,.18],[.137,.027,.314]]])for(let c=0;c<3;c++){
   const base=[.0015,.0025,.006][c],a=[.09,.21,.22][c],b=[.24,.12,.32][c],nebula=palettes[0][c]*(1-temp)+palettes[1][c]*temp,fixed=a*(1-temp)+b*temp;
   const before=(base+nebula*mass*(.12+lanes*.75)+fixed*filament*mass*.2)*grain,after=base*grain+nebula*(mass*(.12+lanes*.75)*grain)+fixed*(filament*mass*.2*grain);assert.ok(Math.abs(before-after)<1e-15);
  }
 }
});

test('six-face bake restores renderer state, shares live sector colors and leaves dome geometry/stars untouched',async()=>{
 const f=fixture(),bake=createBakedNebula(f.renderer,f.dome,{resolution:512});try{
  assert.equal(findNebulaDome(f.scene),f.dome);assert.equal(bake.setEnabled(true),false);assert.equal(f.dome.material,f.source);
  assert.equal(await bake.prepare(),true);assert.equal(f.calls[0].target,bake.target);assert.deepEqual(f.calls.filter(c=>c.kind==='render').map(c=>c.face),[0,1,2,3,4,5]);restored(f);
  assert.equal(f.dome.material,bake.material);assert.equal(f.dome.geometry,f.geometry);assert.equal(bake.material.vertexShader,f.source.vertexShader);assert.equal(bake.material.uniforms.sectorTeal,f.source.uniforms.sectorTeal);assert.equal(bake.target.texture.type,THREE.HalfFloatType);assert.equal(bake.target.texture.generateMipmaps,false);assert.equal(bake.diagnostics().nominalRGBA16FBytes,6*512*512*8);
  f.source.uniforms.sectorTeal.value.setRGB(.36,.086,.035);assert.equal(bake.update(),true);assert.equal(await bake.prepare(),true);assert.equal(bake.diagnostics().bakes,1);assert.equal(f.calls.filter(c=>c.kind==='render').length,6);
  bake.setEnabled(false);assert.equal(f.dome.material,f.source);bake.setEnabled(true);assert.equal(f.dome.material,bake.material);
  let originalsDisposed=0;f.source.addEventListener('dispose',()=>originalsDisposed++);f.geometry.addEventListener('dispose',()=>originalsDisposed++);bake.dispose();bake.dispose();assert.equal(originalsDisposed,0);assert.equal(f.dome.material,f.source);assert.equal(f.listeners.size,0);
 }finally{bake.dispose();f.cleanup();}
});

test('render/float failures and context loss preserve native fallback and allow explicit re-preparation',async()=>{
 for(const failure of ['float','render','framebuffer']){const f=fixture(),bake=createBakedNebula(f.renderer,f.dome);try{
  if(failure==='float')f.renderer.extensions.has=()=>false;if(failure==='render')f.renderer.render=()=>{throw Error('draw failed');};if(failure==='framebuffer')f.renderer.getContext=()=>({FRAMEBUFFER:1,FRAMEBUFFER_COMPLETE:2,checkFramebufferStatus:()=>0});
  bake.setEnabled(true);assert.equal(await bake.prepare(),false);assert.equal(f.dome.material,f.source);assert.equal(bake.diagnostics().ready,false);restored(f);
 }finally{bake.dispose();f.cleanup();}}
 const f=fixture(),bake=createBakedNebula(f.renderer,f.dome);try{
  bake.setEnabled(true);await bake.prepare();f.listeners.get('webglcontextlost')();assert.equal(f.dome.material,f.source);assert.equal(bake.update(),false);f.listeners.get('webglcontextrestored')();assert.equal(bake.diagnostics().ready,false);assert.equal(await bake.prepare(),true);assert.equal(f.dome.material,bake.material);assert.equal(bake.diagnostics().bakes,2);
 }finally{bake.dispose();f.cleanup();}
});

test('disposal or reset during asynchronous preparation cannot enable or prematurely release a compiling material',async()=>{
 for(const operation of ['dispose','reset']){const f=fixture();let done;f.renderer.compileAsync=()=>new Promise(resolve=>done=resolve);const bake=createBakedNebula(f.renderer,f.dome);let disposed=0;bake.material.addEventListener('dispose',()=>disposed++);
  try{bake.setEnabled(true);const pending=bake.prepare();restored(f);if(operation==='dispose')bake.dispose();else bake.contextReset();assert.equal(disposed,0);done();assert.equal(await pending,false);assert.equal(f.dome.material,f.source);assert.equal(f.calls.length,0);if(operation==='dispose')assert.equal(disposed,1);}
  finally{bake.dispose();f.cleanup();}
 }
});

test('synchronous renderer setup failures clear the pending task and permit retry and disposal',async()=>{
 for(const operation of ['getViewport','initRenderTarget','compileAsync']){
  const f=fixture(),original=f.renderer[operation],bake=createBakedNebula(f.renderer,f.dome);let released=0;
  bake.material.addEventListener('dispose',()=>released++);
  try{
   f.renderer[operation]=()=>{throw Error('synchronous '+operation+' failure');};
   assert.equal(await bake.prepare(),false);assert.equal(bake.diagnostics().preparing,false);assert.match(bake.diagnostics().failure,/synchronous/);
   f.renderer[operation]=original;
   assert.equal(await bake.prepare(),true);assert.equal(bake.diagnostics().ready,true);assert.equal(bake.diagnostics().failure,null);
   bake.dispose();assert.equal(released,1);
  }finally{bake.dispose();f.cleanup();}
 }
 const f=fixture(),bake=createBakedNebula(f.renderer,f.dome);let released=0;
 bake.material.addEventListener('dispose',()=>released++);
 try{f.renderer.initRenderTarget=()=>{throw Error('setup failed');};await bake.prepare();bake.dispose();assert.equal(released,1);}
 finally{bake.dispose();f.cleanup();}
});

test('context restoration starts a fresh generation without waiting for a stale compiler',async()=>{
 for(const staleFirst of [true,false]){
  const f=fixture(),compilers=[];f.renderer.compileAsync=()=>new Promise((resolve,reject)=>compilers.push({resolve,reject}));
  const bake=createBakedNebula(f.renderer,f.dome);
  try{
   bake.setEnabled(true);const stale=bake.prepare();assert.equal(bake.prepare(),stale);
   f.listeners.get('webglcontextlost')();f.listeners.get('webglcontextrestored')();
   const fresh=bake.prepare();assert.notEqual(fresh,stale);assert.equal(compilers.length,2);assert.equal(bake.prepare(),fresh);
   if(staleFirst){compilers[0].reject(Error('stale compilation failed'));assert.equal(await stale,false);assert.equal(bake.prepare(),fresh);assert.equal(bake.diagnostics().failure,null);}
   compilers[1].resolve();assert.equal(await fresh,true);assert.equal(bake.diagnostics().ready,true);assert.equal(bake.diagnostics().bakes,1);assert.equal(f.dome.material,bake.material);
   if(!staleFirst){compilers[0].reject(Error('stale compilation failed'));assert.equal(await stale,false);}
   assert.equal(bake.diagnostics().ready,true);assert.equal(bake.diagnostics().failure,null);assert.equal(f.dome.material,bake.material);assert.equal(bake.diagnostics().preparing,false);restored(f);
  }finally{bake.dispose();f.cleanup();}
 }
});

test('dispose after loss and restoration retains owned resources until every compiler settles',async()=>{
 const f=fixture(),compilers=[];f.renderer.compileAsync=()=>new Promise(resolve=>compilers.push(resolve));const bake=createBakedNebula(f.renderer,f.dome);let released=0,originalsDisposed=0;
 bake.material.addEventListener('dispose',()=>released++);f.source.addEventListener('dispose',()=>originalsDisposed++);f.geometry.addEventListener('dispose',()=>originalsDisposed++);
 try{
  const stale=bake.prepare();f.listeners.get('webglcontextlost')();f.listeners.get('webglcontextrestored')();const fresh=bake.prepare();
  bake.dispose();assert.equal(released,0);assert.equal(f.dome.material,f.source);
  compilers[0]();assert.equal(await stale,false);assert.equal(released,0);assert.equal(bake.diagnostics().preparing,true);
  compilers[1]();assert.equal(await fresh,false);assert.equal(released,1);assert.equal(originalsDisposed,0);assert.equal(bake.diagnostics().preparing,false);assert.equal(f.calls.length,0);
 }finally{bake.dispose();f.cleanup();}
});
