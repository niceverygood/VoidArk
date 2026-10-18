import * as THREE from 'three';
import {compileForTarget} from './sortie-warmup.js';

// compileAsync polls renderer properties belonging to each material. World
// entities may be disposed during cancellation, so give the compiler its own
// materials. These read-only proxies are never drawn and borrow object flags,
// geometry and textures without allocating or disposing instance buffers.
export function createCompilationLease(sources){
 const materials=new Map(),objects=[];
 function clone(source){
  if(!materials.has(source)){
   // Render-target textures are GPU products, not uploadable cloned images.
   // UniformsUtils deliberately nulls them (and warns) on ShaderMaterial.clone.
   // Compile with the borrowed target without touching live source uniforms.
   let input=source;const targets=[];
   if(source.isShaderMaterial)for(const [name,uniform] of Object.entries(source.uniforms)){
    const value=uniform.value;
    if(value?.isRenderTargetTexture||Array.isArray(value)&&value.some(t=>t?.isRenderTargetTexture)){
     if(input===source){input=Object.create(source);input.uniforms={...source.uniforms};}
     input.uniforms[name]={...uniform,value:Array.isArray(value)?value.map(t=>t?.isRenderTargetTexture?null:t):null};targets.push([name,value]);
    }
   }
   const material=source.clone.call(input);
   for(const [name,value] of targets)material.uniforms[name].value=Array.isArray(value)?value.map((t,i)=>t?.isRenderTargetTexture?t:material.uniforms[name].value[i]):value;
   material.onBeforeCompile=source.onBeforeCompile;
   material.customProgramCacheKey=source.customProgramCacheKey.bind(source);
   materials.set(source,material);
  }
  return materials.get(source);
 }
 for(const source of sources){
  const proxy=Object.create(source);
  proxy.material=Array.isArray(source.material)?source.material.map(clone):clone(source.material);
  objects.push(proxy);
 }
 const root=new THREE.Group();root.traverse=fn=>objects.forEach(fn);root.traverseVisible=root.traverse;
 let preparing=0,closed=false,released=false;
 function release(){
  if(released||!closed||preparing)return;
  released=true;for(const material of materials.values())material.dispose();
  materials.clear();objects.length=0;
 }
 return {root,diagnostics:()=>({materials:materials.size,objects:objects.length,preparing,closed,released}),
  async prepare(renderer,camera,scene,target){
   if(closed)return false;preparing++;
   try{await compileForTarget(renderer,root,camera,scene,target);return !closed;}
   finally{preparing--;release();}
  },dispose(){closed=true;release();}};
}
