import {factionMarkerBatchFor} from './faction-marker-batch.js';
import {assetInstancesFor} from './asset-batch-events.js';
import {engineFlamesFor} from './engine-flame-batch.js';
import {healthBarsFor} from './healthbar-batch.js';
import {indexedRenderScene} from './render-scene-index.js';
import * as THREE from 'three';

export function subviewPlacement(sourceRect,viewRect,sourceWidth,sourceHeight,destWidth,destHeight){
 if(!sourceRect.width||!sourceRect.height||!viewRect.width||!viewRect.height)return null;
 const left=Math.max(sourceRect.left,viewRect.left),top=Math.max(sourceRect.top,viewRect.top),right=Math.min(sourceRect.right,viewRect.right),bottom=Math.min(sourceRect.bottom,viewRect.bottom);
 if(right<=left||bottom<=top)return null;
 const sx=sourceWidth/sourceRect.width,sy=sourceHeight/sourceRect.height,dx=destWidth/viewRect.width,dy=destHeight/viewRect.height;
 return {viewport:[viewRect.left-sourceRect.left,sourceRect.bottom-viewRect.bottom,viewRect.width,viewRect.height],scissor:[left-sourceRect.left,sourceRect.bottom-bottom,right-left,bottom-top],copy:[(left-sourceRect.left)*sx,(top-sourceRect.top)*sy,(right-left)*sx,(bottom-top)*sy,(left-viewRect.left)*dx,(top-viewRect.top)*dy,(right-left)*dx,(bottom-top)*dy]};
}

// ResizeObserver delivers after layout. Keep these two view-local rectangles
// out of the WebGL capture path, where a geometry read can flush pending HUD
// layout. The owner invalidates after changing its corner or visibility.
export function observeSubviewLayout(source,canvas,{Observer=globalThis.ResizeObserver,events=globalThis.window}={}){
 let closed=false,rects=null,measurements=0;
 const measure=()=>{if(closed)return;rects={source:source.getBoundingClientRect(),view:canvas.getBoundingClientRect()};measurements++;};
 const observer=typeof Observer==='function'?new Observer(measure):null;
 function invalidate(){if(closed||!observer)return;rects=null;for(const element of [source,canvas]){observer.unobserve(element);observer.observe(element);}}
 if(observer){observer.observe(source);observer.observe(canvas);events?.addEventListener('resize',invalidate);events?.addEventListener('scroll',invalidate,true);}
 return {read(){if(closed)return null;if(!observer)measure();return rects;},invalidate,diagnostics(){return {supported:!!observer,ready:!!rects,measurements,closed};},dispose(){if(closed)return;closed=true;rects=null;observer?.disconnect();if(observer){events?.removeEventListener('resize',invalidate);events?.removeEventListener('scroll',invalidate,true);}}};
}

