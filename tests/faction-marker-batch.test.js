import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFactionMarkerBatch,registerFactionMarker,factionMarkerBatchFor} from '../src/faction-marker-batch.js';
import {acquireFactionMarker} from '../src/faction-marker-texture.js';

function fixture(count=140,options={}){
 const previous=globalThis.document,copies=[];
 globalThis.document={createElement(){return {width:0,height:0,getContext(){return {clearRect(){},drawImage(...args){copies.push(args);}};}};}};
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.set(0,0,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const roots=[],markers=[],releases=[],maps=new Map();
 for(let i=0;i<count;i++){
  const faction=i===0?'boss':i<120?'enemy':'ally';let map=maps.get(faction);if(!map){map=new THREE.CanvasTexture({width:faction==='boss'?256:80,height:80});map.colorSpace=THREE.SRGBColorSpace;maps.set(faction,map);}
  const root=new THREE.Group();root.position.set(i%4*.5,Math.floor(i/4)%4*.5,-i*.02);root.rotation.set(.03,.04,.05);root.scale.set(1.2,1.4,1.6);
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false,depthWrite:false,toneMapped:false}));marker.renderOrder=1000;marker.position.set(.1,.2,.3);marker.scale.set(1.5,.8,1);marker.center.set(.4,.6);marker.material.opacity=.7;marker.material.rotation=.17;root.add(marker);scene.add(root);roots.push(root);markers.push(marker);releases.push(registerFactionMarker(root,marker,faction));
 }
 const batch=createFactionMarkerBatch(scene,options);
 return {scene,camera,roots,markers,batch,copies,maps,cleanup(){batch.dispose();releases.forEach(fn=>fn());for(const marker of markers)marker.material.dispose();for(const map of maps.values())map.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}};
}

