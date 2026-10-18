import {AssetInstanceBatch} from '../src/asset-instance-batch.js';
import {HealthBarBatch,healthBarsFor} from '../src/healthbar-batch.js';
import {RenderSceneIndex} from '../src/render-scene-index.js';
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {CameraSubview,subviewPlacement,observeSubviewLayout} from '../src/camera-subview.js';
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
test('subview accounts for framebuffer scale and clips an offscreen panel',()=>{
 assert.deepEqual(subviewPlacement(rect(0,0,1280,720),rect(24,115,320,180),2560,1440,640,360),{viewport:[24,425,320,180],scissor:[24,425,320,180],copy:[48,230,640,360,0,0,640,360]});
 const clipped=subviewPlacement(rect(0,0,1280,720),rect(-20,115,320,180),1280,720,320,180);assert.deepEqual(clipped.scissor,[0,425,300,180]);assert.deepEqual(clipped.copy,[0,115,300,180,20,0,300,180]);assert.equal(subviewPlacement(rect(0,0,1280,720),rect(2000,0,320,180),1280,720,320,180),null);
});

function layoutFixture(){
 let observer,reads=0,sourceRect=rect(0,0,1280,720),viewRect=rect(24,115,320,180);const listeners=new Map();
 const source={getBoundingClientRect:()=>{reads++;return sourceRect;}},canvas={getBoundingClientRect:()=>{reads++;return viewRect;}};
 class Observer{constructor(callback){this.callback=callback;this.observed=new Set();this.disconnected=false;observer=this;}observe(e){this.observed.add(e);}unobserve(e){this.observed.delete(e);}disconnect(){this.disconnected=true;this.observed.clear();}}
 const events={addEventListener:(name,fn,capture)=>listeners.set(name,{fn,capture}),removeEventListener:(name,fn,capture)=>{assert.equal(listeners.get(name).fn,fn);assert.equal(listeners.get(name).capture,capture);listeners.delete(name);}};
 return {source,canvas,Observer,events,listeners,get observer(){return observer;},get reads(){return reads;},move:(s,v)=>{sourceRect=s;viewRect=v;}};
}

test('subview layout waits for post-layout delivery and invalidates changed corner, resize and scroll without capture-time reads',()=>{
 const f=layoutFixture(),layout=observeSubviewLayout(f.source,f.canvas,f);assert.equal(layout.read(),null);assert.equal(f.reads,0);assert.equal(f.observer.observed.size,2);
 f.observer.callback();const first=layout.read();for(let i=0;i<20;i++)assert.equal(layout.read(),first);assert.equal(f.reads,2);
 f.move(rect(0,0,800,600),rect(548,200,240,135));layout.invalidate();assert.equal(layout.read(),null);assert.equal(f.reads,2);f.observer.callback();assert.deepEqual(layout.read().view,rect(548,200,240,135));
 for(const name of ['resize','scroll']){f.listeners.get(name).fn();assert.equal(layout.read(),null);f.observer.callback();assert.equal(layout.read().source.width,800);}assert.equal(f.listeners.get('scroll').capture,true);assert.equal(f.reads,8);layout.dispose();
});

test('subview layout disconnects listeners once and ignores queued callbacks; unsupported observers preserve fresh original geometry',()=>{
 const f=layoutFixture(),layout=observeSubviewLayout(f.source,f.canvas,f);const late=f.observer.callback;layout.dispose();layout.dispose();late();layout.invalidate();assert.equal(layout.read(),null);assert.equal(f.reads,0);assert.equal(f.observer.disconnected,true);assert.equal(f.listeners.size,0);
 const fallback=observeSubviewLayout(f.source,f.canvas,{Observer:null,events:f.events});assert.equal(fallback.read().view.left,24);f.move(rect(0,0,400,300),rect(-20,100,240,135));assert.equal(fallback.read().view.left,-20);assert.equal(f.reads,4);assert.equal(f.listeners.size,0);fallback.dispose();assert.equal(fallback.read(),null);assert.equal(f.reads,4);
});

