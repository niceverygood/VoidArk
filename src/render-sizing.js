// Pixel-ratio setters already resize their output. Keep ordinary resolution
// changes to one canvas update and one composer update using public APIs.
export function createRenderSizing(renderer,composer,camera){
 const size=renderer.getSize({set(x,y){this.x=x;this.y=y;return this;}});
 let width=size.x,height=size.y,ratio=renderer.getPixelRatio(),sceneRatio=ratio;
 return {
  apply(w,h,pixelRatio,{force=false,outputRatio=pixelRatio}={}){
   const dimensions=width!==w||height!==h,ratioChanged=sceneRatio!==pixelRatio,outputChanged=ratio!==outputRatio;
   if(!force&&!dimensions&&!ratioChanged&&!outputChanged)return false;
   if(force||dimensions||outputChanged){renderer.setDrawingBufferSize(w,h,outputRatio);renderer.domElement.style.width=w+'px';renderer.domElement.style.height=h+'px';}
   if(force||ratioChanged)composer.setPixelRatio(pixelRatio);
   if(dimensions)composer.setSize(w,h);
   if(force||dimensions){camera.aspect=w/h;camera.updateProjectionMatrix();}
   width=w;height=h;ratio=outputRatio;sceneRatio=pixelRatio;return true;
  }
 };
}