// Render all 3D content with the game's existing WebGL context. The panel's 2D
// canvas only presents the finished viewport and keeps it between 20Hz captures.
// This avoids a second set of GLB buffers, textures and shader programs. No
// readRenderTargetPixels/getImageData CPU readback or secondary WebGLRenderer.
export class CameraSubview {
 constructor(renderer,canvas,layoutOptions){
  this.renderer=renderer;this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:false});
  const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(320*ratio);canvas.height=Math.round(180*ratio);
  this.target=new THREE.WebGLRenderTarget(canvas.width,canvas.height,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
  this.presentation=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);this.camera.position.z=1;
  this.geometry=new THREE.PlaneGeometry(2,2);this.material=new THREE.MeshBasicMaterial({map:this.target.texture,depthTest:false,depthWrite:false});this.presentation.add(new THREE.Mesh(this.geometry,this.material));
  this.viewport=new THREE.Vector4();this.scissor=new THREE.Vector4();this.clearColor=new THREE.Color();this.renders=0;this.timings={scene:0,presentation:0};
  this.prepared=false;this.preparing=0;this.generation=0;this.closed=false;this.released=false;
  this.layout=observeSubviewLayout(renderer.domElement,canvas,layoutOptions);
 }
 async prepare(){
  if(this.closed)return false;if(this.prepared)return true;
  const r=this.renderer,generation=this.generation;this.preparing++;
  try{
   const previous=r.getRenderTarget();let pending;
   // The presentation is a screen/color/tone-mapping program, not the HDR
   // program used to draw the battle into the camera's capture target.
   try{r.setRenderTarget(null);r.initRenderTarget(this.target);pending=r.compileAsync(this.presentation,this.camera);}
   finally{r.setRenderTarget(previous);}
   await pending;if(this.closed||generation!==this.generation)return false;
   const target=r.getRenderTarget(),viewport=r.getViewport(new THREE.Vector4()),scissor=r.getScissor(new THREE.Vector4()),scissorTest=r.getScissorTest(),clearColor=r.getClearColor(new THREE.Color()),clearAlpha=r.getClearAlpha(),autoClear=r.autoClear,exposure=r.toneMappingExposure;
   try{
    r.setRenderTarget(null);r.setScissorTest(false);r.setViewport(0,0,1/r.getPixelRatio(),1/r.getPixelRatio());r.autoClear=false;r.toneMappingExposure=1;
    // Resolve first-use uniform/log checks during the held preparation phase.
    // One pixel is replaced by the subsequent warm battlefield before input.
    r.render(this.presentation,this.camera);this.prepared=true;
   }finally{r.setRenderTarget(target);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(scissorTest);r.autoClear=autoClear;r.toneMappingExposure=exposure;r.setClearColor(clearColor,clearAlpha);}
   return true;
  }finally{this.preparing--;this.release();}
 }
 cancelPreparation(){this.generation++;}
 resetPreparation(){this.cancelPreparation();this.prepared=false;}
 diagnostics(){return {prepared:this.prepared,preparing:this.preparing,closed:this.closed,released:this.released,layout:this.layout.diagnostics()};}
 invalidatePlacement(clear=false){this.layout.invalidate();if(clear)this.context?.clearRect?.(0,0,this.canvas.width,this.canvas.height);}
 render(scene,camera){
  if(this.closed)return false;
  const r=this.renderer,source=r.domElement;
  const rects=this.layout.read(),placement=rects?subviewPlacement(rects.source,rects.view,source.width,source.height,this.canvas.width,this.canvas.height):null;
  if(!placement||!this.context)return false;
  const previousTarget=r.getRenderTarget(),autoClear=r.autoClear,scissorTest=r.getScissorTest(),exposure=r.toneMappingExposure;
  r.getViewport(this.viewport);r.getScissor(this.scissor);r.getClearColor(this.clearColor);const clearAlpha=r.getClearAlpha();
  const markerBatch=factionMarkerBatchFor(scene),flames=engineFlamesFor(scene),primaryCamera=flames?.camera,assets=assetInstancesFor(scene),assetCamera=assets?.camera,healthBars=healthBarsFor(scene),healthCamera=healthBars?.camera;
  // Main-camera screen-sized identity sprites obscure the close-up. Actual
  // craft roots are direct scene children; avoid a full mesh-tree scan here.
  const markers=[];for(const root of scene.children){const marker=root.userData.factionIdentity?.marker;if(marker){markers.push([marker,marker.visible]);marker.visible=false;}}
  try{
   camera.updateMatrixWorld();assets?.selectCamera(camera);flames?.update(camera);markerBatch?.update(camera,{worldMatricesFresh:true});healthBars?.update(camera,{worldMatricesFresh:!!assets});const started=performance.now();r.autoClear=true;r.setClearColor(0x000000,1);r.toneMappingExposure=1;
   // setViewport uses logical units even on a render target. Keep the fixed
   // capture fully filled when combat resolution changes the renderer ratio.
   const ratio=r.getPixelRatio();
   r.setRenderTarget(this.target);r.setScissorTest(false);r.setViewport(0,0,this.target.width/ratio,this.target.height/ratio);r.render(indexedRenderScene(scene,camera,r),camera);
   this.timings.scene=performance.now()-started;const presented=performance.now();
   r.setRenderTarget(null);r.setViewport(...placement.viewport);r.setScissor(...placement.scissor);r.setScissorTest(true);r.render(this.presentation,this.camera);
   this.context.drawImage(source,...placement.copy);this.timings.presentation=performance.now()-presented;this.renders++;return true;
  }finally{
   try{
    for(const [marker,visible] of markers)marker.visible=visible;
    if(assets)assets.selectCamera(assetCamera);if(primaryCamera)flames.update(primaryCamera);
    try{healthBars?.update(healthCamera??null,{worldMatricesFresh:!!assets});}
    finally{const restoredCamera=assetCamera||primaryCamera||healthCamera;if(restoredCamera){markerBatch?.update(restoredCamera,{worldMatricesFresh:true});indexedRenderScene(scene,restoredCamera,r);}}
   }finally{r.setRenderTarget(previousTarget);r.setViewport(this.viewport);r.setScissor(this.scissor);r.setScissorTest(scissorTest);r.autoClear=autoClear;r.toneMappingExposure=exposure;r.setClearColor(this.clearColor,clearAlpha);}
  }
 }
 release(){if(!this.closed||this.preparing||this.released)return;this.released=true;this.target.dispose();this.geometry.dispose();this.material.dispose();}
 dispose(){this.closed=true;this.layout.dispose();this.cancelPreparation();this.release();}
}