test('actual shared capture consumes delivered bounds without querying DOM, handles invalidation and restores renderer state',()=>{
 const f=fixture(),l=layoutFixture();let clear=0;f.canvas.getContext=()=>({drawImage:(...args)=>f.copies.push(args),clearRect:()=>clear++});
 const view=new CameraSubview(f.renderer,f.canvas,{Observer:l.Observer,events:l.events}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();assert.equal(view.render(scene,camera),false);assert.equal(f.calls.length,0);
 l.observer.callback();f.renderer.domElement.getBoundingClientRect=()=>assert.fail('capture must not force source layout');f.canvas.getBoundingClientRect=()=>assert.fail('capture must not force view layout');
 assert.equal(view.render(scene,camera),true);assert.equal(f.calls.length,2);assert.deepEqual(f.state.viewport.toArray(),f.viewport.toArray());assert.deepEqual(f.state.scissor.toArray(),f.scissor.toArray());
 view.invalidatePlacement(true);assert.equal(clear,1);assert.equal(view.render(scene,camera),false);assert.equal(f.calls.length,2);view.dispose();l.observer.callback();assert.equal(l.observer.disconnected,true);assert.equal(l.listeners.size,0);
});
function fixture(ratio=1){
 globalThis.devicePixelRatio=1;const copies=[],canvas={getContext:()=>({drawImage:(...args)=>copies.push(args)}),getBoundingClientRect:()=>rect(24,115,320,180)};
 const viewport=new THREE.Vector4(0,0,1280,720),scissor=new THREE.Vector4(3,4,8,9),color=new THREE.Color(0x040a12),state={target:null,viewport:viewport.clone(),scissor:scissor.clone(),scissorTest:false,color:color.clone(),alpha:.5},calls=[];
 const renderer={getPixelRatio:()=>ratio,domElement:{width:1280,height:720,getBoundingClientRect:()=>rect(0,0,1280,720)},capabilities:{maxSamples:4},autoClear:false,toneMappingExposure:1.05,getRenderTarget:()=>state.target,setRenderTarget:v=>state.target=v,getViewport:v=>v.copy(state.viewport),setViewport:(...v)=>state.viewport.copy(v[0]?.isVector4?v[0]:new THREE.Vector4(...v)),getScissor:v=>v.copy(state.scissor),setScissor:(...v)=>state.scissor.copy(v[0]?.isVector4?v[0]:new THREE.Vector4(...v)),getScissorTest:()=>state.scissorTest,setScissorTest:v=>state.scissorTest=v,getClearColor:v=>v.copy(state.color),getClearAlpha:()=>state.alpha,setClearColor:(c,a)=>{state.color.set(c);state.alpha=a;},render:(scene,camera)=>calls.push({scene,camera,target:state.target,viewport:state.viewport.clone()}),dispose:()=>assert.fail('borrowed renderer must not be disposed')};
 return {renderer,canvas,copies,state,calls,viewport,scissor,color};
}
test('shared camera capture restores all render state and releases only its own resources',()=>{
 const f=fixture(),view=new CameraSubview(f.renderer,f.canvas),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();assert.equal(view.render(scene,camera),true);assert.equal(f.calls.length,2);assert.equal(f.calls[0].target,view.target);assert.equal(f.calls[1].target,null);assert.equal(f.copies.length,1);assert.deepEqual(f.state.viewport.toArray(),f.viewport.toArray());assert.deepEqual(f.state.scissor.toArray(),f.scissor.toArray());assert.equal(f.state.target,null);assert.equal(f.state.scissorTest,false);assert.equal(f.state.color.getHex(),f.color.getHex());assert.equal(f.state.alpha,.5);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.toneMappingExposure,1.05);let releases=0;for(const resource of [view.target,view.geometry,view.material])resource.addEventListener('dispose',()=>releases++);view.dispose();assert.equal(releases,3);
});
test('failed capture cannot leave the main battlefield clipped or change exposure',()=>{
 const f=fixture(),view=new CameraSubview(f.renderer,f.canvas);f.renderer.render=()=>{throw Error('simulated capture error');};assert.throws(()=>view.render(new THREE.Scene(),new THREE.PerspectiveCamera()),/simulated/);assert.deepEqual(f.state.viewport.toArray(),f.viewport.toArray());assert.deepEqual(f.state.scissor.toArray(),f.scissor.toArray());assert.equal(f.state.target,null);assert.equal(f.state.scissorTest,false);assert.equal(f.renderer.toneMappingExposure,1.05);view.dispose();
});

test('close-up hides only faction identity sprites and restores their visibility even on failure',()=>{
 const f=fixture(),view=new CameraSubview(f.renderer,f.canvas),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),visible=new THREE.Sprite(),hidden=new THREE.Sprite(),effect=new THREE.Sprite();hidden.visible=false;
 for(const marker of [visible,hidden]){const root=new THREE.Group();root.add(marker);root.userData.factionIdentity={marker};scene.add(root);}scene.add(effect);
 const original=f.renderer.render;f.renderer.render=(s,c)=>{if(s===scene){assert.equal(visible.visible,false);assert.equal(hidden.visible,false);assert.equal(effect.visible,true);}return original(s,c);};
 view.render(scene,camera);assert.equal(visible.visible,true);assert.equal(hidden.visible,false);
 f.renderer.render=()=>{assert.equal(visible.visible,false);throw Error('capture failure');};assert.throws(()=>view.render(scene,camera),/capture failure/);assert.equal(visible.visible,true);assert.equal(hidden.visible,false);view.dispose();
});

