import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HealthBarBatch,healthBarsFor} from '../src/healthbar-batch.js';
import {RenderSceneIndex,renderGroupsFor} from '../src/render-scene-index.js';

function fixture(count=8,options={}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.set(0,0,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const geometry=new THREE.PlaneGeometry(1,1),background=new THREE.MeshBasicMaterial({color:0x0c1320,transparent:true,opacity:.8,depthTest:false}),red=new THREE.MeshBasicMaterial({color:0xff7189,depthTest:false}),green=new THREE.MeshBasicMaterial({color:0x82ffd3,depthTest:false}),index=options.index===false?null:new RenderSceneIndex(scene),batch=new HealthBarBatch(scene,options),roots=[],bars=[],releases=[];
 for(let i=0;i<count;i++){
  const root=new THREE.Group();root.position.set((i%5-2)*.4,(Math.floor(i/5)%5-2)*.3,-i*.15);root.rotation.set(.03,.04,.05);root.scale.set(1.2,.9,1.1);
  const bar=new THREE.Group();bar.renderOrder=10;bar.position.set(.1,2,.2);bar.quaternion.copy(camera.quaternion);const bg=new THREE.Mesh(geometry,background),fill=new THREE.Mesh(geometry,i%3===0?green:red);bg.scale.set(4,.18,1);fill.position.set(-(4-(i%5+1)*.7)/2,0,.01);fill.scale.set((i%5+1)*.7,.12,1);bar.add(bg,fill);bar.userData.fill=fill;bar.userData.width=4;root.add(bar);releases.push(batch.register(root,bar));scene.add(root);roots.push(root);bars.push(bar);
 }
 return {scene,camera,geometry,background,red,green,index,batch,roots,bars,releases,cleanup(){batch.dispose();index?.dispose();releases.forEach(release=>release());geometry.dispose();background.dispose();red.dispose();green.dispose();}};
}
function nativeZ(source,camera){if(!source.geometry.boundingSphere)source.geometry.computeBoundingSphere();return new THREE.Vector4().copy(source.geometry.boundingSphere.center).applyMatrix4(source.matrixWorld).applyMatrix4(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)).z;}
function prefix(attribute,count){return Array.from(attribute.array.subarray(0,count*attribute.itemSize));}
function ownedAttributes(mesh){return [mesh.geometry.attributes.healthModelView,mesh.geometry.attributes.healthOpacity,mesh.instanceColor];}

test('batch defaults disabled, registers before scene attachment, and exposes only its own warm proxies',()=>{
 const f=fixture();try{
  assert.equal(healthBarsFor(f.scene),f.batch);assert.equal(new HealthBarBatch(f.scene),f.batch);assert.equal(f.batch.enabled,false);assert.equal(f.batch.diagnostics().sharedRegistry,true);assert.equal(f.batch.nodes,undefined);assert.equal(f.batch.camera,null);assert.equal(f.batch.update(f.camera).instances,0);assert.ok(f.bars.every(bar=>bar.children.every(mesh=>mesh.layers.isEnabled(0))));
  const warm=f.batch.prepareObjects();assert.equal(warm.length,2);assert.ok(warm.every(proxy=>proxy.count===1&&proxy.visible));assert.equal(f.batch.fillMesh.count,0);assert.equal(f.batch.backgroundMesh.count,0);assert.equal(f.batch.group.renderOrder,10);assert.ok(warm.every(proxy=>proxy.geometry===f.batch.fillMesh.geometry||proxy.geometry===f.batch.backgroundMesh.geometry));
  assert.equal(f.batch.register(f.roots[0],f.bars[0]),f.releases[0]);f.batch.setEnabled(true);assert.equal(f.batch.update(f.camera).instances,16);assert.equal(f.batch.camera,f.camera);
 }finally{f.cleanup();}
});

