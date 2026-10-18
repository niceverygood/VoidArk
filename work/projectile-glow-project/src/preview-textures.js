import {visibleTextures,warmTextureSlice} from './sortie-warmup.js';

// The scene keeps ownership. Asset attachments invalidate this small upload
// queue; unchanged previews only check the already collected texture versions.
export function createPreviewTexturePreparation(renderer,scene,options={}){
 const watched=new Set();let textures=[],dirty=true,closed=false;
 function watch(root){root.traverse(o=>{if(watched.has(o))return;watched.add(o);o.addEventListener('childadded',added);o.addEventListener('childremoved',removed);});}
 function unwatch(root){root.traverse(o=>{o.removeEventListener('childadded',added);o.removeEventListener('childremoved',removed);watched.delete(o);});}
 function added(event){if(closed)return;watch(event.child);dirty=true;}
 function removed(event){unwatch(event.child);dirty=true;}
 watch(scene);
 return {step(){
  if(closed)return {ready:false,closed:true,uploaded:0,textures:0};
  if(dirty){const objects=[];scene.traverseVisible(o=>{if(o.material)objects.push(o);});textures=visibleTextures(objects);dirty=false;}
  // The budget is soft: a single driver upload cannot be split or interrupted.
  const slice=warmTextureSlice(renderer,textures,0,{budgetMs:4,limit:2,...options});
  return {ready:slice.index===textures.length,textures:textures.length,...slice};
 },dispose(){if(closed)return;closed=true;for(const o of watched){o.removeEventListener('childadded',added);o.removeEventListener('childremoved',removed);}watched.clear();textures=[];}};
}