test('fixed capture fills every render-target pixel at reduced and high combat pixel ratios',()=>{
 for(const ratio of [.5,.7,1,1.5]){const f=fixture(ratio),view=new CameraSubview(f.renderer,f.canvas);view.render(new THREE.Scene(),new THREE.PerspectiveCamera());const physical=f.calls[0].viewport.clone().multiplyScalar(ratio);assert.deepEqual(physical.toArray(),[0,0,view.target.width,view.target.height]);assert.deepEqual(f.state.viewport.toArray(),f.viewport.toArray());view.dispose();}
});

test('subview restores primary opaque camera slots on success and on render failure',()=>{
 const f=fixture(),scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial();for(const x of [0,20,40]){const o=new THREE.Mesh(geo,mat);o.userData.meshy=true;o.position.set(x,0,-10);scene.add(o);}const batch=new AssetInstanceBatch(scene),primary=new THREE.PerspectiveCamera(50,1,.1,100),secondary=primary.clone();secondary.position.x=40;batch.update(0,primary);const slots=batch.stats.instances;const view=new CameraSubview(f.renderer,f.canvas);view.render(scene,secondary);assert.equal(batch.camera,primary);assert.equal(batch.stats.instances,slots);assert.equal(batch.audit().valid,true);f.renderer.render=()=>{throw Error('simulated');};assert.throws(()=>view.render(scene,secondary),/simulated/);assert.equal(batch.camera,primary);assert.equal(batch.stats.instances,slots);view.dispose();batch.dispose();geo.dispose();mat.dispose();
});

function healthFixture({enabled=true,selected=true}={}){
 const f=fixture(),scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(1,1),background=new THREE.MeshBasicMaterial({color:0x131b22,transparent:true,opacity:.8,depthTest:false}),fillMaterial=new THREE.MeshBasicMaterial({color:0xff514b,depthTest:false}),bars=[],roots=[];
 scene.matrixWorldAutoUpdate=false;
 for(const [i,x] of [0,40].entries()){const root=new THREE.Group(),bar=new THREE.Group(),bg=new THREE.Mesh(geometry,background),fill=new THREE.Mesh(geometry,fillMaterial);root.position.set(x,0,-10);bg.scale.set(4,.18,1);fill.position.z=.01;fill.scale.set(4*(i?.25:.75),.12,1);fill.position.x=i?-1.5:-.5;bar.add(bg,fill);Object.assign(bar.userData,{fill,width:4});bar.renderOrder=10;root.add(bar);root.userData.healthbar=bar;scene.add(root);bars.push(bar);roots.push(root);}
 const index=new RenderSceneIndex(scene),batch=new HealthBarBatch(scene,{enabled}),release=roots.map((root,i)=>batch.register(root,bars[i])),primary=new THREE.PerspectiveCamera(50,1,.1,100),secondary=primary.clone();secondary.position.x=40;primary.updateMatrixWorld();secondary.updateMatrixWorld();scene.updateMatrixWorld(true);if(selected)batch.update(primary,{worldMatricesFresh:true});
 const view=new CameraSubview(f.renderer,f.canvas);
 return {...f,scene,batch,bars,roots,primary,secondary,index,view,cleanup(){view.dispose();index.dispose();release.forEach(fn=>fn());batch.dispose();geometry.dispose();background.dispose();fillMaterial.dispose();}};
}
function healthSlots(f){return {enabled:f.batch.enabled,orderedFillIds:f.batch.diagnostics().orderedFillIds,orderedBackgroundIds:f.batch.diagnostics().orderedBackgroundIds,sources:f.bars.map(bar=>bar.children.map(o=>({visible:o.visible,mask:o.layers.mask,world:o.matrixWorld.elements.slice()}))),objects:[f.batch.fillMesh,f.batch.backgroundMesh].map(o=>({id:o.id,count:o.count,visible:o.visible,matrix:o.instanceMatrix?Array.from(o.instanceMatrix.array.subarray(0,o.count*16)):null,color:o.instanceColor?Array.from(o.instanceColor.array.subarray(0,o.count*3)):null,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).filter(([,a])=>a.isInstancedBufferAttribute).map(([name,a])=>[name,Array.from(a.array.subarray(0,o.count*a.itemSize))]))}))};}
function sameRenderer(f,target=null){assert.equal(f.state.target,target);assert.deepEqual(f.state.viewport.toArray(),f.viewport.toArray());assert.deepEqual(f.state.scissor.toArray(),f.scissor.toArray());assert.equal(f.state.scissorTest,false);assert.equal(f.state.color.getHex(),f.color.getHex());assert.equal(f.state.alpha,.5);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.toneMappingExposure,1.05);}