test('exact source modelView floats, linear colors, HP width and native opaque/transparent ordering survive two passes',()=>{
 const f=fixture(20,{enabled:true});try{
  f.scene.position.set(3,-4,2);f.scene.rotation.set(.1,-.2,.15);f.scene.scale.set(.9,1.3,1.1);f.scene.updateMatrixWorld();
  const stats=f.batch.update(f.camera,{worldMatricesFresh:true}),fills=f.bars.map(bar=>bar.children[1]).sort((a,b)=>a.material.id-b.material.id||nativeZ(a,f.camera)-nativeZ(b,f.camera)||a.id-b.id),backgrounds=f.bars.map(bar=>bar.children[0]).sort((a,b)=>nativeZ(b,f.camera)-nativeZ(a,f.camera)||a.id-b.id);
  assert.equal(stats.calls,2);assert.equal(stats.fills,20);assert.equal(stats.backgrounds,20);assert.equal(stats.instances,40);assert.equal(stats,f.batch.stats);assert.deepEqual(stats.orderedFillIds,fills.map(mesh=>mesh.id));assert.deepEqual(stats.orderedBackgroundIds,backgrounds.map(mesh=>mesh.id));
  for(const [mesh,sources] of [[f.batch.fillMesh,fills],[f.batch.backgroundMesh,backgrounds]]){
   assert.equal(mesh.material.isMeshBasicMaterial,true);assert.equal(mesh.material.toneMapped,true);assert.equal(mesh.material.fog,true);assert.equal(mesh.material.depthTest,false);assert.equal(mesh.material.depthWrite,true);assert.equal(mesh.material.blending,THREE.NormalBlending);assert.equal(mesh.renderOrder,0);assert.equal(mesh.parent,f.batch.group);
   assert.deepEqual(mesh.geometry.attributes.position.array,f.geometry.attributes.position.array);assert.deepEqual(mesh.geometry.index.array,f.geometry.index.array);
   for(let i=0;i<sources.length;i++){
    const source=sources[i],mv=new THREE.Matrix4().multiplyMatrices(f.camera.matrixWorldInverse,source.matrixWorld);assert.deepEqual(prefix(mesh.geometry.attributes.healthModelView,sources.length).slice(i*16,(i+1)*16),mv.elements.map(Math.fround));assert.deepEqual(prefix(mesh.instanceColor,sources.length).slice(i*3,(i+1)*3),source.material.color.toArray().map(Math.fround));assert.equal(mesh.geometry.attributes.healthOpacity.array[i],Math.fround(source.material.opacity));assert.equal(source.visible,true);assert.equal(source.layers.isEnabled(0),false);
   }
   for(const attribute of ownedAttributes(mesh))assert.deepEqual(attribute.updateRanges,[{start:0,count:sources.length*attribute.itemSize}]);
  }
  assert.equal(f.batch.fillMesh.material.transparent,false);assert.equal(f.batch.backgroundMesh.material.transparent,true);assert.equal(stats.uploadBytes,40*(16+3+1)*4);
  const source=f.bars[3].children[1];source.scale.x=0;source.material.color.set(0x19aabb);f.bars[4].children[1].scale.x=4;f.batch.update(f.camera);assert.equal(f.batch.stats.fills,20);const index=f.batch.stats.orderedFillIds.indexOf(source.id);assert.deepEqual(prefix(f.batch.fillMesh.instanceColor,20).slice(index*3,index*3+3),source.material.color.toArray().map(Math.fround));
 }finally{f.cleanup();}
});

test('shader keeps native Basic output/fog/tone mapping while using the original CPU modelView and flat uniform colors',()=>{
 const f=fixture(1,{enabled:true});try{
  for(const mesh of [f.batch.fillMesh,f.batch.backgroundMesh]){
   const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};mesh.material.onBeforeCompile(shader);
   assert.match(shader.vertexShader,/attribute mat4 healthModelView/);assert.match(shader.vertexShader,/vec4 mvPosition = healthModelView \* vec4\( transformed, 1\.0 \)/);assert.doesNotMatch(shader.vertexShader,/#include <project_vertex>/);assert.match(shader.vertexShader,/#include <fog_vertex>/);assert.match(shader.vertexShader,/vHealthColor=instanceColor/);assert.match(shader.fragmentShader,/flat varying vec3 vHealthColor/);
   assert.match(shader.fragmentShader,/diffuseColor\.rgb \*= vHealthColor/);assert.match(shader.fragmentShader,/diffuseColor\.a \*= vHealthOpacity/);for(const chunk of ['opaque_fragment','tonemapping_fragment','colorspace_fragment','fog_fragment','premultiplied_alpha_fragment'])assert.ok(shader.fragmentShader.includes('#include <'+chunk+'>'));
  }
 }finally{f.cleanup();}
});