test('140 native marker transforms, sprite size/center/rotation/opacity and alpha order survive one batch',()=>{
 const f=fixture();try{
  const stats=f.batch.update(f.camera),geometry=f.batch.mesh.geometry;
  assert.equal(stats.instances,140);assert.equal(stats.drawCalls,1);assert.equal(stats.fallback,0);assert.equal(f.batch.mesh.renderOrder,1000);assert.equal(f.batch.mesh.material.blending,THREE.NormalBlending);assert.equal(f.batch.mesh.material.map.colorSpace,THREE.SRGBColorSpace);assert.ok(f.markers.every(s=>s.visible&&!s.layers.isEnabled(0)));
  const projection=new THREE.Matrix4().multiplyMatrices(f.camera.projectionMatrix,f.camera.matrixWorldInverse),point=new THREE.Vector4(),expected=[...f.markers].sort((a,b)=>{point.setFromMatrixPosition(b.matrixWorld).applyMatrix4(projection);const bz=point.z;point.setFromMatrixPosition(a.matrixWorld).applyMatrix4(projection);return bz-point.z||a.id-b.id;});assert.deepEqual(stats.orderedIds,expected.map(s=>s.id));
  for(let i=0;i<expected.length;i++){
   const s=expected[i],w=s.matrixWorld.elements,mv=new THREE.Matrix4().multiplyMatrices(f.camera.matrixWorldInverse,s.matrixWorld).elements;
   for(const [name,data] of Object.entries({factionViewPosition:mv.slice(12,15),factionBasisX:w.slice(0,3),factionBasisY:w.slice(4,7),factionCenter:s.center.toArray(),factionRotationOpacity:[s.material.rotation,s.material.opacity],factionColor:s.material.color.toArray()})){
    const attribute=geometry.attributes[name];assert.deepEqual(Array.from(attribute.array.subarray(i*attribute.itemSize,(i+1)*attribute.itemSize)),data.map(Math.fround));
   }
  }
  assert.equal(f.copies.length,27); // three exact pixel copies plus their eight padded edges/corners
  assert.equal(f.copies.filter(args=>args.length===3).length,3);f.batch.update(f.camera);assert.equal(f.copies.length,27);
  for(const attribute of Object.values(geometry.attributes).filter(a=>a.isInstancedBufferAttribute))assert.deepEqual(attribute.updateRanges,[{start:0,count:140*attribute.itemSize}]);
  const shader={vertexShader:THREE.ShaderLib.sprite.vertexShader,fragmentShader:THREE.ShaderLib.sprite.fragmentShader};f.batch.mesh.material.onBeforeCompile(shader);assert.match(shader.vertexShader,/length\( factionBasisX \)/);assert.match(shader.vertexShader,/vec4\( factionViewPosition, 1.0 \)/);assert.doesNotMatch(shader.vertexShader,/cos\( rotation \)/);assert.match(shader.fragmentShader,/opacity \* vFactionOpacity/);assert.match(shader.fragmentShader,/#include <colorspace_fragment>/);assert.match(shader.fragmentShader,/#include <fog_fragment>/);
 }finally{f.cleanup();}
});

test('close-up hiding, native-mode restoration and ownership-safe disposal preserve source truth',()=>{
 const f=fixture(8);try{
  let sourceDisposals=0;for(const map of f.maps.values())map.addEventListener('dispose',()=>sourceDisposals++);for(const s of f.markers){s.material.addEventListener('dispose',()=>sourceDisposals++);s.geometry.addEventListener('dispose',()=>sourceDisposals++);}
  f.batch.update(f.camera);for(const s of f.markers)s.visible=false;assert.equal(f.batch.update(f.camera).instances,0);assert.equal(f.batch.mesh.count,0);for(const s of f.markers)s.visible=true;assert.equal(f.batch.update(f.camera).instances,8);
  f.batch.setEnabled(false);assert.ok(f.markers.every(s=>s.layers.isEnabled(0)));assert.equal(f.batch.update(f.camera).instances,0);f.batch.setEnabled(true);assert.equal(f.batch.update(f.camera).instances,8);
  const owned=[f.batch.mesh.geometry,f.batch.mesh.material,f.batch.mesh.material.map];let ownedDisposals=0;owned.forEach(resource=>resource.addEventListener('dispose',()=>ownedDisposals++));f.batch.dispose();f.batch.dispose();assert.equal(ownedDisposals,3);assert.equal(sourceDisposals,0);assert.ok(f.markers.every(s=>s.layers.isEnabled(0)&&s.visible));assert.equal(f.batch.mesh.parent,null);
 }finally{f.cleanup();}
});

test('unsupported blending/layers and overflow keep every source sprite native instead of mixing alpha passes',()=>{
 for(const mode of ['blending','layers','overflow']){const f=fixture(4,mode==='overflow'?{capacity:2}:{});try{
  if(mode==='blending')f.markers[1].material.blending=THREE.AdditiveBlending;if(mode==='layers')f.markers[1].layers.enable(2);
  assert.equal(f.batch.update(f.camera).instances,0);assert.ok(f.markers.every(s=>s.layers.isEnabled(0)));assert.equal(f.batch.mesh.visible,false);if(mode==='layers')assert.ok(f.markers[1].layers.isEnabled(2));
 }finally{f.cleanup();}}
});

test('registry remains optional and reattaches after source removal without deleting marker data',()=>{
 const f=fixture(2,{enabled:false});try{
  assert.ok(f.markers.every(s=>s.layers.isEnabled(0)));assert.equal(createFactionMarkerBatch(f.scene),f.batch);f.batch.setEnabled(true);assert.equal(f.batch.update(f.camera).instances,2);
  f.scene.remove(f.roots[1]);assert.ok(f.markers[1].layers.isEnabled(0));assert.equal(f.batch.update(f.camera).instances,1);f.scene.add(f.roots[1]);assert.equal(f.batch.update(f.camera).instances,2);
  f.roots[0].visible=false;assert.equal(f.batch.update(f.camera).instances,1);f.roots[0].visible=true;f.camera.layers.disable(0);assert.equal(f.batch.update(f.camera).instances,0);
 }finally{f.cleanup();}
});

test('scene lookup and lifetime warm leases retain all three original pooled canvases until their owners release',()=>{
 const previous=globalThis.document,copies=[];const context=new Proxy({drawImage(...args){copies.push(args);}},{get:(target,key)=>target[key]||(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
 globalThis.document={createElement(){return {width:0,height:0,getContext:()=>context};}};
 const scene=new THREE.Scene();assert.equal(factionMarkerBatchFor(scene),null);const batch=createFactionMarkerBatch(scene);const leases=[];
 try{
  assert.equal(factionMarkerBatchFor(scene),batch);assert.equal(batch.prepareAll(),true);assert.equal(batch.stats.warmedFactions,3);assert.equal(copies.filter(args=>args.length===3&&args[0]?.width===256).length,1);
  const version=batch.mesh.material.map.version;assert.equal(batch.prepareAll(),true);assert.equal(batch.mesh.material.map.version,version);
  const colors={enemy:0xff514b,ally:0x42e4de,boss:0xffb33e};let disposed=0;
  for(const [faction,color] of Object.entries(colors)){const lease=acquireFactionMarker(faction,color);leases.push(lease);lease.texture.addEventListener('dispose',()=>disposed++);assert.ok(copies.some(args=>args.length===3&&args[0]===lease.texture.image));}
  batch.dispose();assert.equal(factionMarkerBatchFor(scene),null);assert.equal(disposed,0);leases.forEach(lease=>lease.release());assert.equal(disposed,3);
 }finally{batch.dispose();leases.forEach(lease=>lease.release());if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('failed optional warm canvas retains the ordinary registered-source batching path',()=>{
 const f=fixture(3);try{assert.equal(f.batch.prepareAll(),false);assert.equal(f.batch.update(f.camera).instances,3);}finally{f.cleanup();}
});
