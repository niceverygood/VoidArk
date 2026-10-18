import {qaRendererOptions} from './qa-render-context.js';
import * as THREE from 'three';
import {mountAsset} from './asset-library.js';
import {ThumbnailCache} from './thumbnail-cache.js';
import {createPreviewRendererPool} from './preview-renderer.js';

export const SKILL_ART=Object.freeze({pulse:'skill-pulse',barrage:'fx-swarm-missile',overcharge:'skill-overcharge',nova:'skill-nova',stasis:'skill-stasis',repair:'skill-repair',lance:'fx-ion-bolt',countermeasure:'skill-countermeasure',sentry:'skill-sentry',evade:'module-engine'});

// Render actual PBR models once, rather than running nine extra WebGL views during combat.
export const UPGRADE_ART=Object.freeze({cannon:"rail-turret",chain:"skill-pulse",missile:"module-missile",laser:"module-laser",fighter:"module-hangar",armor:"module-armor",shield:"module-shield",magnet:"module-salvage",reactor:"module-reactor"});
const thumbnails=new ThumbnailCache();
// This context is separate from opaque, animated ship previews. One serialized
// job owns its size and scene until shader preparation and copying finish.
let artRendererInfo=null;
const artPool=createPreviewRendererPool(()=>{
 const renderer=new THREE.WebGLRenderer(qaRendererOptions({alpha:true,antialias:true}));
 renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;artRendererInfo=renderer.info;return renderer;
});
let renderQueue=Promise.resolve();
export const skillArtDiagnostics=()=>{const pool=artPool.diagnostics();return {...pool,memory:pool.contexts?{...artRendererInfo.memory,programs:artRendererInfo.programs.length}:null,cachedImages:thumbnails.items.size,cachedBytes:thumbnails.bytes};};
export const retireIdleSkillArtRenderer=()=>artPool.retireIdle();
// A sortie owns one lease so an unseen later upgrade does not recreate this
// context in the simulation's level-up callback. Views still own their models.
export function retainSkillArtRenderer(){const lease=artPool.acquire();return ()=>lease.release();}
const artTint=canvas=>({pulse:0x36d9ff,barrage:0xffb05a,overcharge:0xff91c8,nova:0xff7133,stasis:0xb68cff,repair:0x55ed99,lance:0xffd976,countermeasure:0xe5a0ff,sentry:0x91c6ff,evade:0x6dffe8}[canvas.dataset.skillArt]??Number.parseInt(canvas.dataset.artColor?.replace("#","")||"71e6e8",16));
function showThumbnail(canvas,image,resolution,source){canvas.width=resolution;canvas.height=resolution;canvas.getContext('2d').drawImage(image,0,0);canvas.closest('.skill-card,.evade-button,.upgrade-card,.base-asset-card')?.classList.add('has-meshy-art');canvas.dataset.artReady='true';canvas.dataset.artSource=source;}
export function installSkillArt(container,{assets=SKILL_ART,resolution=192}={}){
 const qaParams=new URLSearchParams(typeof location==='undefined'?'':location.search);
 const measured=qaParams.get('qa')==='1',started=performance.now();
 const finished=()=>{if(measured)container.dataset.artBatchTiming=JSON.stringify({started,resolution,readyAt:performance.now(),totalMs:performance.now()-started});return Object.assign(()=>{},{ready:Promise.resolve()});};
 if(measured)container.dataset.artBatchTiming=JSON.stringify({started,resolution});
 if(measured&&qaParams.get('qaNoArt')==='1')return finished();
 const keyFor=canvas=>JSON.stringify([assets[canvas.dataset.skillArt],canvas.dataset.skillArt,artTint(canvas),resolution]);
 const targets=[...container.querySelectorAll('[data-skill-art]')].filter(c=>c.dataset.artReady!=='true').filter(canvas=>{const image=thumbnails.get(keyFor(canvas));if(!image)return true;showThumbnail(canvas,image,resolution,'cache');return false;});
 if(!targets.length)return finished();
 let lease;
 try{lease=artPool.acquire();}
 catch{for(const canvas of targets)canvas.dataset.artStatus='unavailable';return finished();}
 const setupMs=performance.now()-started;
 if(measured)container.dataset.artBatchTiming=JSON.stringify({started,resolution,targets:targets.length,setupMs});
 const renderer=lease.renderer;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,30);camera.position.set(0,.3,4.4);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xd5edff,0x151328,1.25));const key=new THREE.DirectionalLight(0xfff5e2,2.2);key.position.set(-3,4,5);scene.add(key);const rim=new THREE.DirectionalLight(0x55cfff,2);rim.position.set(4,2,-2);scene.add(rim);
 let stopped=false,pending=targets.length,released=false,resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve;}),entries=[],materials=[];
 const releaseRenderer=()=>{if(released)return;released=true;for(const m of materials)m.dispose();lease.release();if(measured)container.dataset.artBatchTiming=JSON.stringify({started,resolution,targets:targets.length,setupMs,readyAt:performance.now(),totalMs:performance.now()-started,stopped});resolveReady();};
 const complete=entry=>{if(entry.finished)return;entry.finished=true;entry.root.userData.dispose?.();if(--pending===0)releaseRenderer();};
 for(const canvas of targets){const id=canvas.dataset.skillArt,root=new THREE.Group(),entry={root,finished:false,preparing:false},timing={requestedAt:performance.now(),id};entries.push(entry);const updateTiming=()=>{if(measured)canvas.dataset.artPreparationTiming=JSON.stringify(timing);};updateTiming();
  mountAsset(root,assets[id],{size:2,rotation:[.18,.45,-.12],...(['barrage','lance','sentry'].includes(id)?{longAxis:'y',rotation:[.15,.15,-.55]}:{}),onReady:()=>{
   timing.assetReadyAt=performance.now();updateTiming();
   renderQueue=renderQueue.catch(()=>{}).then(async()=>{
   if(stopped||entry.finished)return;
   entry.preparing=true;
   timing.queueStartAt=performance.now();updateTiming();
   try{
   if(id==='sentry'){const model=root.children[0];for(const x of [-.55,.55]){const escort=model.clone(true);escort.scale.multiplyScalar(.5);escort.position.set(x,-.35,.1);root.add(escort);}model.scale.multiplyScalar(.6);model.position.y=.3;}
   const tint=artTint(canvas);
   root.traverse(o=>{if(!o.isMesh)return;const colorize=source=>{const m=source.clone();m.onBeforeCompile=shader=>{shader.uniforms.abilityTint={value:new THREE.Color(tint)};shader.fragmentShader='uniform vec3 abilityTint;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat hi=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));float lo=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));if(hi-lo>.18)diffuseColor.rgb=mix(diffuseColor.rgb,abilityTint*max(.35,hi),.85);');};materials.push(m);return m;};o.material=Array.isArray(o.material)?o.material.map(colorize):colorize(o.material);});
   scene.add(root);
   timing.compileStartAt=performance.now();await renderer.compileAsync(scene,camera);timing.compileEndAt=performance.now();updateTiming();
   if(stopped)return;
   // Another install can request a different resolution while this one waits.
   // Only the serialized draw changes the shared backing buffer.
   renderer.setSize(resolution,resolution,false);
   const renderStart=performance.now();timing.drawStartAt=renderStart;renderer.render(scene,camera);timing.drawEndAt=performance.now();showThumbnail(canvas,renderer.domElement,resolution,'render');canvas.dataset.artRenderMs=String(performance.now()-renderStart);const image=document.createElement('canvas');image.width=image.height=resolution;image.getContext('2d').drawImage(canvas,0,0);thumbnails.set(keyFor(canvas),image,resolution*resolution*4);timing.readyAt=performance.now();updateTiming();
   // Reused shaders may finish immediately. Still let the UI and battle clock
   // run between distinct cards instead of draining all draws as microtasks.
   if(!stopped&&pending>1)await new Promise(resolve=>setTimeout(resolve,0));
   }catch{if(!stopped)canvas.dataset.artStatus='unavailable';}
   finally{scene.remove(root);entry.preparing=false;complete(entry);}
   });
  },onUnavailable:()=>{if(!stopped)canvas.dataset.artStatus='unavailable';complete(entry);}});
 }
 return Object.assign(()=>{if(stopped)return;stopped=true;for(const entry of entries)if(!entry.preparing)complete(entry);},{ready});
}