test('native local layers, ancestor visibility, material visibility and camera frustum are preserved without HP filtering',()=>{
 const f=fixture(4,{enabled:true});try{
  f.roots[0].layers.disable(0);assert.equal(f.batch.update(f.camera).instances,8); // Ancestor layers do not hide children.
  f.roots[0].visible=false;assert.equal(f.batch.update(f.camera).instances,6);assert.ok(f.bars[0].children.every(mesh=>mesh.layers.isEnabled(0)));f.roots[0].visible=true;
  f.bars[1].visible=false;assert.equal(f.batch.update(f.camera).instances,6);f.bars[1].visible=true;
  const fill=f.bars[2].children[1],material=fill.material;fill.material=material.clone();fill.material.visible=false;assert.equal(f.batch.update(f.camera).fills,3);fill.material.dispose();fill.material=material;
  f.roots[3].position.x=10000;assert.equal(f.batch.update(f.camera).instances,6);f.roots[3].position.x=0;
  f.camera.layers.disable(0);assert.equal(f.batch.update(f.camera).instances,0);assert.ok(f.bars.every(bar=>bar.children.every(mesh=>mesh.layers.isEnabled(0))));f.camera.layers.enable(0);assert.equal(f.batch.update(f.camera).instances,8);
  f.batch.setEnabled(false);fill.layers.disable(0);f.batch.setEnabled(true);assert.equal(f.batch.update(f.camera).fills,3);assert.equal(f.batch.stats.backgrounds,4);assert.equal(fill.layers.isEnabled(0),false);
 }finally{f.cleanup();}
});

test('camera selection and null reset restore native layers and enabled preference, then rebuild precise original slots',()=>{
 const f=fixture(8,{enabled:true});try{
  f.batch.update(f.camera);const originalIds=[...f.batch.stats.orderedFillIds],original=prefix(f.batch.fillMesh.geometry.attributes.healthModelView,8);const secondary=f.camera.clone();secondary.position.set(12,5,12);secondary.lookAt(0,0,0);secondary.updateMatrixWorld();
  f.batch.update(secondary,{worldMatricesFresh:true});assert.equal(f.batch.camera,secondary);assert.notDeepEqual(prefix(f.batch.fillMesh.geometry.attributes.healthModelView,8),original);
  assert.equal(f.batch.update(null,{worldMatricesFresh:true}).instances,0);assert.equal(f.batch.camera,null);assert.equal(f.batch.enabled,true);assert.ok(f.bars.every(bar=>bar.children.every(mesh=>mesh.layers.isEnabled(0))));
  f.batch.update(f.camera,{worldMatricesFresh:true});assert.deepEqual(f.batch.stats.orderedFillIds,originalIds);assert.deepEqual(prefix(f.batch.fillMesh.geometry.attributes.healthModelView,8),original);
  f.batch.setEnabled(false);f.batch.update(null);assert.equal(f.batch.enabled,false);assert.equal(f.batch.camera,null);assert.equal(f.batch.nodes,undefined);
 }finally{f.cleanup();}
});

test('unsupported material, callbacks, geometry, group layers or overflow fall back for every source without partial drawing',()=>{
 const cases=['material','depth','tone','fog','texture','hook','material-hook','geometry','layers','group-layer','overflow'];
 for(const mode of cases){const f=fixture(4,{enabled:true,capacity:mode==='overflow'?3:16});let texture=null;try{
  f.batch.update(f.camera);const source=f.bars[1].children[1];
  if(mode==='material')source.material=new THREE.MeshStandardMaterial();if(mode==='depth'){source.material=source.material.clone();source.material.depthWrite=false;}if(mode==='tone'){source.material=source.material.clone();source.material.toneMapped=false;}if(mode==='fog'){source.material=source.material.clone();source.material.fog=false;}if(mode==='texture'){source.material=source.material.clone();texture=new THREE.Texture();source.material.map=texture;}if(mode==='hook')source.onBeforeRender=()=>{};if(mode==='material-hook'){source.material=source.material.clone();source.material.onBeforeRender=()=>{};}if(mode==='geometry'){source.geometry=new THREE.PlaneGeometry(2,1);}if(mode==='layers')source.layers.enable(2);if(mode==='group-layer')f.bars[1].layers.disable(0);
  assert.equal(f.batch.update(f.camera).instances,0,mode);assert.ok(f.bars.every(bar=>bar.children.every(mesh=>mesh.layers.isEnabled(0))),mode);assert.equal(f.batch.fillMesh.visible,false);assert.equal(f.batch.backgroundMesh.visible,false);if(mode==='layers')assert.equal(source.layers.isEnabled(2),true);
  if(source.material!==f.red&&source.material!==f.green)source.material.dispose();if(source.geometry!==f.geometry)source.geometry.dispose();
 }finally{texture?.dispose();f.cleanup();}}
});

