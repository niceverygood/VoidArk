import {qaRendererOptions} from './qa-render-context.js';
import * as THREE from 'three';
import {resetTextureWarmup} from './sortie-warmup.js';
export function createPreviewRendererPool(create,{schedule=setTimeout,cancel=clearTimeout,idleMs=30000}={}){
 let renderer=null,users=0,idleTimer;
 return {acquire(){cancel(idleTimer);if(!renderer)renderer=create();users++;let released=false;return {renderer,release(){if(released)return;released=true;if(--users===0)idleTimer=schedule(()=>{if(users===0&&renderer){renderer.dispose();renderer.forceContextLoss();renderer=null;}},idleMs);}};},retireIdle(){if(users!==0)return false;cancel(idleTimer);if(renderer){renderer.dispose();renderer.forceContextLoss();renderer=null;}return true;},diagnostics(){return {contexts:renderer?1:0,users,idleRetentionMs:idleMs};}};
}
// Shared hull textures stay uploaded across visits; only one preview context.
const pool=createPreviewRendererPool(()=>{const renderer=new THREE.WebGLRenderer(qaRendererOptions({antialias:true}));renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x071521);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.domElement.addEventListener('webglcontextrestored',()=>resetTextureWarmup(renderer));return renderer;});
export const acquirePreviewRenderer=()=>pool.acquire();
export const previewRendererDiagnostics=()=>pool.diagnostics();

export const retireIdlePreviewRenderer=()=>pool.retireIdle();


