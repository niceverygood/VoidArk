// WORK QA only: GPU readback is deliberately excluded from performance captures.
import * as THREE from 'three';
import {CameraSubview} from './camera-subview.js';

function difference(a,b){let sum=0,max=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d*d;max=Math.max(max,d);if(d)changed++;}return {rmsRGBA:Math.sqrt(sum/a.length),maxChannelDifference:max,changedChannels:changed};}
function state(r){return {target:r.getRenderTarget()?.uuid||null,viewport:r.getViewport(new THREE.Vector4()).toArray(),scissor:r.getScissor(new THREE.Vector4()).toArray(),scissorTest:r.getScissorTest(),autoClear:r.autoClear,exposure:r.toneMappingExposure,clear:r.getClearColor(new THREE.Color()).toArray(),alpha:r.getClearAlpha()};}
export async function compareProjectileGlowPixels({roots,scene,camera,renderer,draw,refresh,pool}){
 const panel=document.createElement('canvas');panel.style.cssText='position:fixed;left:16px;top:160px;width:320px;height:180px;pointer-events:none;z-index:10000';document.body.append(panel);
 const view=new CameraSubview(renderer,panel,{Observer:null}),records=[],nodes=[];let privateMode=false;
 const apply=enabled=>{privateMode=enabled;for(const {root,shared,privatePair} of records)root.userData.glowMaterials=enabled?privatePair:shared;for(const n of nodes)n.mesh.material=enabled?n.privateMaterial:n.sharedMaterial;};
 try{
  await view.prepare();
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const population={roots:roots.length,ready:roots.filter(r=>r.userData.ready).length,visiblePoints:roots.filter(r=>frustum.containsPoint(r.position)).length,colors:[...new Set(roots.map(r=>r.userData.look.color))],times:[...new Set(roots.flatMap(r=>r.userData.glowMaterials.map(m=>m.uniforms.time.value)))]};
  for(const root of roots){const shared=root.userData.glowMaterials,privatePair=shared.map(m=>m.clone());records.push({root,shared,privatePair});root.traverse(mesh=>{const i=shared.indexOf(mesh.material);if(i>=0)nodes.push({mesh,sharedMaterial:mesh.material,privateMaterial:privatePair[i]});});}
  const width=renderer.domElement.width,height=renderer.domElement.height,gl=renderer.getContext();
  const capture=privateMaterials=>{apply(privateMaterials);refresh();renderer.info.reset();draw();const primary=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,primary);const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles,beforeSubview=state(renderer);const rendered=view.render(scene,camera),afterSubview=state(renderer);if(!rendered)throw Error('Subview did not render');return {primary,pip:view.context.getImageData(0,0,panel.width,panel.height).data.slice(),calls,triangles,rendererRestored:JSON.stringify(beforeSubview)===JSON.stringify(afterSubview)};};
  capture(true);const before=capture(true);capture(false);const after=capture(false);
  return {population,meshBindings:nodes.length,primary:{width,height,...difference(before.primary,after.primary)},pip:{width:panel.width,height:panel.height,...difference(before.pip,after.pip)},before:{calls:before.calls,triangles:before.triangles,rendererRestored:before.rendererRestored},after:{calls:after.calls,triangles:after.triangles,rendererRestored:after.rendererRestored},pool:pool.diagnostics(),scope:'Paused same actual root/GLB scene; per-root cloned shader vs live shared shader. Synchronous readback, not performance or native device proof.'};
 }finally{
  if(privateMode)apply(false);
  for(const record of records)for(const material of record.privatePair)material.dispose();
  view.dispose();panel.remove();refresh();draw();
 }
}