test('unregistered groupOrder10 content, late additions and scene render hooks retain native interleaving',()=>{
 const f=fixture(3,{enabled:true});const foreign=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());foreign.renderOrder=10;foreign.add(mesh);try{
  f.batch.update(f.camera);f.roots[0].add(foreign);assert.equal(f.batch.update(f.camera).fallback,'group-order-conflict');assert.ok(f.bars.every(bar=>bar.children.every(source=>source.layers.isEnabled(0))));
  foreign.visible=false;assert.equal(f.batch.update(f.camera).instances,6);foreign.visible=true;f.roots[0].remove(foreign);assert.equal(f.batch.update(f.camera).instances,6);
  f.scene.onBeforeRender=()=>{};assert.equal(f.batch.update(f.camera).fallback,'scene-state');f.scene.onBeforeRender=THREE.Object3D.prototype.onBeforeRender;assert.equal(f.batch.update(f.camera).instances,6);
 }finally{foreign.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();f.cleanup();}
});

test('remove/readd, idempotent release, shrink/clear and owned-only disposal preserve shared resources',()=>{
 const f=fixture(12,{enabled:true});let sourceDisposals=0,ownedDisposals=0;for(const resource of [f.geometry,f.background,f.red,f.green])resource.addEventListener('dispose',()=>sourceDisposals++);for(const mesh of [f.batch.fillMesh,f.batch.backgroundMesh])for(const resource of [mesh,mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>ownedDisposals++);
 try{
  f.batch.update(f.camera);f.scene.remove(f.roots[0]);assert.ok(f.bars[0].children.every(mesh=>mesh.layers.isEnabled(0)));assert.equal(f.batch.update(f.camera).instances,22);f.scene.add(f.roots[0]);assert.equal(f.batch.update(f.camera).instances,24);
  f.releases[1]();f.releases[1]();assert.ok(f.bars[1].children.every(mesh=>mesh.layers.isEnabled(0)));assert.equal(f.batch.update(f.camera).instances,0); // A still-visible unregistered bar must preserve its interleaving.
  f.scene.remove(f.roots[1]);for(let i=2;i<10;i++)f.roots[i].visible=false;assert.equal(f.batch.update(f.camera).instances,6);for(const mesh of [f.batch.fillMesh,f.batch.backgroundMesh])for(const attribute of ownedAttributes(mesh))assert.deepEqual(attribute.updateRanges,[{start:0,count:3*attribute.itemSize}]);
  for(const root of f.roots)root.visible=false;assert.equal(f.batch.update(f.camera).instances,0);for(const mesh of [f.batch.fillMesh,f.batch.backgroundMesh])for(const attribute of ownedAttributes(mesh))assert.deepEqual(attribute.updateRanges,[]);
  f.batch.dispose();f.batch.dispose();assert.equal(ownedDisposals,6);assert.equal(sourceDisposals,0);assert.equal(healthBarsFor(f.scene),null);assert.equal(f.batch.prepareObjects().length,0);assert.ok(f.bars.every(bar=>bar.children.every(source=>source.layers.isEnabled(0))));assert.equal(f.batch.group.parent,null);
 }finally{f.cleanup();}
});

test('shared group registry detects direct order/visibility/layer changes without caching structural revisions',()=>{
 const f=fixture(3,{enabled:true}),foreign=new THREE.Group(),mesh=new THREE.Mesh(f.geometry,f.red),parentMesh=new THREE.Mesh(f.geometry,f.red);foreign.add(mesh);f.roots[0].add(parentMesh);parentMesh.add(foreign);
 try{
  // A Mesh can also own a later Group. The index, rather than health listeners,
  // discovers it on the already-watched parent's ordinary childadded event.
  const view=renderGroupsFor(f.scene),revision=view.revision;assert.ok([...view].includes(foreign));assert.equal(f.batch.update(f.camera).instances,6);
  foreign.renderOrder=10;assert.equal(view.revision,revision);assert.equal(f.batch.update(f.camera).fallback,'group-order-conflict');foreign.visible=false;assert.equal(f.batch.update(f.camera).instances,6);foreign.visible=true;foreign.layers.set(2);assert.equal(f.batch.update(f.camera).instances,6);
  f.camera.layers.enable(2);assert.equal(f.batch.update(f.camera).fallback,'group-order-conflict');foreign.renderOrder=0;assert.equal(f.batch.update(f.camera).instances,6);assert.equal(view.revision,revision);
 }finally{parentMesh.removeFromParent();f.cleanup();}
});

test('missing, disposed and recreated shared indexes fall back safely without owning their lifetime',()=>{
 const f=fixture(3,{enabled:true,index:false});let first,second;
 try{
  assert.equal(f.batch.update(f.camera).fallback,'group-registry-unavailable');assert.ok(f.bars.every(bar=>bar.children.every(source=>source.layers.isEnabled(0))));
  first=new RenderSceneIndex(f.scene);assert.equal(f.batch.update(f.camera).instances,6);const oldView=renderGroupsFor(f.scene);first.dispose();assert.equal(oldView.closed,true);assert.equal(f.batch.update(f.camera).fallback,'group-registry-unavailable');assert.ok(f.bars.every(bar=>bar.children.every(source=>source.layers.isEnabled(0))));
  second=new RenderSceneIndex(f.scene);assert.notEqual(renderGroupsFor(f.scene),oldView);assert.equal(f.batch.update(f.camera).instances,6);f.batch.update(null);const view=renderGroupsFor(f.scene),size=view.size;assert.equal(f.batch.enabled,true);assert.equal(f.batch.update(f.camera,{worldMatricesFresh:true}).instances,6);assert.equal(view.size,size);
  f.batch.dispose();assert.equal(renderGroupsFor(f.scene),view);assert.equal(view.closed,false);assert.equal(second.closed,false);
 }finally{f.cleanup();first?.dispose();second?.dispose();}
});

test('reentrant shared-index readiness restores native layers and leaves reconciliation to the renderer',()=>{
 const f=fixture(3,{enabled:true,index:false}),trigger=new THREE.Group(),following=new THREE.Group();trigger.add(new THREE.Mesh(f.geometry,f.red));following.add(new THREE.Mesh(f.geometry,f.red));f.scene.addEventListener('childadded',event=>{if(event.child===trigger)f.scene.add(following);});const index=new RenderSceneIndex(f.scene);
 try{
  index.prepare(f.camera);assert.equal(f.batch.update(f.camera).instances,6);f.scene.add(trigger);assert.equal(renderGroupsFor(f.scene).ready,false);assert.equal(f.batch.update(f.camera).fallback,'group-registry-pending');assert.equal(index.reconciles,0);assert.ok(f.bars.every(bar=>bar.children.every(source=>source.layers.isEnabled(0))));
  index.prepare(f.camera);assert.equal(index.reconciles,1);assert.equal(renderGroupsFor(f.scene).ready,true);assert.equal(f.batch.update(f.camera).instances,6);
 }finally{f.cleanup();index.dispose();}
});

test('health selection adds no full-tree traversal or child listeners beside the existing index',()=>{
 const f=fixture(3),counts=new Map([...f.index.nodes.keys()].map(node=>[node,[node._listeners?.childadded?.length||0,node._listeners?.childremoved?.length||0]]));const nativeTraverse=f.scene.traverse;
 try{
  f.scene.traverse=()=>assert.fail('health selection must not traverse the full source Scene');f.batch.setEnabled(true);f.batch.update(f.camera);f.batch.update(f.camera);f.batch.setEnabled(false);f.batch.setEnabled(true);f.batch.update(f.camera);
  for(const [node,count] of counts)assert.deepEqual([node._listeners?.childadded?.length||0,node._listeners?.childremoved?.length||0],count);
  f.scene.traverse=nativeTraverse;const late=new THREE.Group(),child=new THREE.Group();late.add(child);let traversals=0;const traverse=late.traverse;late.traverse=function(callback){traversals++;return traverse.call(this,callback);};f.scene.add(late);assert.equal(traversals,1);f.batch.update(f.camera);assert.equal(traversals,1);f.scene.remove(late);assert.equal(traversals,2);
 }finally{f.scene.traverse=nativeTraverse;f.cleanup();}
});