test('health-only close-up selects its camera and restores primary slots and render index after capture, presentation, copy and update failures',()=>{
 for(const stage of ['success','capture','presentation','copy','update']){const f=healthFixture();try{
  assert.equal(healthBarsFor(f.scene),f.batch);const slots=healthSlots(f);assert.ok(slots.objects.some(o=>o.count>0));const primaryIndex=f.index.prepare(f.primary,f.renderer).children.map(o=>o.id),render=f.renderer.render,update=f.batch.update.bind(f.batch);let captures=0;
  f.renderer.render=(scene,camera)=>{if(camera===f.secondary){captures++;assert.equal(f.batch.camera,f.secondary);assert.notDeepEqual(healthSlots(f),slots);if(stage==='capture')throw Error('capture failure');}else if(camera===f.view.camera&&stage==='presentation')throw Error('presentation failure');return render(scene,camera);};
  if(stage==='copy')f.view.context.drawImage=()=>{throw Error('copy failure');};
  if(stage==='update')f.batch.update=(camera,options)=>{const result=update(camera,options);if(camera===f.secondary)throw Error('update failure');return result;};
  if(stage==='success')assert.equal(f.view.render(f.scene,f.secondary),true);else assert.throws(()=>f.view.render(f.scene,f.secondary),new RegExp(stage+' failure'));
  assert.equal(captures,stage==='update'?0:1);assert.equal(f.batch.camera,f.primary);assert.deepEqual(healthSlots(f),slots);assert.deepEqual(f.index.view.children.map(o=>o.id),primaryIndex);sameRenderer(f);
 }finally{f.cleanup();}}
});

test('unselected and disabled health batches preserve null camera, native source layers and user enable preference after close-up',()=>{
 for(const enabled of [true,false]){const f=healthFixture({enabled,selected:false});try{const slots=healthSlots(f);assert.equal(f.batch.camera,null);assert.equal(f.view.render(f.scene,f.secondary),true);assert.equal(f.batch.camera,null);assert.deepEqual(healthSlots(f),slots);assert.equal(f.batch.enabled,enabled);sameRenderer(f);}finally{f.cleanup();}}
});

test('health-only close-up refreshes moved roots before selecting current native worlds and restoring primary camera',()=>{
 const f=healthFixture();try{
  f.scene.matrixWorldAutoUpdate=true;f.roots[0].position.x=40;f.roots[1].position.x=80;
  const nativeScene=new THREE.Scene(),nativeRoots=f.roots.map(root=>root.clone());nativeRoots.forEach(root=>nativeScene.add(root));nativeScene.updateMatrixWorld(true);
  const fill=f.bars[0].children[1],expectedWorld=nativeRoots[0].children[0].children[1].matrixWorld,expectedView=new THREE.Matrix4().multiplyMatrices(f.secondary.matrixWorldInverse,expectedWorld).elements.map(Math.fround),render=f.renderer.render,update=f.batch.update.bind(f.batch),options=[];
  f.batch.update=(camera,option)=>{options.push(option.worldMatricesFresh);return update(camera,option);};
  f.renderer.render=(scene,camera)=>{if(camera===f.secondary){assert.deepEqual(f.batch.diagnostics().orderedFillIds,[fill.id]);assert.deepEqual(Array.from(f.batch.fillMesh.geometry.attributes.healthModelView.array.subarray(0,16)),expectedView);assert.deepEqual(fill.matrixWorld.elements,expectedWorld.elements);}return render(scene,camera);};
  assert.equal(f.view.render(f.scene,f.secondary),true);assert.deepEqual(options,[false,false]);assert.equal(f.batch.camera,f.primary);assert.equal(f.batch.fillMesh.count,0);assert.equal(f.batch.backgroundMesh.count,0);assert.ok(f.bars.every(bar=>bar.children.every(o=>o.layers.isEnabled(0))));assert.deepEqual(fill.matrixWorld.elements,expectedWorld.elements);sameRenderer(f);
 }finally{f.cleanup();}
});

