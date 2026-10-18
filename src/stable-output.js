import * as THREE from 'three';

// Finish tone mapping at the scene's resolution before upscaling. The final
// canvas keeps its native size, avoiding a default-framebuffer reset in combat.
export function createStableOutput(renderer,composer,outputPass,scene){
 const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,type:THREE.UnsignedByteType});
 let active=false,pointScale=1,points=[],nativeDirect=true;
 function configure(enabled,width,height,scale=1){
  if(active&&!enabled){target.dispose();points=[];}
  active=enabled;composer.renderToScreen=!enabled;outputPass.enabled=!enabled;pointScale=scale;
  if(enabled){target.setSize(Math.max(1,Math.floor(width)),Math.max(1,Math.floor(height)));const found=new Set();scene.traverse(o=>{if(o.isPoints&&o.material.isPointsMaterial)found.add(o.material);});points=[...found];}
 }
 function render(){
  const previous=renderer.getRenderTarget(),sizes=points.map(m=>m.size),copy=composer.copyPass,copyToScreen=copy.renderToScreen,outputToScreen=outputPass.renderToScreen;
  try{
   // Built-in point sizes use the renderer pixel ratio. Keep their former
   // scene-pixel footprint while the output canvas uses its native ratio.
   for(let i=0;i<points.length;i++)points[i].size=sizes[i]*pointScale;
   composer.render();
   // At matching scene/output resolution there is no upscale. The same output
   // shader can write directly into the native framebuffer, avoiding an RGBA8
   // round trip and a fullscreen copy. Reduced resolution still tone-maps first.
   if(nativeDirect&&pointScale===1){outputPass.renderToScreen=true;outputPass.render(renderer,null,composer.readBuffer);}
   else{outputPass.renderToScreen=false;outputPass.render(renderer,target,composer.readBuffer);copy.renderToScreen=true;copy.render(renderer,null,target);}
  }finally{for(let i=0;i<points.length;i++)points[i].size=sizes[i];copy.renderToScreen=copyToScreen;outputPass.renderToScreen=outputToScreen;renderer.setRenderTarget(previous);}
 }
 return {configure,render,setNativeDirect(value){nativeDirect=!!value;},reset(){target.dispose();},dispose(){target.dispose();points=[];},diagnostics:()=>({active,width:target.width,height:target.height,pointScale,nativeDirect:nativeDirect&&pointScale===1,pointMaterials:points.length,nominalRGBABytes:active?target.width*target.height*4:0}),target};
}
