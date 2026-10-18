// QA-only synchronous comparison. The caller holds simulation/camera time and
// renders the same native-sized default framebuffer for both submissions.
export function compareHealthBarBatchRendering({scene,camera,batch,renderer,render,refresh}){
 const {width,height}=renderer.domElement,gl=renderer.getContext();
 const native=new Uint8Array(width*height*4),instanced=new Uint8Array(native.length);
 const enabled=batch.enabled,previousCamera=batch.camera;
 const update=selected=>batch.update(selected,{worldMatricesFresh:!!refresh});
 const capture=(value,pixels)=>{
  batch.setEnabled(value);refresh?.(camera);update(camera);renderer.info.reset();render(scene,camera);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 };
 try{
  const before=capture(false,native),after=capture(true,instanced);let sum=0,max=0,changedChannels=0,pixelsOver8=0;
  for(let i=0;i<instanced.length;i+=4){
   let large=false;
   for(let channel=0;channel<4;channel++){const difference=Math.abs(instanced[i+channel]-native[i+channel]);sum+=difference*difference;max=Math.max(max,difference);if(difference)changedChannels++;large ||= difference>8;}
   if(large)pixelsOver8++;
  }
  return {width,height,before,after,rmsRGBA:Math.sqrt(sum/instanced.length),maxChannelDifference:max,changedChannels,pixelsOver8};
 }finally{
  batch.setEnabled(enabled);
  // Refresh may prepare other camera-dependent batches. Restore this batch's
  // camera last, including the never-selected null state, even if it fails.
  try{refresh?.(previousCamera);}finally{update(previousCamera);}
 }
}
