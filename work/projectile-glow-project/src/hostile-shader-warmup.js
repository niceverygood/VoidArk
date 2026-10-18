import * as THREE from 'three';
import {createFactionHullMaterial} from './faction-identity.js';
import {compileForTarget,createWarmDrawScene} from './sortie-warmup.js';

// Retain only the small set already leased by base preparation. These proxies
// never enter the world; the library owns their imported geometry and textures.
export function createHostileShaderVariants(sources,{onDispose=()=>{}}={}){
 const objects=[],owned=new Set(),clones=new Map();
 const flatGeometry=new THREE.BoxGeometry(),flatMaterial=new THREE.MeshStandardMaterial();owned.add(flatMaterial);
 const clone=source=>{if(!clones.has(source)){const m=createFactionHullMaterial(source);clones.set(source,m);if(m!==source)owned.add(m);}return clones.get(source);};
 function add(source){
  if(!source.isMesh||source.isSkinnedMesh||!source.geometry)return;
  const materials=[].concat(source.material||[]);if(!materials.some(m=>m.isMeshStandardMaterial&&m.emissiveIntensity<=1))return;
  const material=Array.isArray(source.material)?materials.map(clone):clone(source.material);
  const mesh=new THREE.Mesh(source.geometry,material);mesh.frustumCulled=false;mesh.receiveShadow=source.receiveShadow;objects.push(mesh);
  if(!source.morphTargetInfluences){const instanced=new THREE.InstancedMesh(source.geometry,material,1);instanced.frustumCulled=false;instanced.receiveShadow=source.receiveShadow;objects.push(instanced);}
 }
 // Planetary craft retain their own palette and use the ordinary PBR program.
 // Keep that untextured native/instanced program alongside the tinted hulls.
 const plain=new THREE.Mesh(flatGeometry,flatMaterial),plainInstanced=new THREE.InstancedMesh(flatGeometry,flatMaterial,1);plain.frustumCulled=plainInstanced.frustumCulled=false;objects.push(plain,plainInstanced);
 add(new THREE.Mesh(flatGeometry,flatMaterial));
 for(const source of sources)source?.traverse(add);
 const root=new THREE.Group();root.traverse=fn=>objects.forEach(fn);root.traverseVisible=root.traverse;
 let closed=false,released=false,preparing=0,ready=false;
 function release(){if(released||!closed||preparing)return;released=true;for(const object of objects)if(object.isInstancedMesh)object.dispose();for(const m of owned)m.dispose();flatGeometry.dispose();onDispose();}
 return {root,objects,diagnostics:()=>({objects:objects.length,materials:owned.size,preparing,ready,closed,released}),async prepare(renderer,camera,scene,target){if(closed)return false;preparing++;try{
  await compileForTarget(renderer,root,camera,scene,target);if(closed)return false;
  // Shader linking is asynchronous; first-use uniforms and diagnostics are
  // lazy. Future hulls may never appear in the warm battlefield. Resolve both
  // native and instanced programs on the actual color path before input opens.
  const view=createWarmDrawScene(scene),previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
  view.root.children=[...view.lights,...objects];
  try{renderer.setRenderTarget(target);renderer.setViewport(0,0,1/renderer.getPixelRatio(),1/renderer.getPixelRatio());renderer.setScissorTest(false);renderer.autoClear=false;renderer.render(view.root,camera);ready=true;}
  finally{view.root.children=[];renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;renderer.setClearColor(clearColor,clearAlpha);}
  return true;
 }finally{preparing--;release();}},dispose(){closed=true;release();}};
}
