// qa=1 only. Paused same-scene native/batched draws, with no time advancement.
// Readback deliberately stalls the GPU and must never run in normal gameplay.
export function compareEffectBatchRendering({effects,renderer,draw,refresh,time,camera,height,canvas}){
 const gl=renderer.getContext(),width=canvas.width,h=canvas.height;
 const pixels=new Uint8Array(width*h*4),native=new Uint8Array(pixels.length);
 function capture(enabled,target){effects.setBatchRendering(enabled);effects.update(0,time,camera,height);refresh();renderer.info.reset();draw();gl.readPixels(0,0,width,h,gl.RGBA,gl.UNSIGNED_BYTE,target);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
 try{
  // First-use compilation/uniform setup is excluded from the pixel comparison.
  capture(false,pixels);const before=capture(false,native);capture(true,pixels);const after=capture(true,pixels);
  let sum=0,max=0,changed=0,over8=0;
  for(let i=0;i<pixels.length;i+=4){let different=false,large=false;for(let c=0;c<3;c++){const d=Math.abs(pixels[i+c]-native[i+c]);sum+=d*d;max=Math.max(max,d);different ||= d>1;large ||= d>8;}if(different)changed++;if(large)over8++;}
  return {width,height,before,after,rmsRGB:Math.sqrt(sum/(width*h*3)),maxChannelDifference:max,changedPixels:changed,pixelsOver8:over8,sourceEffects:effects.items.length,liveAtlas:effects.atlas.slots.filter(s=>s.life>0).length};
 }finally{effects.setBatchRendering(true);effects.update(0,time,camera,height);refresh();}
}

export function compareRenderScenePixels({renderer,draw,refresh,setIndexed,canvas}){
 const gl=renderer.getContext(),width=canvas.width,height=canvas.height,native=new Uint8Array(width*height*4),indexed=new Uint8Array(native.length);
 const capture=(enabled,bytes)=>{setIndexed(enabled);refresh();renderer.info.reset();draw();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
 try{const before=capture(false,native),after=capture(true,indexed);let sum=0,max=0,changed=0;
  for(let i=0;i<indexed.length;i++){const d=Math.abs(indexed[i]-native[i]);sum+=d*d;max=Math.max(max,d);if(d)changed++;}
  return {width,height,before,after,rmsRGBA:Math.sqrt(sum/indexed.length),maxChannelDifference:max,changedChannels:changed};
 }finally{setIndexed(true);refresh();}
}
