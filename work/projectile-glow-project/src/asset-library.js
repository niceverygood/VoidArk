import {PLANET_ENEMIES} from './planet-enemies.js';
import {assetYaw} from './asset-orientation.js';
import {invalidateShipDetail} from './ship-detail-lod.js';
import {markHiddenMatrixBranch} from './hidden-world-matrices.js';
import {GENERATED_VESSELS} from './vessel-assets.js';
import {CIVILIZATIONS,civilizationForPlanet,civilizationForOwner} from './civilizations.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareModelLOD} from './model-lod.js';
import {AssetPool} from './asset-pool.js';
import {cacheModelLocalMatrices} from './static-model-matrices.js';
import {notifyAssetBatchAttached,notifyAssetBatchRemoved,notifyAssetBatchChanged} from './asset-batch-events.js';

let manifest=null,cachedModels=0,cachedLocalNodes=0,animatedModels=0;
const loader=new GLTFLoader();
const manifestReady=typeof window==='undefined'?Promise.resolve({assets:{}}):fetch('/assets/meshy/manifest.json').then(r=>r.ok?r.json():{assets:{}}).catch(()=>({assets:{}})).then(m=>manifest=m);
function disposeScene(scene){const resources=new Set();scene.traverse(o=>{if(o.geometry){resources.add(o.geometry);if(o.geometry.userData.combatLOD)resources.add(o.geometry.userData.combatLOD);if(o.geometry.userData.distantLOD)resources.add(o.geometry.userData.distantLOD);}for(const m of [].concat(o.material||[])){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources)r.dispose();}
const pool=new AssetPool(async id=>{
 const m=await manifestReady,entry=m.assets[id];if(!entry)return null;
 const {scene,animations=[]}=await loader.loadAsync(entry.url);const theme=PLANET_ENEMIES[id.match(/^enemy-(.*)-(fighter|capital|fortress)$/)?.[1]];const styled=new Set();if(theme)scene.traverse(o=>{if(!o.isMesh)return;for(const mat of [].concat(o.material)){if(styled.has(mat))continue;styled.add(mat);mat.color?.multiply(new THREE.Color(theme.hull).lerp(new THREE.Color(0xffffff),.7));if(mat.emissiveMap)mat.emissive?.setHex(theme.glow);}});scene.userData.meshyAnimated=animations.length>0;scene.traverse(o=>{if(o.isMesh){o.userData.meshy=true;prepareModelLOD(o.geometry);o.castShadow=false;for(const mat of [].concat(o.material)){mat.userData.meshyBatchSource=mat.uuid;if(mat.emissiveIntensity)mat.emissiveIntensity=Math.min(mat.emissiveIntensity,.8);}}});return scene;
},disposeScene,{idleLimit:8});

// Imported resources belong to the cache. Instances only own their transform.
export function mountAsset(owner,id,{parent=owner,size=1,hide=[],position=[0,0,0],rotation=[0,0,0],longAxis,axisSign=1,onReady,onUnavailable}={}){
 if(typeof window==='undefined')return ()=>{};
 const entry=pool.acquire(id);let disposed=false,instance;
 const release=()=>{if(disposed)return;disposed=true;if(instance){invalidateShipDetail(instance);notifyAssetBatchRemoved(instance);}instance?.removeFromParent();entry.release();};
 const previous=owner.userData.dispose;owner.userData.dispose=()=>{release();previous?.();};
 entry.ready.then(source=>{if(disposed)return;if(!source){onUnavailable?.(id);return;}const model=source.clone(true),box=new THREE.Box3().setFromObject(model),extent=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());model.position.sub(center);const orientation=new THREE.Group();orientation.add(model);orientation.rotation.y=assetYaw(id,extent);if(longAxis==='y'){const axis=extent.x>=extent.y&&extent.x>=extent.z?new THREE.Vector3(1,0,0):extent.z>=extent.y?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);orientation.quaternion.setFromUnitVectors(axis.multiplyScalar(axisSign),new THREE.Vector3(0,1,0));}instance=new THREE.Group();instance.name=`meshy:${id}`;instance.userData.meshy=true;const cached=cacheModelLocalMatrices(orientation,{animated:!!source.userData.meshyAnimated});if(cached){cachedModels++;cachedLocalNodes+=cached;}else animatedModels++;instance.add(orientation);instance.scale.setScalar(size/Math.max(extent.x,extent.y,extent.z,.001));instance.position.set(...position);instance.rotation.set(...rotation);parent.add(instance);notifyAssetBatchAttached(instance);for(const o of hide){o.visible=false;o.userData.assetReplaced=true;markHiddenMatrixBranch(o);notifyAssetBatchChanged(o);}owner.userData.assetId=id;invalidateShipDetail(instance);onReady?.(instance);});return release;
}
export const nationCode=index=>index<26?String.fromCharCode(97+((index%26+26)%26)):index===26?'aa':'ab';
export function planetNation(id='planet-0',owner){id=String(id||'planet-0');const galaxy=['andromeda','verdant','abyss','origin'].find(g=>id.startsWith(g))||'milky';return (civilizationForOwner(owner)||civilizationForPlanet({id,galaxy})).asset;}
const shipNations=['a','g','z','n','b','t','s','y','m','k','l','ab','a','q','o','j','f','c','x','w','aa','r','v','h'];
const shipIds=['ark','swift','raptor','needle','hammer','basilisk','lance','dread','nest','hive','seraph','sovereign','aegis','bastion','paladin','mirror','oracle','singularity','phoenix','chronos','mule','prospector','foundry','wayfarer'];
export function dedicatedHull(ship){const id=`vessel-${ship}`;return GENERATED_VESSELS.has(ship)||manifest?.assets[id]?.status==='ready'?id:null;}
export function hullAsset(ship,stage,preferDedicated=true){const unique=preferDedicated&&dedicatedHull(ship);if(unique)return unique;return `nation-${shipNations[shipIds.indexOf(ship)]||'a'}-${['scout','cruiser','carrier'][Math.min(2,stage)]}`;}
export function moduleAsset(shape){return `module-${({gun:'cannon',barrel:'cannon',barrels:'cannon',rails:'cannon',beam:'laser',lens:'laser',lance:'laser',rack:'missile',pod:'missile',missiles:'missile',bay:'hangar',hangar:'hangar',fighter:'hangar',drone:'drone',droneBay:'drone',armor:'armor',plate:'armor',fin:'engine',fins:'engine',nozzle:'engine',radiator:'engine',thruster:'engine',core:'reactor',refinery:'salvage',ring:'gravity',gyroscope:'gravity',coil:'shield',dish:'sensor',scanner:'sensor',jammer:'sensor',antenna:'sensor',claw:'salvage',shield:'shield'})[shape]||'reactor'}`;}
export function assetDiagnostics(){return {manifest:Object.keys(manifest?.assets||{}).length,...pool.diagnostics(),localMatrixCache:{mounted:cachedModels,nodes:cachedLocalNodes,uncachedAnimated: animatedModels}};}



export function preloadAssets(ids){const entries=ids.map(id=>pool.acquire(id));return ()=>entries.forEach(e=>e.release());}

// Keep cache ownership while preparing resources; consumers never dispose them.
export function acquireWarmupAssets(ids){const entries=[...new Set(ids)].map(id=>pool.acquire(id));return {ready:Promise.all(entries.map(e=>e.ready)),release(){entries.forEach(e=>e.release());}};}



