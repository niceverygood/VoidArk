import * as THREE from 'three';
import {createProjectileGlowMaterial} from './transient-combat-materials.js';
// WORK candidate: only transparent glow shaders. Opaque body materials and all
// Object3D identities/order remain per projectile. No retained idle resources.
export function createProjectileGlowPool({create=createProjectileGlowMaterial}={}){
 const entries=new Map();let created=0,released=0;
 function acquire(color){const key=JSON.stringify([THREE.ColorManagement.enabled,THREE.ColorManagement.workingColorSpace,color]);let entry=entries.get(key);
  if(!entry){const glow=create(color);let core;try{core=glow.clone();core.uniforms.tint.value.set('#fff6d9');core.uniforms.strength.value=.68;}catch(error){glow.dispose();throw error;}entry={glow,core,refs:0};entries.set(key,entry);created+=2;}
  entry.refs++;let ended=false;
  return {glow:entry.glow,core:entry.core,release(){if(ended)return;ended=true;entry.refs--;if(entry.refs)return;entries.delete(key);released+=2;try{entry.glow.dispose();}finally{entry.core.dispose();}}};
 }
 return {acquire,diagnostics(){let refs=0;for(const e of entries.values())refs+=e.refs;return {entries:entries.size,refs,created,released};}};
}
