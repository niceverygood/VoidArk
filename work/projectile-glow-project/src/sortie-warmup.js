import * as THREE from 'three';
// Compile only what the camera can draw; compile(scene) also visits invisible
// source meshes replaced by instance batches. Preserve original object types.
export function visibleCompileRoot(scene,camera){camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)),objects=[];scene.traverseVisible(o=>{if((o.isMesh||o.isPoints||o.isLine||o.isSprite)&&o.layers.test(camera.layers)&&(!o.frustumCulled||frustum.intersectsObject(o)))objects.push(o);});const root=new THREE.Group();root.traverse=fn=>objects.forEach(fn);root.traverseVisible=fn=>objects.forEach(fn);return {root,objects};}
export function visibleTextures(objects){
 const textures=new Set(),visited=new Set();
 const uniform=value=>{
  if(value?.isTexture){if(!value.isRenderTargetTexture)textures.add(value);return;}
  if(!value||typeof value!=='object'||visited.has(value))return;
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return;
  visited.add(value);for(const item of Object.values(value))uniform(item);
 };
 for(const o of objects)for(const material of [].concat(o.material||[])){
  for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);
  for(const entry of Object.values(material.uniforms||{}))uniform(entry.value);
 }
 return [...textures];
}
const uploaded=new WeakMap();
export function resetTextureWarmup(renderer){uploaded.delete(renderer);}
export function warmTextureSlice(renderer,textures,index,{clock=()=>performance.now(),budgetMs=8,limit=8}={}){let versions=uploaded.get(renderer);if(!versions){versions=new WeakMap();uploaded.set(renderer,versions);}const begin=clock();let count=0;while(index<textures.length&&clock()-begin<budgetMs){const texture=textures[index];if(versions.get(texture)===texture.version){index++;continue;}if(count>=limit)break;renderer.initTexture(texture);versions.set(texture,texture.version);index++;count++;}return {index,uploaded:count,ms:clock()-begin};}
// Program variants depend on render target color space and tone mapping. Match
// the composer's RenderPass target instead of preparing an unused screen variant.
export function compileForTarget(renderer,root,camera,scene,target){const previous=renderer.getRenderTarget();try{renderer.setRenderTarget(target);return renderer.compileAsync(root,camera,scene);}finally{renderer.setRenderTarget(previous);}}
export function createWarmDrawScene(scene){const root=new THREE.Scene();root.matrixWorldAutoUpdate=false;root.environment=scene.environment;root.environmentIntensity=scene.environmentIntensity;root.fog=scene.fog;const lights=[];scene.traverseVisible(o=>{if(o.isLight)lights.push(o);});return {root,lights};}
// A render-only flat view uses the original world matrices and objects without
// reparenting or disposing them. Tiny draws upload vertex/index buffers cheaply.
export function warmDrawSlice(renderer,view,camera,objects,index,target,limit=16){const previous=renderer.getRenderTarget(),clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();view.root.children=[...view.lights,...objects.slice(index,index+limit)];try{renderer.setRenderTarget(target);renderer.render(view.root,camera);}finally{view.root.children=[];renderer.setRenderTarget(previous);renderer.setClearColor(clearColor,clearAlpha);}return Math.min(objects.length,index+limit);}

// Shared Meshy instances reuse vertex buffers. Warm each geometry only once;
// instanced/skinned objects retain their own per-object buffer preparation.
export function uniqueBufferObjects(objects){const seen=new Set();return objects.filter(o=>{const key=o.isInstancedMesh||o.isSkinnedMesh||!o.geometry?o:o.geometry;if(seen.has(key))return false;seen.add(key);return true;});}