test('health close-up retains precomputed world reuse when the scene owns an asset batch',()=>{
 const f=healthFixture(),assets=new AssetInstanceBatch(f.scene);try{assets.update(0,f.primary);const update=f.batch.update.bind(f.batch),options=[];f.batch.update=(camera,option)=>{options.push(option.worldMatricesFresh);return update(camera,option);};assert.equal(f.view.render(f.scene,f.secondary),true);assert.deepEqual(options,[true,true]);assert.equal(assets.camera,f.primary);assert.equal(f.batch.camera,f.primary);sameRenderer(f);}finally{assets.dispose();f.cleanup();}
});

test('health primary restoration failure still restores borrowed renderer target, viewport, scissor and exposure',()=>{
 const f=healthFixture(),target=new THREE.WebGLRenderTarget(4,4);try{f.state.target=target;const primaryIndex=f.index.prepare(f.primary,f.renderer).children.map(o=>o.id),update=f.batch.update.bind(f.batch);f.batch.update=(camera,options)=>{const result=update(camera,options);if(camera===f.primary)throw Error('restore failure');return result;};assert.throws(()=>f.view.render(f.scene,f.secondary),/restore failure/);assert.equal(f.batch.camera,f.primary);assert.deepEqual(f.index.view.children.map(o=>o.id),primaryIndex);sameRenderer(f,target);}finally{f.cleanup();target.dispose();}
});

function preparationFixture(){const f=fixture();f.compiles=[];f.renderer.initRenderTarget=target=>f.compiles.push(['target',target]);f.renderer.compileAsync=async(scene,camera)=>f.compiles.push(['compile',scene,camera,f.state.target]);return f;}
test('presentation prepares the actual screen variant once, first-use draws one pixel, and restores all borrowed state',async()=>{const f=preparationFixture(),view=new CameraSubview(f.renderer,f.canvas);assert.equal(await view.prepare(),true);assert.equal(f.compiles[1][3],null);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].viewport.toArray(),[0,0,1,1]);assert.equal(f.state.target,null);assert.deepEqual(f.state.viewport.toArray(),f.viewport.toArray());assert.deepEqual(f.state.scissor.toArray(),f.scissor.toArray());assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.toneMappingExposure,1.05);assert.equal(f.copies.length,0);assert.equal(await view.prepare(),true);assert.equal(f.calls.length,1);view.resetPreparation();assert.equal(await view.prepare(),true);assert.equal(f.calls.length,2);view.dispose();});
test('cancel or dispose during real asynchronous preparation does not draw or delete compiler materials early',async()=>{for(const disposing of [false,true]){const f=preparationFixture(),view=new CameraSubview(f.renderer,f.canvas);let resolve;f.renderer.compileAsync=()=>new Promise(r=>resolve=r);let releases=0;for(const resource of [view.target,view.geometry,view.material])resource.addEventListener('dispose',()=>releases++);const pending=view.prepare();if(disposing)view.dispose();else view.cancelPreparation();assert.equal(releases,0);assert.equal(f.state.target,null);resolve();assert.equal(await pending,false);assert.equal(f.calls.length,0);assert.equal(releases,disposing?3:0);view.dispose();view.dispose();assert.equal(releases,3);}});
test('compile and first-use render failures restore state and allow cancellation/disposal without borrowing renderer ownership',async()=>{for(const stage of ['compile','draw']){const f=preparationFixture(),view=new CameraSubview(f.renderer,f.canvas);if(stage==='compile')f.renderer.compileAsync=async()=>{throw Error('compile failure');};else f.renderer.render=()=>{throw Error('draw failure');};await assert.rejects(view.prepare(),/failure/);assert.equal(view.diagnostics().prepared,false);assert.equal(view.diagnostics().preparing,0);assert.equal(f.state.target,null);assert.deepEqual(f.state.viewport.toArray(),f.viewport.toArray());assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.toneMappingExposure,1.05);assert.equal(f.state.color.getHex(),f.color.getHex());view.dispose();}});

test('presentation preparation succeeds, fails and cancels without changing health primary selection or slots',async()=>{
 for(const stage of ['success','compile','draw','cancel']){const f=healthFixture();try{const slots=healthSlots(f);f.renderer.initRenderTarget=()=>{};f.renderer.compileAsync=async()=>{if(stage==='compile')throw Error('compile failure');};if(stage==='draw')f.renderer.render=()=>{throw Error('draw failure');};let resolve;if(stage==='cancel')f.renderer.compileAsync=()=>new Promise(r=>resolve=r);const pending=f.view.prepare();if(stage==='cancel'){f.view.cancelPreparation();resolve();}if(stage==='compile'||stage==='draw')await assert.rejects(pending,/failure/);else assert.equal(await pending,stage==='success');assert.equal(f.batch.camera,f.primary);assert.deepEqual(healthSlots(f),slots);sameRenderer(f);}finally{f.cleanup();}}
});

