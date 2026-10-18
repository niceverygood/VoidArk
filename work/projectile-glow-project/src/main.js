import {compareProjectileGlowPixels} from './projectile-glow-oracle.js';
import {HealthBarBatch} from './healthbar-batch.js';
import {compareHealthBarBatchRendering} from './healthbar-batch-oracle.js';
import {findNebulaDome,createBakedNebula} from './baked-nebula.js';
import {compareGPUVariants} from './gpu-variant-oracle.js';
import {createFactionMarkerBatch} from './faction-marker-batch.js';
import {GrowthPreparation} from './growth-preparation.js';
import {orbitHeading} from './dogfight.js';
import {receivedImpact} from './received-impact.js';
import {createTransientShaderWarmup} from './transient-shader-warmup.js';
import {createPlanetEnemy} from './models.js';
import {createPresentationStamp} from './presentation-stamp.js';
import {renderSubmissionReport} from './render-submission-report.js';
import {createFrameScheduler} from './frame-scheduler.js';
import {EngineFlameBatch} from './engine-flame-batch.js';
import {staticGeometryDiagnostics} from './static-geometry-cache.js';
import {setShipDetailSubview} from './ship-detail-lod.js';
import {applyBossInvestment} from './boss-investments.js';
import {preparationState} from './base-preparation.js';
import {qaRendererOptions} from './qa-render-context.js';
import {compareFactionMarkerTextures} from './faction-marker-oracle.js';
import {CarrierPriorityGuide} from './carrier-priority.js';
import {compareEffectCosts} from './effect-cost-oracle.js';
import {compareEffectBatchRendering,compareRenderScenePixels} from './effect-batch-oracle.js';
import {coalesceHitPresentation} from './hit-presentation.js';
import {expeditionTarget,prepareExpedition} from './campaign-debrief.js';
import {compareHiddenMatrices} from './hidden-world-matrices.js';
import { lateralEvasion } from './evasion-input.js';
import {visibleCompileRoot,visibleTextures,warmTextureSlice,resetTextureWarmup,compileForTarget,createWarmDrawScene,warmDrawSlice,uniqueBufferObjects} from './sortie-warmup.js';
import {createHostileShaderVariants} from './hostile-shader-warmup.js';
import {createCompilationLease} from './compilation-lease.js';
import {SortieGate,restorePreparedBase} from './sortie-gate.js';
import {previewRendererDiagnostics,retireIdlePreviewRenderer} from './preview-renderer.js';
import {AssetInstanceBatch} from './asset-instance-batch.js';
import {RenderSceneIndex} from './render-scene-index.js';
import {probeWorldMatrices,compareMatrixCache} from './static-model-matrices.js';
import {createLandingGuide,playPlanetEnding,preparePlanetEnding} from './planet-ending.js';
import {FrameProfiler} from './frame-profiler.js';
import {solarSnapshot,SOLAR_STAGES} from './solar-campaign.js';
import {CombatResolution} from './combat-resolution.js';
import {installFactionIdentity} from './faction-identity.js';
import {resumeCombat} from './resume-combat.js';
import {createMissileLaunchCamera} from './missile-launch-camera.js';
import {createRenderSizing} from './render-sizing.js';
import {createStableOutput} from './stable-output.js';
import {closeCampaignSession} from './space-bases.js';
import {ProjectileVisuals} from './projectile-visuals.js';
import {createSolarBattlefield} from './solar-visuals.js';
import {EnergyShieldMaterial} from './energy-shield.js';
import {createSpaceReflections} from './space-reflections.js';
import {setupAssetHangar,visualNation} from './asset-hangar.js';
import {createAssetEnvironment} from './asset-environment.js';
import {mountAsset,assetDiagnostics,planetNation,acquireWarmupAssets,hullAsset} from './asset-library.js';
import {createDefenseModel,animateDefense} from './defense-visuals.js';
import {createCosmicModel,animateCosmic} from './cosmic-visuals.js';
import {OrbitView,bindOrbitView} from './orbit-view.js';
import {createFleetShip,createEnemyFleetShip} from './models.js';
import {FLEET_ROLES} from './fleet.js';
import {CombatFeedback} from './combat-feedback.js';
import {OnlineClient} from './online-client.js';
import {TerritoryWar} from './territory-war.js';
import {SHIPS} from './ships.js';
import { createGalaxyWorld, createGalaxySky, createPlanetFortress } from './galaxy-visuals.js';
import { createShipSupport, createBase } from './base.js';
import { treePurchase } from './skill-tree.js';
import { ThrusterTrails } from './thruster-trails.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BASE_POSITION, Simulation, cleanMeta, buyResearch, SKILL_DEFS, copy, clamp } from './sim.js';
import { createPlayer, createEnemy, createBoss, animateShip, createEnvironment, createDock } from './models.js';
import { createUI } from './ui.js';
import { AudioSystem } from './audio.js';
import { Effects } from './effects.js';
import './style.css';

const SAVE_KEY='void-ark-save-v1';
let departure=null,lastDeparture=null,qaDepartureHoldMs=0,endingPreparation=null,lastEndingTransition=null;
let storageAvailable=true,qaNoSave=false,onlineMode=false,onlineSendTimer=0;
function loadSave(){try{return cleanMeta(JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));}catch{storageAvailable=false;return cleanMeta({});}}
const sim=new Simulation(loadSave());
function save(){if(onlineMode||qaNoSave)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(sim.meta));}catch{if(storageAvailable)ui.toast('이 브라우저는 저장이 제한되어 있습니다. 현재 출격은 계속할 수 있습니다.','warning');storageAvailable=false;}}
const canvas=document.querySelector('#game-canvas');
let renderer;
try{renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}));}catch(err){document.querySelector('#ui').innerHTML='<div style="color:white;padding:48px;font:20px sans-serif">3D 그래픽을 시작하지 못했습니다. Chrome 또는 Edge에서 하드웨어 가속을 켠 뒤 다시 열어주세요.</div>';throw err;}
renderer.setClearColor(0x040a12);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.info.autoReset=false;const presentationStamp=createPresentationStamp(renderer);
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x030610,.00075);
let reflections=createSpaceReflections(renderer);scene.environment=reflections.texture;scene.environmentIntensity=.55;
const assetInstanceBatch=new AssetInstanceBatch(scene);const engineFlameBatch=new EngineFlameBatch(scene);const renderIndex=new RenderSceneIndex(scene);const factionMarkerBatch=createFactionMarkerBatch(scene);const healthBarBatch=new HealthBarBatch(scene,{enabled:true});scene.matrixWorldAutoUpdate=false;
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.3,2400);
const missileLaunchCamera=createMissileLaunchCamera(scene,renderer);
scene.add(new THREE.HemisphereLight(0x9dcfff,0x16223a,.85));
const keyLight=new THREE.DirectionalLight(0xe5eeff,3);keyLight.position.set(-35,80,25);scene.add(keyLight);
const rimLight=new THREE.DirectionalLight(0x45caff,1.5);rimLight.position.set(20,-8,-50);scene.add(rimLight);
const warmLight=new THREE.DirectionalLight(0xff9c4c,1.0);warmLight.position.set(-60,5,-10);scene.add(warmLight);
const engineLight=new THREE.PointLight(0x26cfff,26,18,2);scene.add(engineLight);
const profiler=new FrameProfiler(renderer.getContext());let qaProfileMode='normal',qaFixedResolution=false,qaCameraFreeze=null,qaNativeRender=false;
const combatResolution=new CombatResolution();
const composer=new EffectComposer(renderer);const battlefieldPass=new RenderPass(scene,camera);composer.addPass(battlefieldPass);let lastRenderScene=scene;
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.65,.45,1.0);composer.addPass(bloom);const outputPass=new OutputPass();composer.addPass(outputPass);
const environment=createEnvironment(scene);const nebulaDome=findNebulaDome(scene);let nebulaBake=createBakedNebula(renderer,nebulaDome,{resolution:1024});nebulaBake.setEnabled(true);prepareNebula();const solarBattlefield=createSolarBattlefield(scene);
const assetEnvironment=createAssetEnvironment(scene);
const galaxyWorld=createGalaxyWorld(scene);const galaxySky=createGalaxySky(scene);
const thrusterTrails=new ThrusterTrails(scene);
const dock=createDock(scene);
const fieldBase=createBase(scene,BASE_POSITION);
const projectileVisuals=new ProjectileVisuals(scene,{shareGlowMaterials:true});const effects=new Effects(scene);let combatFeedback;const impactLight=new THREE.PointLight(0x9fefff,0,30,2);scene.add(impactLight);let impactLightLife=0;
const audio=new AudioSystem();
const renderSizing=createRenderSizing(renderer,composer,camera),stableOutput=createStableOutput(renderer,composer,outputPass,scene);
let quality='high',sound=true,playerModel=createPlayer(0),displayStage=0,displayLoadout='';
scene.add(playerModel);
const mineralModels=new Map();const defenseModels=new Map();
const fleetModels=new Map(),peers=new Map(),enemies=new Map(),shots=new Map(),pickups=new Map(),allies=new Map(),hazards=new Map();
const keys=new Set(),tapUntil=new Map();const orbitView=new OrbitView();let shake=0,gameTime=0,trailTimer=0,menuAngle=0,qaInput=null;
const targetPosition=new THREE.Vector3(),cameraDesired=new THREE.Vector3(),temp=new THREE.Vector3(),temp2=new THREE.Vector3();
const pickupGeometry=new THREE.OctahedronGeometry(.48,0),pickupMaterial=new THREE.MeshBasicMaterial({color:0x56eaff,toneMapped:false});
const healthBackground=new THREE.MeshBasicMaterial({color:0x0c1320,transparent:true,opacity:.8,depthTest:false});
const healthMaterial=new THREE.MeshBasicMaterial({color:0xff7189,depthTest:false});
const healthGeometry=new THREE.PlaneGeometry(1,1);
const invisibleShieldMat=new EnergyShieldMaterial({color:0x61e9ff,opacity:0});
const shield=new THREE.Mesh(new THREE.IcosahedronGeometry(3.5,2),invisibleShieldMat);scene.add(shield);

const online=new OnlineClient(message=>{
  const previous=sim.phase,events=sim.events;Object.assign(sim,message.state);sim.events=[...events,...message.events];sim.war=new TerritoryWar(message.world);sim.sharedWar=true;sim.actor=online.id;
  if(previous!==sim.phase||online.refresh){online.refresh=false;if(sim.phase==='carrier')ui.showCarrier(sim);else if(sim.phase==='galaxyMap')ui.showGalaxy(sim);else if(sim.phase==='base')ui.showBase(sim);else if(sim.phase==='market')ui.showMarket(sim);else if(sim.phase==='upgrade')ui.showUpgrades(sim.choices,sim);else if(sim.phase==='playing')ui.hideModal();}
},message=>{ui.toast(message,online.connected?'info':'warning');if(onlineMode&&!online.connected){keys.clear();sim.phase='paused';ui.showPause();}});
for(const name of ['start','setPaused','openGalaxy','closeGalaxy','warpPlanet','warpGalaxy','castSkill','evade','chooseUpgrade','dockBase','leaveBase','serviceBase','constructBase','buildDefense','designateHeadquarters','requestDefense','launchRaid','commandFleet','openCarrier','closeCarrier','upgradeFleet','openMarket','closeMarket','tradeItem','useItem','mine','bankMinerals']){
  const local=sim[name].bind(sim);sim[name]=(...args)=>{if(!onlineMode)return local(...args);if(!online.connected)return false;online.command(name,...args);if(name==='openCarrier')sim.phase='carrier';if(name==='closeCarrier')sim.phase='playing';if(name==='openGalaxy')sim.phase='galaxyMap';if(name==='closeGalaxy')sim.phase='playing';if(name==='setPaused')sim.phase=args[0]?'paused':'playing';return true;};
}
const ui=createUI({
  connectOnline:async()=>{try{await online.connect(sim.meta.ship,visualNation());onlineMode=true;clearObjects();keys.clear();ui.hideModal();audio.unlock();}catch(e){ui.toast(e.message,'warning');}},
  openMarket:()=>{if(sim.openMarket()){keys.clear();ui.showMarket(sim);}},
  closeMarket:()=>{if(sim.closeMarket()){keys.clear();if(sim.phase==='menu')ui.showMenu(sim.meta);else if(sim.phase==='base')ui.showBase(sim);else if(sim.phase==='paused')ui.showPause();else ui.hideModal();}},
  tradeItem:(id,op)=>{if(sim.tradeItem(id,op)){save();audio.play('upgrade');}else ui.toast('광물 또는 보유 아이템을 확인하세요','warning');ui.showMarket(sim);},
  bankMinerals:()=>{sim.bankMinerals();save();ui.showBase(sim);},
  commandFleet:command=>sim.commandFleet(command),
  bossInvestment:(key,token)=>{if(applyBossInvestment(sim,preparationState(sim),key,token)){save();audio.play('upgrade');}ui.showBase(sim);},
  openCarrier:()=>{if(sim.openCarrier()){keys.clear();ui.showCarrier(sim);}},
  closeCarrier:()=>{if(sim.closeCarrier()){keys.clear();if(sim.phase==='base')ui.showBase(sim);else ui.hideModal();}},
  upgradeFleet:(slot,id)=>{if(sim.upgradeFleet(String(slot),id)){save();audio.play('upgrade');}ui.showCarrier(sim,Number(slot));},
  designateHeadquarters:id=>{if(sim.designateHeadquarters(id))save();ui.showGalaxy(sim);},
  requestDefense:id=>{if(sim.requestDefense(id)){keys.clear();ui.hideModal();}else ui.toast('긴급 귀환 불가 · 진행 중인 내 영토 침공 / 추진 25 / 침공당 1회 필요','warning');},
  launchRaid:id=>{sim.launchRaid(id);ui.showGalaxy(sim);},
  openGalaxy:()=>{if(sim.openGalaxy()){keys.clear();ui.showGalaxy(sim);}},
  closeGalaxy:()=>{if(sim.closeGalaxy()){keys.clear();ui.hideModal();}},
  warpGalaxy:id=>{if(sim.warpGalaxy(id)){keys.clear();ui.hideModal();thrusterTrails.clear();targetPosition.set(sim.player.position.x,sim.player.position.y,sim.player.position.z);}else ui.toast('관문 이동 불가 · 연결된 은하를 선택하고 충전과 교전 상태를 확인하세요','warning');},
  warpPlanet:id=>{if(sim.warpPlanet(id)){keys.clear();ui.hideModal();thrusterTrails.clear();targetPosition.set(sim.player.position.x,sim.player.position.y,sim.player.position.z);}else ui.toast('도약 불가 · 재충전 또는 우두머리와 120m 이상 거리 확보','warning');},
  start:()=>{delete sim.preparedCampaignTarget;abandonTo('menu');sim.openCampaignBase(sim.meta.spaceBase?.active==='sun'&&sim.meta.campaign?.systemOwned?'sun':'earth');save();ui.showBase(sim);},prepareExpedition:(equipment)=>{const target=expeditionTarget(sim.meta,sim.result);abandonTo('menu');if(prepareExpedition(sim,target)){sim.preferredDebriefEquipment=['missile','laser','chain'].includes(equipment)?equipment:null;sim.preferredInvestment=['weapon','survival','escort'].includes(equipment)?equipment:null;save();ui.showBase(sim);}},startStage:(index,chapter)=>prepareDeparture(index,chapter),cancelDeparture:()=>cancelDeparture(),restart:()=>{delete sim.preparedCampaignTarget;abandonTo('menu');sim.openCampaignBase(sim.meta.spaceBase?.active==='sun'&&sim.meta.campaign?.systemOwned?'sun':'earth');save();ui.showBase(sim);},cameraReset:()=>{if(sim.phase==='playing'){stopOrbitDrag();orbitView.reset(sim.player.heading);}},
  evade:()=>sim.evade(),
  enterBase:()=>{if(sim.dockBase()){keys.clear();ui.showBase(sim);audio.play('upgrade');}else ui.toast('기지 중심 18m 안에서 F를 눌러 입항하세요','warning');},
  buildDefense:(target,id)=>{if(sim.buildDefense(target,id)){save();audio.play('upgrade');}if(sim.phase==='base')ui.showBase(sim);else ui.showGalaxy(sim);},
  campaignBase:location=>{if(sim.openCampaignBase(location)){save();ui.showBase(sim);}},
  solarPurchase:transaction=>{const success=transaction.commit();if(success){save();audio.play('upgrade');ui.showBase(sim);}return success;},
  selectCapital:id=>{if(sim.selectCapital(id)){save();}ui.showBase(sim);},
  refitFleetShip:transaction=>{const success=transaction.commit();if(success){save();audio.play('upgrade');}ui.showCarrier(sim,transaction.quote.slot);return success;},
  constructBase:id=>{if(sim.constructBase(id)){save();audio.play('upgrade');ui.toast('기지 증축 완료 · 함선 지원 능력 상승','success');}ui.showBase(sim);},
  baseEquipment:id=>{if(sim.installEquipment(id)){save();audio.play('upgrade');ui.toast('장비 설치·강화 완료 · 현재 함선에 적용','success');}ui.showBase(sim);},
  baseService:id=>{if(sim.serviceBase(id)){save();audio.play('upgrade');ui.toast('정비 완료 · 현재 함선에 적용','success');}ui.showBase(sim);},
  leaveBase:()=>{if(sim.leaveBase()){save();keys.clear();if(sim.phase==='menu')ui.showCampaign(sim,true);else ui.hideModal();}},
  resume:()=>{if(growthPreparation||!resumeCombat(sim,ui))return false;keys.clear();audio.unlock();if(growthResumeNeeded)beginGrowthPreparation();return true;},
  pause:()=>{if(!sim.setPaused(true))return false;ui.showPause();keys.clear();return true;},
  chooseUpgrade:id=>{audio.unlock();return choosePreparedUpgrade(id);},
  cancelGrowth:()=>cancelGrowthPreparation(),retryGrowth:()=>{if(growthPreparation?.retry()){ui.growthStatus('새 함선을 다시 준비하고 있습니다');return true;}return false;},
  castSkill:id=>{audio.unlock();sim.castSkill(id);},
  openFleet:()=>{abandonTo('fleet');return sim.meta;},
  selectShip:id=>{if(!SHIPS.some(s=>s.id===id))return false;sim.meta.ship=id;save();scene.remove(playerModel);playerModel.userData.dispose?.();playerModel=createPlayer(0,{},sim.meta.tree,sim.meta.base,id,{...sim.meta.research,solar:sim.meta.campaign?.systemOwned?sim.meta.spaceBase:null});scene.add(playerModel);displayStage=0;displayLoadout='';return sim.meta;},
  openTree:()=>{abandonTo('tree');return sim.meta;},
  buyTree:id=>{audio.unlock();if(treePurchase(sim.meta,id)){save();audio.play('upgrade');ui.toast('기술 연구 완료 · 다음 출격부터 적용','success');}return sim.meta;},
  openDock:()=>{abandonTo('dock');return sim.meta;},
  openMenu:()=>{abandonTo('menu');return sim.meta;},
  buyResearch:id=>{audio.unlock();if(buyResearch(sim.meta,id)){audio.play('upgrade');save();ui.toast('연구 완료. 다음 출격부터 적용됩니다.','success');}else audio.play('click');return sim.meta;},
  toggleSound:()=>{sound=!sound;audio.setEnabled(sound);if(sound)audio.unlock();return sound;},
  setQuality:value=>setQuality(value),
});
const assetHangar=setupAssetHangar(()=>{displayLoadout='';if(onlineMode)online.command('setDesign',visualNation());if(sim.phase==='menu'){scene.remove(playerModel);playerModel.userData.dispose?.();playerModel=createPlayer(displayStage,{},sim.meta.tree,sim.meta.base,sim.meta.ship,sim.meta.research);scene.add(playerModel);}});
async function prepareNebula(){const current=nebulaBake;const ready=await current.prepare();if(!ready||current!==nebulaBake)return false;const proxy=new THREE.Mesh(nebulaDome.geometry,current.material),lease=createCompilationLease([proxy]);try{await lease.prepare(renderer,camera,scene,quality==='high'?composer.readBuffer:null);return current.diagnostics().ready;}catch{current.setEnabled(false);return false;}finally{lease.dispose();}}
function applyCombatResolution(){resize();}
function setQuality(value){quality=value;combatResolution.scale=1;bloom.enabled=value!=='low';applyCombatResolution();}
function start(index,chapter='solar',preparing=false){audio.unlock();keys.clear();clearObjects();if(!(chapter==='andromeda'?sim.startExpedition(index):sim.startCampaign(index)))return; environment.setSector(sim.meta.sector);displayStage=-1;if(!preparing)ui.hideModal();orbitView.reset();targetPosition.set(0,0,0);camera.position.set(16,30,34);shake=0;return true;}
combatFeedback=new CombatFeedback(document.querySelector('#ui'));
const carrierPriorityGuide=new CarrierPriorityGuide(document.querySelector('#ui'));
let priorityAdvice=null;

let baseWarmup=null,sortieShaderWarmup=null,sortieTransientWarmup=null;
function clearSortieShaderWarmup(){const transient=sortieTransientWarmup;sortieTransientWarmup=null;transient?.dispose();const held=sortieShaderWarmup;sortieShaderWarmup=null;held?.dispose();}
function clearBaseWarmup(){const w=baseWarmup;if(!w)return;baseWarmup=null;w.target?.dispose();w.hostile?.dispose();w.assets.release();}
function takeSortieShaderWarmup(){clearSortieShaderWarmup();const w=baseWarmup;if(!w?.hostile){clearBaseWarmup();return null;}baseWarmup=null;w.target?.dispose();sortieShaderWarmup=w.hostile;return sortieShaderWarmup;}
function warmBaseAssets({advance=true}={}){
 const key=sim.meta.ship+':'+(sim.meta.campaign?.cleared||0);if(baseWarmup?.key!==key){clearBaseWarmup();const planet=SOLAR_STAGES[Math.min(7,sim.meta.campaign?.cleared||0)].id,assets=acquireWarmupAssets([hullAsset(sim.meta.ship,0),'nation-k-scout','nation-n-scout','nation-q-cruiser','nation-o-scout','nation-y-carrier','nation-j-scout','solar-'+planet,'guided-missile','module-cannon']);const w={key,assets,state:'loading',index:0,drawIndex:0};baseWarmup=w;assets.ready.then(sources=>{if(baseWarmup!==w)return;w.hostile=createHostileShaderVariants(sources,{onDispose:assets.release});const objects=[];for(const source of sources)source?.traverse(o=>{if(o.isMesh){const proxy=new THREE.Mesh(o.geometry,o.material);proxy.frustumCulled=false;objects.push(proxy);}});w.objects=uniqueBufferObjects(objects);w.textures=visibleTextures(objects);w.view=createWarmDrawScene(scene);w.target=new THREE.WebGLRenderTarget(16,16);w.state='textures';});}
 if(!advance)return;
 const w=baseWarmup;if(w.state==='textures'){w.index=warmTextureSlice(renderer,w.textures,w.index,{limit:1,budgetMs:4}).index;if(w.index===w.textures.length)w.state='buffers';}else if(w.state==='buffers'){w.drawIndex=warmDrawSlice(renderer,w.view,camera,w.objects,w.drawIndex,w.target,2);if(w.drawIndex===w.objects.length){w.state='ready';w.target.dispose();w.target=null;}}
}
let growthPreparation=null,lastGrowthPreparation=null,growthResumeNeeded=false;const growthHistory=[];
function rememberGrowth(d){lastGrowthPreparation=structuredClone(d.metrics);growthHistory.push(lastGrowthPreparation);if(growthHistory.length>16)growthHistory.shift();}
function cancelGrowthPreparation({showPause=true,resumeNeeded=true}={}){const d=growthPreparation;growthPreparation=null;if(d){d.cancel();rememberGrowth(d);}growthResumeNeeded=resumeNeeded;keys.clear();tapUntil.clear();prev=performance.now();if(showPause&&sim.phase==='paused')ui.showPause();}
function beginGrowthPreparation(id=null){if(growthPreparation||onlineMode)return;const d=growthPreparation=new GrowthPreparation(sim);d.mark('selected',{id,level:sim.level,stage:sim.stage});growthResumeNeeded=true;keys.clear();tapUntil.clear();ui.showGrowthPreparation();d.paintFrames=0;}
function presentGrowth(d){if(!d.hudRequested){d.hudRequested=true;ui.update({...sim.snapshot(),fps,cameraZoom:44/orbitView.distance});ui.battleHUDReady().then(()=>{if(growthPreparation===d)d.hudReady=true;}).catch(error=>{if(growthPreparation===d){d.fail(error);ui.growthStatus('표시를 준비하지 못했습니다. 다시 준비하거나 일시정지로 이동하세요',true);}});}if(!d.hudReady||growthPreparation!==d||document.hidden||graphicsLost)return;try{if(d.finish(sim)){rememberGrowth(d);growthPreparation=null;growthResumeNeeded=false;keys.clear();tapUntil.clear();prev=performance.now();ui.hideModal();}}catch(error){d.fail(error);ui.growthStatus('성장 반영을 완료하지 못했습니다. 일시정지에서 상태를 확인하세요',true);}}
function choosePreparedUpgrade(id){if(growthPreparation||!sim.chooseUpgrade(id))return false;if(onlineMode){ui.hideModal();keys.clear();return true;}beginGrowthPreparation(id);return true;}
function useSupplyItem(id){
 const feedback=!onlineMode&&['playing','base'].includes(sim.phase)&&sim.player.hp>0&&['repair','charge'].includes(id);
 const hp=sim.player.hp,shield=sim.player.shield,boost=sim.player.boost;
 if(!sim.useItem(id)){
  if(feedback){
   const stocked=sim.meta.economy.inventory[id]>0;
   ui.toast(id==='repair'?(stocked?'V 선체 완전 수리 · 키트 보존':'V 수복 키트 없음 · J 거래소'):(stocked?'X 실드·추진 만충 · 셀 보존':'X 충전 셀 없음 · J 거래소'),stocked?'info':'warning');
  }
  return false;
 }
 if(!onlineMode&&sim.phase==='base'){processEvents();if(ui.preparationVisible())ui.showBase(sim);}
 if(feedback){
  const gain=(after,before)=>Number(Math.max(0,after-before).toFixed(1));
  const remaining=sim.meta.economy.inventory[id];
  ui.toast(id==='repair'?`V 수복 · 선체 +${gain(sim.player.hp,hp)} · ${remaining}개 남음`:`X 충전 · 실드 +${gain(sim.player.shield,shield)} · 추진 +${gain(sim.player.boost,boost)} · ${remaining}개 남음`,'success');
 }
 return true;
}

function cancelDeparture(){if(!departure)return;const d=departure;departure=null;ui.cancelBattleHUDPreparation();d.compilation?.dispose();d.warmTarget?.dispose();lastDeparture={...d.gate.metrics,cancelled:true};keys.clear();clearObjects();restorePreparedBase(sim,d.meta,d.location);ui.showBase(sim);prev=performance.now();}
async function prepareDeparture(index,chapter='solar'){
 if(departure)return;warmBaseAssets({advance:false});const d={gate:new SortieGate(),meta:structuredClone(sim.meta),location:sim.campaignDock||'earth',state:'ui',initialized:false,renders:0};departure=d;ui.showDeparture(index,chapter);retireIdlePreviewRenderer();keys.clear();
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(departure!==d)return;d.gate.mark('loading-ui-painted');
 const init=performance.now();if(!start(index,chapter,true)){cancelDeparture();return;}d.gate.mark('simulation-created',{cpuMs:performance.now()-init});d.gate.hold(sim);ui.beginBattleArt();d.gate.mark('hud-context-held');endingPreparation=preparePlanetEnding(sim.campaign.index,sim.meta);d.ending=endingPreparation;d.ending.ready.then(ready=>{if(departure===d)d.gate.mark('ending-scene-ready',{ready});});d.initialized=true;d.state='assets';ui.departureStatus('함선·적 함대·행성 모델을 준비하고 있습니다');
}
function abandonTo(phase){cancelGrowthPreparation({showPause:false,resumeNeeded:false});ui.endBattleArt();clearBaseWarmup();closeCampaignSession(sim);save();if(onlineMode){online.close();onlineMode=false;sim.meta=loadSave();sim.reset();}displayLoadout='';keys.clear();sim.phase=phase;sim.drainEvents();sim.enemies=[];sim.shots=[];sim.pickups=[];sim.hazards=[];sim.allies=[];sim.fleet=[];clearObjects();if(displayStage!==2||displayLoadout!==JSON.stringify(sim.meta)){scene.remove(playerModel);playerModel.userData.dispose?.();playerModel=createPlayer(2,{},sim.meta.tree,sim.meta.base,sim.meta.ship,sim.meta.research);scene.add(playerModel);displayStage=2;}playerModel.position.set(0,0,0);}
function clearObjects(){endingPreparation?.dispose();endingPreparation=null;clearSortieShaderWarmup();missileLaunchCamera.clear();for(const map of [mineralModels,defenseModels,fleetModels,peers,enemies,shots,pickups,allies,hazards]){for(const o of map.values()){scene.remove(o);o.userData.dispose?.();}map.clear();}effects.clear();projectileVisuals.clear();combatFeedback.clear();impactLight.intensity=0;impactLightLife=0;thrusterTrails.clear();}
let graphicsLost=false,graphicsResume=false;
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(growthPreparation)cancelGrowthPreparation();graphicsLost=true;graphicsResume=sim.phase==='playing';if(graphicsResume){sim.phase='paused';keys.clear();ui.showPause();}ui.toast('3D 그래픽 연결이 중단되었습니다. 전투를 보존하고 복구를 기다립니다.','warning');});
canvas.addEventListener('webglcontextrestored',()=>{graphicsLost=false;resetTextureWarmup(renderer);profiler.contextReset();reflections.dispose();reflections=createSpaceReflections(renderer);scene.environment=reflections.texture;stableOutput.reset();composer.reset();resize({force:true});const resume=graphicsResume;graphicsResume=false;missileLaunchCamera.resetPreparation();Promise.all([missileLaunchCamera.prepare(),prepareNebula()]).then(([ready])=>{if(ready&&resume&&sim.phase==='paused'){sim.phase='playing';ui.hideModal();}ui.toast('3D 그래픽 복구 완료 · 전투가 유지되었습니다.','info');}).catch(()=>ui.toast('근접 화면 준비에 실패했습니다 · 기지에서 다시 출격해주세요.','warning'));});
function resize({force=false}={}){const w=innerWidth,h=innerHeight,native=quality==='low'?1:Math.min(devicePixelRatio,1.5),ratio=native*combatResolution.scale;if(renderSizing.apply(w,h,ratio,{force,outputRatio:quality==='high'?native:ratio})||stableOutput.diagnostics().active!==(quality==='high'))stableOutput.configure(quality==='high',w*ratio,h*ratio,ratio/native);}
function renderBattlefield(){lastRenderScene=qaNativeRender?scene:renderIndex.prepare(camera,renderer);battlefieldPass.scene=lastRenderScene;if(quality==='high')stableOutput.render();else composer.render();}
window.addEventListener('resize',resize);
stableOutput.configure(true,innerWidth*renderer.getPixelRatio(),innerHeight*renderer.getPixelRatio(),1);
const suppress=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','KeyR','KeyZ','KeyC','Home','Escape','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
window.addEventListener('keydown',e=>{
  if(growthPreparation){if(e.code==='Escape'){e.preventDefault();cancelGrowthPreparation();}else if(suppress.has(e.code)||e.code.startsWith('Digit'))e.preventDefault();return;}if(departure){if(e.code==='Escape'){e.preventDefault();cancelDeparture();}else if(suppress.has(e.code)||e.code.startsWith('Digit'))e.preventDefault();return;}if(e.target instanceof HTMLSelectElement)return;
  if(suppress.has(e.code))e.preventDefault();keys.add(e.code);tapUntil.set(e.code,performance.now()+95);
  if(e.repeat)return;
  if(e.code==='KeyG'){if(sim.phase==='galaxyMap'){sim.closeGalaxy();ui.hideModal();}else if(sim.openGalaxy()){keys.clear();ui.showGalaxy(sim);}}
  if(e.code==='KeyB'){if(sim.phase==='carrier'){sim.closeCarrier();if(sim.phase==='base')ui.showBase(sim);else ui.hideModal();}else if(sim.openCarrier()){keys.clear();ui.showCarrier(sim);}}
  if(e.code==='KeyH'){if(sim.requestDefense()){keys.clear();ui.hideModal();}else ui.toast('현재 귀환 가능한 내 영토 침공이 없습니다 · 추진 25 필요','warning');}
  if(e.code==='KeyT'){const commands=['guard','assault','rally'];sim.commandFleet(commands[(commands.indexOf(sim.fleetCommand)+1)%3]);}
  if(e.code==='KeyR')sim.evade({x:sim.player.velocity.x,y:sim.player.velocity.y,z:sim.player.velocity.z});
  if(e.code==='KeyJ'&&sim.phase!=='market'){if(sim.openMarket()){keys.clear();ui.showMarket(sim);}return;}
  if(e.code==='KeyM'){sim.mine();return;}
  const lateral=lateralEvasion(e.code,orbitView.yaw);if(lateral){sim.evade(lateral);return;}
  if(e.code==='KeyV'){useSupplyItem('repair');return;}
  if(e.code==='KeyX'){useSupplyItem('charge');return;}
  if(e.code==='KeyF'){if(sim.dockBase()){keys.clear();ui.showBase(sim);}}
  if(e.code==='Escape'){
    if(sim.phase==='carrier'){sim.closeCarrier();if(sim.phase==='base')ui.showBase(sim);else ui.hideModal();keys.clear();return;}
    if(sim.phase==='galaxyMap'){sim.closeGalaxy();ui.hideModal();keys.clear();return;}
    if(sim.phase==='base'){sim.leaveBase();save();if(sim.phase==='menu')ui.showCampaign(sim,true);else ui.hideModal();keys.clear();return;}
    if(sim.phase==='market'){document.querySelector('[data-action=market-close]')?.click();return;}
    if(sim.phase==='playing'){sim.setPaused(true);ui.showPause();keys.clear();}
    else if(sim.phase==='paused'){sim.setPaused(false);ui.hideModal();keys.clear();}
  }
  if(['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'].includes(e.code)){
    const i=Number(e.code.slice(-1))-1;
    if(sim.phase==='upgrade'){const c=sim.choices[i];if(c)ui.previewUpgrade(c.id);}
    else if(SKILL_DEFS[i])sim.castSkill(SKILL_DEFS[i].id);
  }
  if(e.code==='Home'&&sim.phase==='playing'){stopOrbitDrag();orbitView.reset(sim.player.heading);}
  if(e.code==='KeyN'){sound=!sound;audio.setEnabled(sound);ui.setSound(sound);}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();tapUntil.clear();if(sim.phase==='playing'){sim.setPaused(true);ui.showPause();}});
document.addEventListener('visibilitychange',()=>{if(departure)departure.gate.mark(document.hidden?'document-hidden':'document-visible');if(document.hidden){keys.clear();if(sim.phase==='playing'){sim.setPaused(true);ui.showPause();}}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const stopOrbitDrag=bindOrbitView(canvas,orbitView,()=>sim.phase==='playing');


function makeHealthBar(e){const group=new THREE.Group();const bg=new THREE.Mesh(healthGeometry,healthBackground);bg.scale.set(4,.18,1);const fill=new THREE.Mesh(healthGeometry,healthMaterial);fill.position.z=.01;fill.scale.set(4,.12,1);group.add(bg,fill);group.userData.fill=fill;group.userData.width=4;group.renderOrder=10;return group;}
function registerHealthBar(root,bar){const release=healthBarBatch.register(root,bar),dispose=root.userData.dispose;root.userData.dispose=()=>{release();dispose?.();};}
function sync(map,entities,factory,update){const ids=new Set();for(const e of entities){ids.add(e.id);let o=map.get(e.id);if(o&&e.appearanceKey&&o.userData.appearanceKey!==e.appearanceKey){scene.remove(o);o.userData.dispose?.();map.delete(e.id);o=null;}if(!o){o=factory(e);o.userData.appearanceKey=e.appearanceKey;map.set(e.id,o);scene.add(o);}update(o,e);}for(const [id,o] of map){if(!ids.has(id)){scene.remove(o);map.delete(id);if(o.userData.dispose)o.userData.dispose();}}}

const landingGuide=createLandingGuide(scene);
function processEvents(){
  const events=coalesceHitPresentation(sim.drainEvents()),casting=events.some(e=>e.type==='skill');
  for(const event of events){
    const origin=event.position||event.shot?.position||event.from;
    const dx=origin?origin.x-sim.player.position.x:0,dy=origin?origin.y-sim.player.position.y:0,dz=origin?origin.z-sim.player.position.z:0;
    const pan=clamp((dx*Math.cos(orbitView.yaw)-dz*Math.sin(orbitView.yaw))/60,-.8,.8),attenuation=1/(1+Math.hypot(dx,dy,dz)/85);
    switch(event.type){
      case 'shot':missileLaunchCamera.trigger(event.shot,sim.time,camera);if(Math.hypot(dx,dy,dz)<160)audio.play(event.shot.type==='enemyMissile'?'enemyMissile':event.shot.type==='missile'?'missile':'cannon',pan,(event.shot.friendly?.85:.13)*attenuation,{distant:!event.shot.friendly});if(event.shot.friendly){const col=event.shot.type==='missile'?'#ffb45f':'#abf7ff';let origin=event.shot.position;if(event.shot.type==='cannon'){const turrets=playerModel.userData.turrets||[];const turret=turrets[(event.shot.id%Math.max(1,turrets.length))];const muzzle=turret?.userData.muzzle;if(muzzle){muzzle.getWorldPosition(temp2);origin=temp2;turret.userData.recoil=.32;}}effects.muzzle(origin,event.shot.direction,event.shot.type);if(event.shot.type==='cannon')combatFeedback.kick=Math.max(combatFeedback.kick,.025);}else if(Math.hypot(dx,dy,dz)<100){effects.atlas.emit(event.shot.position,'spark',event.shot.type==='enemyMissile'?2:1,.12,'#ff536d');}break;
      case 'hit':if(Math.hypot(event.position.x-sim.player.position.x,event.position.y-sim.player.position.y,event.position.z-sim.player.position.z)<160){effects.impact(event,sim.player.position);if(event.kind==='planetBase'){effects.shock(event.position,Math.min(16,(event.radius||5)*2),'#ffa974',.65);if(event.killed)effects.spectacle(event.position,'invasion',18);}combatFeedback.hit(event);audio.play('hit',pan,(event.critical?1.1:.8)*attenuation);impactLight.position.set(event.position.x,event.position.y,event.position.z);impactLight.color.set(event.critical?'#ffe48c':'#94efff');impactLightLife=.1;}break;
      case 'explosion':effects.explosion(event.position,event.size,event.color);audio.play('explosion',pan,Math.min(1.3,event.size/4)*attenuation);combatFeedback.explosion(event.position,event.size,sim.player.position);break;
      case 'beam':effects.beam(event.from,event.to,event.color,event.width,event.life);if(!casting)audio.play('laser',pan,.7*attenuation);break;
      case 'chain':effects.chain(event.points);audio.play('chain',0,.85);break;
      case 'pulse':effects.pulse(event.position,event.radius,event.color);shake=Math.max(shake,.55);combatFeedback.energy=Math.max(combatFeedback.energy,.18);break;
      case 'overcharge':effects.pulse(event.position,10);ui.toast('코어 과충전 · '+Math.ceil(sim.player.overcharge)+'초 · 연사 ×2 / 쿨타임 회복 ×1.35','success');break;
      case 'missileAlert':audio.play('alert',0,1);ui.toast('유도탄 접근! Z/C 좌우 회피 · R 회피 · WASD + Q/E로 경로 변경','warning');break;
      case 'evade':effects.pulse(event.position,6);audio.play('boost');ui.toast('회피 기동 · 근거리 유도탄 추적 해제','success');break;
      case 'raidStarted':ui.refreshGalaxy(sim);if(event.war.defender===sim.actor){effects.spectacle(sim.player.position,'invasion',14);ui.announce('긴급 수신 · '+event.planet+' 피습',event.war.strength+'척 접근 · 120초 내 방어 · H 또는 긴급 귀환 버튼');audio.play('boss');}break;
      case 'raidDefended':ui.refreshGalaxy(sim);if(event.war.defender===sim.actor){audio.play('victory');ui.announce('방어 성공 · '+event.planet,'침공 함대 격파 · 영토와 생산 시설 보존');}break;
      case 'territoryChanged':ui.refreshGalaxy(sim);ui.announce('영토 소유권 변경 · '+event.planet,event.old===sim.actor?'영토 상실 · 생산 중단 · 기지와 우두머리를 격파해 탈환하세요':'은하 전선이 이동했습니다');break;
      case 'territorySave':save();break;
      case 'regionConquest':audio.play('upgrade');ui.announce('성역 해방 · '+event.region,'항로 복원 · 보관 아르켈륨 +'+event.reward);break;
      case 'conquest':effects.spectacle(sim.player.position,'conquest',24);audio.play('upgrade');ui.announce('행성 점령 · '+event.planet,'점령 보상 '+event.reward+' 아르켈륨 · 생산 거점 확보 · 적 침공 시 방어 필요');break;
      case 'warp':thrusterTrails.clear();effects.spectacle(event.position,'arrival',18);targetPosition.set(event.position.x,event.position.y,event.position.z);camera.position.set(event.position.x+32,event.position.y+38,event.position.z+38);audio.play('warp');ui.announce('궤도 도약 · '+event.name,'행성 방어 기지를 모두 파괴해 점령하세요');break;
      case 'cosmic':audio.play('boss');effects.pulse(event.position,event.radius,event.type==='storm'?'#ffab45':'#b77dff');ui.announce(event.name,event.hint+' · 활성 전 짧은 예고');break;
      case 'defenseRecallStarted':effects.pulse(event.position,14,'#ffbd7a');audio.play('boost');ui.announce('선단 긴급 귀환 · '+event.planet,'3초 도약 준비 · 준비 중 기동 가능 · 피격 주의');break;
      case 'defenseArrival':thrusterTrails.clear();targetPosition.set(event.position.x,event.position.y,event.position.z);effects.spectacle(event.position,'departure',22);ui.announce(event.planet+' 방어 출격',event.ships+'척 선단 엄호 대형 · 적 '+event.attackers+'척 격파해 침공 저지 · T로 돌격');audio.play('boss');break;
      case 'defenseBuilt':ui.toast(event.name+' '+event.level+'단계 배치 완료','success');break;
      case 'intercept':effects.burst(event.position,'#92fff0',1.5,10);audio.play('shield',0,.3);break;
      case 'defenseHit':effects.burst(event.position,'#ff8d56',2,12);if(event.destroyed)ui.toast('방어 시설 가동 중단 · 자동 수복 대기 45초','warning');break;
      case 'defenseRecovered':effects.pulse(event.position,8,'#9effbf');break;
      case 'warning':effects.warning(event.position,event.target,event.life);break;
      case 'damage':{const response=receivedImpact(event,combatFeedback.reduced);if(!response.active)break;audio.play(response.sound,pan,response.volume);combatFeedback.damage(event,sim.player.position,camera,response);effects.received(event.position,event.shielded,event.amount,4*(playerModel.userData.growth?.scale.x||1),response);impactLight.position.copy(playerModel.position);impactLight.color.set(event.shielded>0?'#6cddff':'#ff784c');impactLightLife=Math.max(impactLightLife,response.lightLife);break;}
      case 'pickup':audio.play('pickup',pan,.3);effects.particle(event.position,'#baffff',1.2,null,.4);break;
      case 'boost':effects.spectacle(sim.player.position,'boost',7);audio.play('boost');break;
      case 'levelup':audio.play('levelup');ui.showUpgrades(event.choices,sim);keys.clear();break;
      case 'upgrade':audio.play('upgrade');ui.toast((event.level===1?'새 무장 장착':'무장 강화')+' · '+(sim.choices?.find(c=>c.id===event.id)?.name||({cannon:'레일 기관포',chain:'아크 방전기',missile:'군집 유도탄',laser:'프리즘 관통포',fighter:'요격기 격납고',armor:'적층 장갑',shield:'재생 방어막',magnet:'잔해 회수장',reactor:'공명 반응로'}[event.id])),'success');break;
      case 'evolve':effects.spectacle(sim.player.position,'evolve',20);effects.pulse(sim.player.position,18);audio.play('upgrade',0,1.3);shake=.6;ui.announce(event.stage===1?'BASTION / 전투함으로 증축':'ARK / 우주 모함 완성',event.stage===1?'장갑 확장 · 포대 증설 · 선체 내구도 상승':'격납고 개방 · 호위기 출격 · 대형 함체 전개');break;
      case 'fleetUnlocked':save();audio.play('upgrade');ui.announce(event.name+' 편성',event.count+'척의 선단 합류 · T로 돌격 / 엄호 / 재집결');break;
      case 'fleetUpgraded':effects.spectacle(sim.fleet.find(a=>a.slot===event.slot)?.position||sim.player.position,'evolve',8);break;
      case 'fleetCommand':effects.shock(sim.player.position,14,'#89ffdc',.6);ui.toast('선단 명령 · '+event.name,'success');break;
      case 'fleetDisabled':ui.toast(event.name+' 전투불능 · 재집결로 복귀 가속','warning');break;
      case 'fleetRecovered':ui.toast(event.name+' 전열 복귀','success');break;
      case 'skillLink':audio.play('click',0,.5);effects.pulse(event.position||sim.player.position,9,'#ffdf88');break;
      case 'skill':effects.skill(event.id,sim.player.position,sim.player.heading,sim.stage);audio.play(event.id);if(['nova','stasis','repair','lance','countermeasure','sentry'].includes(event.id)){ui.toast(SKILL_DEFS.find(s=>s.id===event.id).name,'success');}break;
      case 'boss':effects.spectacle(event.enemy.position,'invasion',25);audio.play('boss');shake=.7;break;
      case 'economySave':save();break;
      case 'mineralMined':effects.pulse(event.position,5,'#5ef2cf');audio.play('pickup',0,.7);ui.toast('아르켈륨 +'+event.amount,'success');break;
      case 'titanReward':save();effects.spectacle(event.position,'conquest',40);effects.pulse(event.position,55,'#ffdf88');audio.play('victory');shake=1;ui.announce('거함 격파 · 전설 전리품 확보','보관 아르켈륨 +'+event.bank+' · 경험치 +'+event.xp+' · '+event.weapon+' · 모든 스킬 재충전');break;
      case 'titanExposed':effects.pulse(event.position,22,'#86fff0');ui.toast('코어 노출! 4초간 피해 ×1.8 · 스킬 연계로 집중 공격','success');break;
      case 'bossfire':effects.burst(event.position,'#ff6954',2.5,18);audio.play('missile',pan,.8);break;
      case 'enemyFleet':effects.spectacle(event.position,'invasion',18);ui.announce(event.captain.name+' · '+event.captain.title,event.captain.trait+' / '+event.captain.quote);audio.play('boss');break;
      case 'transmission':ui.toast(event.planet+' · '+event.captain.name+': '+event.captain.quote,'warning');break;
      case 'fleetDisrupted':ui.toast(event.name+'의 선단 지휘 붕괴 · 남은 호위함 약화','success');break;
      case 'start':effects.spectacle(sim.player.position,'departure',12);break;
      case 'dock':case 'departure':case 'service':effects.spectacle(event.position,event.type,12);audio.play(event.type==='service'?'repair':event.type);break;
      case 'dash':effects.spectacle(event.position,'dash',6);break;
      case 'launch':effects.spectacle(event.position,'departure',6);effects.burst(event.position,'#c38fff',2,15);break;
      case 'announce':ui.announce(event.title,event.sub);break;
      case 'end':{const prepared=endingPreparation;const trace=lastEndingTransition={at:performance.now(),time:sim.time,victory:event.result.victory,steps:{}};const measure=(name,fn)=>{const at=performance.now();try{return fn();}finally{trace.steps[name]=performance.now()-at;}};endingPreparation=null;measure("save",()=>save());keys.clear();measure("hudClose",()=>ui.endBattleArt());measure("shaderClose",()=>clearSortieShaderWarmup());measure('audio',()=>audio.play(event.result.victory?'victory':'defeat'));if(event.result.victory&&event.result.campaign)measure('endingSchedule',()=>playPlanetEnding(event.result,sim.meta,()=>{if(sim.phase==='ended')ui.showEnd(sim.result,sim.meta);},prepared));else{prepared?.dispose();setTimeout(()=>{if(sim.phase==='ended')ui.showEnd(sim.result,sim.meta);},event.result.victory?1100:500);}break;}
    }
  }
}

const forward=new THREE.Vector3(0,0,-1);

function createRemotePlayer(a){const model=createPlayer(a.stage??0,a.upgrades||{cannon:1},a.tree||{},a.base||{},a.ship,a.research||{},a.nation||'');createShipSupport(model,a.base,a.stage??0);return model;}

function updateVisuals(dt,time){
  const p=sim.player;
  const tree=sim.meta.tree||{},visualUpgrades={...sim.upgrades};
  const loadout=JSON.stringify([visualUpgrades,tree,sim.meta.base,sim.vessel.id,sim.meta.research,sim.meta.spaceBase,visualNation()]);
  if((displayStage!==sim.stage||displayLoadout!==loadout)&&['playing','paused','upgrade','base','carrier','galaxyMap','market','ended'].includes(sim.phase)){const evolveTime=displayStage!==sim.stage?time:playerModel.userData.evolveTime;const next=createPlayer(sim.stage,visualUpgrades,tree,sim.meta.base,sim.vessel.id,sim.meta.research);try{createShipSupport(next,sim.meta.base,sim.stage);}catch(error){next.userData.dispose?.();throw error;}next.userData.evolveTime=evolveTime;const previous=playerModel;scene.remove(previous);playerModel=next;scene.add(next);previous.userData.dispose?.();displayStage=sim.stage;displayLoadout=loadout;}
  if(['playing','paused','upgrade','base','carrier','galaxyMap','ended'].includes(sim.phase)){
    playerModel.position.set(p.position.x,p.position.y,p.position.z);playerModel.rotation.y=p.heading;playerModel.scale.setScalar(1);
    const speed=Math.hypot(p.velocity.x,p.velocity.z),bank=clamp(p.velocity.x*Math.cos(p.heading)-p.velocity.z*Math.sin(p.heading),-12,12)/12;
    if(p.hit>0)playerModel.userData.hitFlash?.material.color.set(combatFeedback.hull?'#ff936c':'#71e7ff');
    animateShip(playerModel,time,{thrust:Math.hypot(speed,p.velocity.y)/16,bank,boost:sim.boosting,hit:p.hit,verticalSpeed:p.velocity.y,horizontalSpeed:speed,dt});if(sim.evadeTimer>0)playerModel.userData.visualRoot.rotation.z+=(1-sim.evadeTimer/(sim.evadeDuration||.6))*Math.PI*2;
    const target=sim.nearest(p.position,88);
    for(const turret of playerModel.userData.turrets||[]){
      if(!turret.userData.restPosition)turret.userData.restPosition=turret.position.clone();
      turret.userData.recoil=(turret.userData.recoil||0)*Math.exp(-dt*18);
      turret.position.z=turret.userData.restPosition.z+(turret.userData.recoil||0);
      if(target){
        turret.getWorldPosition(temp);
        const dx=target.position.x-temp.x,dy=target.position.y-temp.y,dz=target.position.z-temp.z;
        const angle=Math.atan2(-dx,-dz)-p.heading;
        const difference=Math.atan2(Math.sin(angle-turret.rotation.y),Math.cos(angle-turret.rotation.y));
        const blend=1-Math.exp(-dt*9);
        turret.rotation.order='YXZ';turret.rotation.y+=difference*blend;
        turret.rotation.x+=(Math.atan2(dy,Math.hypot(dx,dy,dz))-turret.rotation.x)*blend;
      }
    }
    if(sim.phase==='playing'){thrusterTrails.emit(playerModel,dt,{boost:sim.boosting||sim.evadeTimer>0});effects.flight(playerModel,dt,{boost:sim.boosting||sim.evadeTimer>0});}
    shield.position.copy(playerModel.position);shield.scale.setScalar((1+sim.stage*.4)*(playerModel.userData.growth?.scale.x||1));invisibleShieldMat.opacity=p.hit>0&&p.shield>0?.45*p.hit/.28:p.overcharge>0?.055:0;
    invisibleShieldMat.uniforms.time.value=time;const nozzle=playerModel.userData.engines?.[0];if(nozzle)nozzle.getWorldPosition(engineLight.position);else engineLight.position.copy(playerModel.position);engineLight.color.setHex(playerModel.userData.trailColor||0x26cfff);engineLight.intensity=sim.boosting?40:18;
  }
  sync(enemies,sim.enemies,e=>{const model=e.planetTheme?createPlanetEnemy(e):e.enemyAppearance?createEnemyFleetShip({...e.enemyAppearance,nation:planetNation(e.planetId,e.nationOwner||sim.war.owners[e.planetId])}):e.kind==='rival'?createRemotePlayer(e):e.kind==='planetBase'?createPlanetFortress(planetNation(e.planetId,e.nationOwner||sim.war.owners[e.planetId])):e.kind==='boss'?createBoss(e.commander,e.titan,e.planetId?planetNation(e.planetId,e.nationOwner||sim.war.owners[e.planetId]):undefined):createEnemy(e.kind);const bar=makeHealthBar(e);model.add(bar);model.userData.healthbar=bar;registerHealthBar(model,bar);installFactionIdentity(model,e.kind==='boss'?'boss':'enemy');return model;},(o,e)=>{
    o.position.set(e.position.x,e.position.y,e.position.z);o.userData.factionIdentity?.update(camera,e.radius);const heading=Math.atan2(-(p.position.x-e.position.x),-(p.position.z-e.position.z));const targetHeading=Number.isFinite(e.heading)?e.heading:heading;const difference=Math.atan2(Math.sin(targetHeading-o.rotation.y),Math.cos(targetHeading-o.rotation.y));o.rotation.y+=difference*(1-Math.exp(-dt*(e.kind==='boss'?1.5:4)));
    animateShip(o,time+e.id,{thrust:e.stun>0?0:.7,bank:Math.sin(e.age)*.25,boost:e.kind==='interceptor'&&e.phase===1,hit:e.hit});
    if(e.kind==='boss'){
      const order=[4,1,3,5,2];const count=Math.min(5,Math.floor((1-e.hp/e.maxHp)*6));
      for(let i=0;i<count;i++){const part=o.userData.parts?.[order[i]];if(part?.visible){part.getWorldPosition(temp);part.visible=false;effects.explosion(temp,4.5,'#ff9a51');audio.play('explosion',0,.7);}}
      for(const engine of o.userData.engines||[])engine.visible=o.userData.parts?.[5]?.visible??true;
    }
    if(sim.phase==='playing'&&e.stun<=0){thrusterTrails.emit(o,dt,{enemy:true,boost:e.kind==='interceptor'&&e.phase===1});if(o.position.distanceTo(playerModel.position)<120)effects.flight(o,dt,{enemy:true,boost:e.phase===1});}
    const bar=o.userData.healthbar;bar.position.set(0,e.radius+1,0);bar.quaternion.copy(camera.quaternion);bar.rotateY(-o.rotation.y);bar.visible=e.hp<e.maxHp&&e.kind!=='boss';const width=bar.userData.width;bar.userData.fill.scale.x=width*Math.max(0,e.hp/e.maxHp);bar.userData.fill.position.x=-(width-bar.userData.fill.scale.x)/2;
  });
  sync(shots,sim.shots,s=>projectileVisuals.create(s),(o,s)=>projectileVisuals.update(o,s,dt,time,sim.phase==='playing'));
  sync(pickups,sim.pickups,()=>new THREE.Mesh(pickupGeometry,pickupMaterial),(o,pickup)=>{o.position.set(pickup.position.x,pickup.position.y,pickup.position.z);o.rotation.set(time*1.8,time,time*.5);o.scale.setScalar(.8+Math.sin(time*5+pickup.id)*.15);});
  sync(peers,onlineMode?online.players.filter(a=>a.id!==online.id&&a.galaxyId===sim.galaxyId&&a.phase==='playing'&&Math.hypot(a.position.x-p.position.x,a.position.z-p.position.z)<500&&!sim.enemies.some(e=>e.remoteId===a.id)):[],a=>createRemotePlayer(a),(o,a)=>{o.position.lerp(temp2.set(a.position.x,a.position.y,a.position.z),.4);o.rotation.y=a.heading;animateShip(o,time,{thrust:1});if(sim.phase==='playing')thrusterTrails.emit(o,dt,{enemy:true});});
  sync(fleetModels,(sim.fleet||[]).filter(a=>a.hp>0),a=>{const d=a.configuration||FLEET_ROLES[a.role],mesh=createFleetShip(d);const bar=makeHealthBar(a),material=new THREE.MeshBasicMaterial({color:0x82ffd3,depthTest:false});bar.children[1].material=material;mesh.add(bar);mesh.userData.healthbar=bar;const dispose=mesh.userData.dispose;mesh.userData.dispose=()=>{dispose?.();material.dispose();};registerHealthBar(mesh,bar);installFactionIdentity(mesh,'ally');return mesh;},(o,a)=>{o.position.set(a.position.x,a.position.y,a.position.z);o.userData.factionIdentity?.update(camera,a.radius||5);o.rotation.y=a.heading;animateShip(o,time,{thrust:1,hit:a.hit});const bar=o.userData.healthbar;bar.quaternion.copy(camera.quaternion);bar.children[1].scale.x=4*Math.max(.01,a.hp/a.maxHp);if(sim.phase==='playing'){thrusterTrails.emit(o,dt,{scale:(a.configuration||FLEET_ROLES[a.role]).scale});effects.flight(o,dt);}});
  sync(allies,sim.allies,()=>{const mesh=createPlayer(0);mesh.scale.setScalar(.28);installFactionIdentity(mesh,'ally');return mesh;},(o,a)=>{o.position.set(a.position.x,a.position.y,a.position.z);o.userData.factionIdentity?.update(camera,1.5);o.rotation.y=orbitHeading(a.angle);animateShip(o,time,{thrust:1});if(sim.phase==='playing')thrusterTrails.emit(o,dt,{scale:.28});});
  sync(mineralModels,(sim.minerals||[]).filter(n=>n.remaining>0&&sim.phase!=='menu'),()=>{const g=new THREE.Group(),geo=new THREE.OctahedronGeometry(2.3),mat=new THREE.MeshStandardMaterial({color:0x5ef2cf,emissive:0x159c7c,emissiveIntensity:1.4,metalness:.3,roughness:.2});for(let i=0;i<3;i++){const o=new THREE.Mesh(geo,mat);o.position.set((i-1)*2,i===1?1:0,0);o.scale.y=1.5+i*.3;g.add(o);}g.userData.dispose=()=>{geo.dispose();mat.dispose();};mountAsset(g,'arkelium-ore',{size:8,hide:[...g.children]});return g;},(o,n)=>{o.position.set(n.position.x,n.position.y,n.position.z);o.rotation.y=time*.18;});
  sync(defenseModels,sim.defenses||[],d=>{const o=createDefenseModel(d),bar=makeHealthBar(d);o.add(bar);o.userData.healthbar=bar;registerHealthBar(o,bar);return o;},(o,d)=>{animateDefense(o,d,time);const bar=o.userData.healthbar;bar.position.set(0,8,0);bar.quaternion.copy(camera.quaternion);bar.visible=d.hp<d.maxHp;const width=bar.userData.width;bar.userData.fill.scale.x=width*Math.max(0,d.hp/d.maxHp);bar.userData.fill.position.x=-(width-bar.userData.fill.scale.x)/2;});
  sync(hazards,sim.hazards,h=>{if(h.cosmic)return createCosmicModel(h);
    const group=new THREE.Group();const mat=new THREE.MeshBasicMaterial({color:0xc471ff,transparent:true,opacity:.15,wireframe:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});const sphere=new THREE.Mesh(new THREE.IcosahedronGeometry(h.radius,2),mat);group.add(sphere);const ringMat=new THREE.MeshBasicMaterial({color:0xe7a2ff,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(h.radius,.06,5,60),ringMat);ring.rotation.x=Math.PI/2-i*.7;group.add(ring);}group.userData.dispose=()=>{group.traverse(o=>o.geometry?.dispose());mat.dispose();ringMat.dispose();};return group;
  },(o,h)=>{if(h.cosmic){animateCosmic(o,h,time);return;}o.position.set(h.position.x,h.position.y,h.position.z);o.rotation.y+=dt*.5;const scale=h.warning>0?1+(Math.sin(time*13)*.05):.9+Math.sin(time*2)*.08;o.scale.setScalar(scale);for(const child of o.children)child.material.color.set(h.warning>0?0xffbd68:0xb56bff);});
}

let lastIdleRender=0;
let hudElapsed=0,qaSubmissionRequested=false,qaSubmissionReport=null;
let prev=performance.now(),fpsFrames=0,fpsTime=0,fps=60,lowestFPS=60,drawCalls=0;
function frame(now){
  if(qaProfileMode==='raf-only'){prev=now;return;}
  if(graphicsLost){prev=now;return;}if(document.hidden){prev=now;return;}if(departure&&!departure.initialized){prev=now;return;}if(!onlineMode&&ui.preparationVisible()){prev=now;audio.setMotion(0,false,sim.stage);audio.update(gameTime,sim.phase);if(sim.phase==='base'){try{warmBaseAssets();}catch{clearBaseWarmup();}}return;}if(!onlineMode&&!departure&&!growthPreparation&&sim.phase!=='playing'&&now-lastIdleRender<(ui.preparationVisible()?500:125)){prev=now;return;}lastIdleRender=now;profiler.start(sim.time,sim.phase,sim.level);const rawDt=(now-prev)/1000;assetHangar.update(sim.phase);const wallDt=departure||growthPreparation?0:Math.min(.05,rawDt);prev=now;gameTime+=wallDt;
  const playing=sim.phase==='playing';if(!playing)stopOrbitDrag();
  const held=code=>keys.has(code)||(tapUntil.get(code)||0)>now;
  const rawX=(held('KeyD')||held('ArrowRight')?1:0)-(held('KeyA')||held('ArrowLeft')?1:0);
  const rawZ=(held('KeyS')||held('ArrowDown')?1:0)-(held('KeyW')||held('ArrowUp')?1:0);
  const input=qaInput||{x:rawX*Math.cos(orbitView.yaw)+rawZ*Math.sin(orbitView.yaw),z:rawZ*Math.cos(orbitView.yaw)-rawX*Math.sin(orbitView.yaw),y:(held('KeyE')?1:0)-(held('KeyQ')?1:0),mine:held('KeyM'),boost:held('ShiftLeft')||held('ShiftRight')||held('Space')};
  if(onlineMode){onlineSendTimer+=wallDt;if(onlineSendTimer>=.05){onlineSendTimer=0;online.input(playing?input:{});}}else if(playing)sim.step(wallDt,input);processEvents();profiler.mark('simulation');
  if(qaProfileMode==='simulation-only'){profiler.end(rawDt*1000,sim.time,sim.phase,sim.level);return;}
  const skinColor={aurora:0xbb88ff,solar:0xffd278}[sim.meta.economy?.activeSkin]||0x64ffff;playerModel.userData.trailColor=skinColor;for(const e of playerModel.userData.engines||[]){const flame=e.userData.flame?.material;if(flame?.uniforms?.tint)flame.uniforms.tint.value.setHex(skinColor);else flame?.color?.setHex(skinColor);e.userData.hot?.material.color.setHex(skinColor);}
  const inGame=['playing','paused','upgrade','base','carrier','galaxyMap','ended'].includes(sim.phase);
  dock.setVisible(!inGame);if(!inGame)dock.update(gameTime);
  const visualDt=sim.phase==='paused'||sim.phase==='upgrade'||sim.phase==='base'||sim.phase==='carrier'||sim.phase==='galaxyMap'?0:wallDt;
  if(!inGame){menuAngle+=wallDt*.08;playerModel.position.set(0,Math.sin(gameTime*.4)*.4,0);playerModel.rotation.y=menuAngle;animateShip(playerModel,gameTime,{thrust:.55,bank:Math.sin(gameTime*.3)*.08});targetPosition.set(0,0,0);cameraDesired.set(21,18,26).multiplyScalar((1+displayStage*.25)*(playerModel.userData.growth?.camera||1));camera.position.lerp(cameraDesired,1-Math.exp(-wallDt*2));camera.lookAt(0,0,-2);shield.visible=false;engineLight.position.copy(playerModel.position);}
  else {
    shield.visible=true;temp.set(sim.player.position.x+sim.player.velocity.x*.42,sim.player.position.y+1,sim.player.position.z+sim.player.velocity.z*.42);
    const boss=sim.enemies.find(e=>e.kind==='boss'&&e.hp>0);
    const separation=boss?Math.hypot(boss.position.x-sim.player.position.x,boss.position.y-sim.player.position.y,boss.position.z-sim.player.position.z):0;
    const frameBoss=boss&&separation<115&&!orbitView.manual;
    if(frameBoss)temp.lerp(temp2.set(boss.position.x,boss.position.y,boss.position.z),.5);
    targetPosition.lerp(temp,1-Math.exp(-wallDt*4));
    const scale=(1+(sim.meta.fleetRank||0)*.18)*(1+sim.stage*.13+(boss?.12:0))*(playerModel.userData.growth?.camera||1);const distance=Math.max(orbitView.distance*scale,frameBoss?Math.min(155,separation*1.3+30):0);cameraDesired.set(Math.sin(orbitView.yaw)*Math.cos(orbitView.pitch)*distance,Math.sin(orbitView.pitch)*distance,Math.cos(orbitView.yaw)*Math.cos(orbitView.pitch)*distance).add(targetPosition);
    camera.position.lerp(cameraDesired,1-Math.exp(-wallDt*(orbitView.manual?8:3)));shake=Math.max(0,shake-wallDt*1.7);if(visualDt>0&&!combatFeedback.reduced){const kick=combatFeedback.kick;camera.position.x+=Math.sin(gameTime*71)*(shake*.5+kick*.8);camera.position.y+=Math.cos(gameTime*59)*(shake*.4+kick*.6);}camera.lookAt(targetPosition);
  }
  if(qaCameraFreeze){camera.position.copy(qaCameraFreeze.position);camera.quaternion.copy(qaCameraFreeze.quaternion);}camera.updateMatrixWorld();profiler.mark('camera');
  galaxySky.update(sim.player.position,sim.galaxyId,gameTime,inGame&&sim.mode==='galaxy');galaxyWorld.update(gameTime,sim.meta.conquest,inGame&&sim.mode==='galaxy',sim.galaxyId);setShipDetailSubview(missileLaunchCamera.detailView(sim.time,playing));const solarFrame=solarSnapshot(sim);solarBattlefield.update(solarFrame,gameTime,inGame);landingGuide.update(playing?solarFrame:null,sim.player.position,camera,gameTime);fieldBase.root.visible=inGame&&sim.mode!=='campaign'&&sim.galaxyId==='milky';fieldBase.update(gameTime,sim.meta.base);if(growthPreparation?.state==='painting'&&++growthPreparation.paintFrames>=2)growthPreparation.painted();if(!growthPreparation||!['painting','failed'].includes(growthPreparation.state)){try{updateVisuals(visualDt,gameTime);}catch(error){if(!growthPreparation)throw error;growthPreparation.fail(error);ui.growthStatus('함선을 준비하지 못했습니다. 다시 준비하거나 일시정지로 이동하세요',true);}}environment.setCampaign(inGame&&sim.mode==='campaign');environment.update(inGame?sim.player.position:{x:0,y:0,z:0},gameTime);nebulaBake.update();assetEnvironment.update(inGame?sim.player.position:{x:0,y:0,z:0},gameTime);effects.update(sim.phase==='base'?wallDt:visualDt,gameTime,camera,innerHeight);thrusterTrails.update(visualDt);projectileVisuals.tick(visualDt);
  profiler.mark('visuals');if(growthPreparation?.state==='build')growthPreparation.built({visualMs:profiler.current.visuals});if(qaProfileMode==='visuals-only'){profiler.end(rawDt*1000,sim.time,sim.phase,sim.level);return;}if(departure){departure.gate.sample(sim);if(!departure.modelsMarked){departure.modelsMarked=true;departure.gate.mark('models-created',{visualMs:profiler.current.visuals});}}
  combatFeedback.update(visualDt,camera,innerWidth,innerHeight,inGame&&!['paused','upgrade','base','carrier','galaxyMap','ended'].includes(sim.phase));impactLightLife=Math.max(0,impactLightLife-visualDt);impactLight.intensity=impactLightLife*180;
  audio.setMotion(Math.hypot(sim.player.velocity.x,sim.player.velocity.y,sim.player.velocity.z),sim.boosting,sim.stage);audio.setIntensity(Math.min(1,.15+sim.enemies.length/80+(sim.fever?.25:0)));audio.update(gameTime,sim.phase==='playing'?(sim.enemies.some(e=>e.kind==='boss')?'boss':'playing'):sim.phase==='ended'?(sim.result?.victory?'victory':'defeat'):sim.phase);
  priorityAdvice=carrierPriorityGuide.update(sim,camera,enemies,innerWidth,innerHeight,now,sim.phase==='playing'&&!departure);
  profiler.mark('feedbackAudio');assetInstanceBatch.update(now,camera);profiler.mark('batch');Object.assign(profiler.current,assetInstanceBatch.timings);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});healthBarBatch.update(camera,{worldMatricesFresh:true});profiler.mark('engineFlames');
  if(!qaFixedResolution&&combatResolution.update(rawDt,fps,playing))applyCombatResolution();
  if(departure){const d=departure,assets=assetDiagnostics();try{
   if(d.state==='assets'&&(nebulaBake.diagnostics().ready||nebulaBake.diagnostics().failure)&&assets.loading===0&&assets.queued===0&&projectileVisuals.preparationResources().ready&&effects.atlas.preparationResources().ready){d.state='shaders';d.gate.mark('assets-ready',{failed:assets.failed});const hostile=takeSortieShaderWarmup();const transient=sortieTransientWarmup=createTransientShaderWarmup();d.gate.mark("transient-shader-variants",transient.diagnostics());ui.departureStatus('광원과 전장 효과를 준비하고 있습니다');(()=>{const visible=visibleCompileRoot(scene,camera);d.visibleObjects=visible.objects;const projectiles=projectileVisuals.preparationResources().objects,resources=[...visible.objects,...projectiles,...effects.preparationObjects(),...healthBarBatch.prepareObjects(),...factionMarkerBatch.prepareObjects().map(source=>{const o=Object.create(source);o.visible=true;o.count=1;return o;})];d.gate.mark('projectile-resources',{objects:projectiles.length,textures:visibleTextures(projectiles).length});d.bufferObjects=uniqueBufferObjects(resources);const atlas=effects.atlas.preparationResources();d.textures=[...new Set([...visibleTextures(resources),...atlas.textures])];d.gate.mark('effect-atlas-resources',{textures:atlas.textures.length,failed:atlas.failed});d.drawIndex=0;d.warmView=createWarmDrawScene(scene);d.warmTarget=new THREE.WebGLRenderTarget(16,16);d.textureIndex=0;d.gate.mark('visible-materials',{objects:visible.objects.length,textures:d.textures.length,bufferObjects:d.bufferObjects.length});const target=quality==='high'?composer.readBuffer:null;if(hostile)d.gate.mark('hostile-shader-variants',hostile.diagnostics());d.compilation=createCompilationLease(resources);return Promise.all([d.compilation.prepare(renderer,camera,scene,target),hostile?.prepare(renderer,camera,scene,target),transient.prepare(renderer,camera,scene,target),missileLaunchCamera.prepare(),d.ending.ready.then(ready=>{if(!ready)throw new Error("Ending scene preparation failed");})]);})().then(()=>{if(departure===d){d.shadersReady=true;d.state=d.textureIndex===d.textures.length?'buffers':'textures';d.gate.mark('shaders-ready');ui.departureStatus('전장 텍스처를 준비하고 있습니다 · 전투는 아직 시작되지 않습니다');}}).catch(()=>{if(departure===d){d.state='failed';ui.departureStatus('화면 준비에 실패했습니다 · 기지로 돌아가 다시 출격해주세요');}});}
   if(performance.now()-d.gate.started>20000&&!d.slowWarning&&d.state!=='failed'){d.slowWarning=true;ui.departureStatus('첫 전장 준비가 오래 걸리고 있습니다 · 기다리거나 기지로 돌아갈 수 있습니다');}
   if(qaDepartureHoldMs&&performance.now()-d.gate.started<qaDepartureHoldMs){prev=performance.now();return;}
   if(['shaders','textures'].includes(d.state)&&d.textures){const slice=warmTextureSlice(renderer,d.textures,d.textureIndex);d.textureIndex=slice.index;if(d.textureIndex===d.textures.length&&!d.texturesMarked){d.texturesMarked=true;d.gate.mark('textures-ready');if(d.shadersReady){d.state='buffers';ui.departureStatus('함선과 전장 화면을 마지막으로 점검하고 있습니다');}}}
   if(d.state==='buffers'){d.drawIndex=warmDrawSlice(renderer,d.warmView,camera,d.bufferObjects,d.drawIndex,d.warmTarget,64);if(d.drawIndex===d.bufferObjects.length){d.state='upload';d.gate.mark('buffers-ready');d.warmTarget.dispose();d.warmTarget=null;}}
   if(!['upload','present'].includes(d.state)){prev=performance.now();return;}
   }catch(error){d.state='failed';d.gate.mark('preparation-error',{message:String(error.message||error)});ui.departureStatus('화면 준비에 실패했습니다 · 기지로 돌아가 다시 출격해주세요');prev=performance.now();return;}
  }
  if(growthPreparation){const d=growthPreparation;d.sample(sim);try{if(performance.now()-d.attemptStarted>20000&&!['failed','present'].includes(d.state)){d.fail(new Error('Growth preparation timed out'));ui.growthStatus('준비가 오래 걸립니다. 다시 준비하거나 일시정지로 이동하세요',true);}
   if(d.state==='assets'){const assets=assetDiagnostics();if(assets.loading===0&&assets.queued===0){const textures=visibleTextures(visibleCompileRoot(scene,camera).objects);d.assetsReady(textures,{failed:assets.failed,textures:textures.length});}}
   if(d.state==='textures'){d.textureIndex=warmTextureSlice(renderer,d.textures,d.textureIndex).index;if(d.textureIndex===d.textures.length)d.texturesReady();}
   if(d.state==='render'&&qaProfileMode==='no-render'){profiler.end(rawDt*1000,sim.time,sim.phase,sim.level);return;}
   if(!['render','present'].includes(d.state)){profiler.end(rawDt*1000,sim.time,sim.phase,sim.level);return;}
  }catch(error){d.fail(error);ui.growthStatus('함선을 준비하지 못했습니다. 다시 준비하거나 일시정지로 이동하세요',true);profiler.end(rawDt*1000,sim.time,sim.phase,sim.level);return;}}
  profiler.mark('preparation');bloom.strength=(.65+combatFeedback.energy)/(1+(playerModel.userData.growth?.score||0)*.013);renderer.info.reset();profiler.beginGPU();try{if(qaProfileMode!=='no-render'){if(quality==='high'&&qaProfileMode!=='direct-render')renderBattlefield();else{lastRenderScene=qaNativeRender?scene:renderIndex.prepare(camera,renderer);renderer.render(lastRenderScene,camera);}}}catch(error){if(!growthPreparation)throw error;growthPreparation.fail(error);ui.growthStatus('화면을 준비하지 못했습니다. 다시 준비하거나 일시정지로 이동하세요',true);profiler.endGPU();profiler.mark('render');profiler.end(rawDt*1000,sim.time,sim.phase,sim.level);return;}profiler.endGPU();profiler.mark('render');if(growthPreparation&&(growthPreparation.rendered()||growthPreparation.state==='present'))presentGrowth(growthPreparation);if(qaSubmissionRequested){qaSubmissionRequested=false;qaSubmissionReport=renderSubmissionReport(renderer,lastRenderScene);}if(departure&&departure.state==='upload'){const d=departure;d.renders++;d.gate.mark('warm-frame-'+d.renders,{renderMs:profiler.current.render});d.compilation?.dispose();if(d.renders>=2){d.state='hud';ui.update({...sim.snapshot(),fps,cameraZoom:44/orbitView.distance});ui.departureStatus('스킬 표시와 입력 화면을 준비하고 있습니다');ui.battleHUDReady().then(()=>{if(departure!==d)return;d.gate.mark('hud-ready');d.state='present';requestAnimationFrame(()=>{if(departure!==d)return;if(document.hidden||graphicsLost){d.state='upload';d.renders=1;return;}d.gate.mark('field-presented');d.gate.release(sim);lastDeparture=d.gate.metrics;d.warmTarget?.dispose();departure=null;keys.clear();tapUntil.clear();prev=performance.now();ui.hideModal();});});}}
  fpsFrames++;fpsTime+=rawDt;if(fpsTime>.65){fps=Math.round(fpsFrames/fpsTime);fpsFrames=0;fpsTime=0;if(playing)lowestFPS=Math.min(lowestFPS,fps);drawCalls=renderer.info.render.calls;}
  profiler.current.launchRendered=qaProfileMode!=='no-render'&&missileLaunchCamera.update(sim.time,inGame&&sim.phase==='playing')===true;profiler.mark('launchCamera');presentationStamp?.draw(now);
  hudElapsed+=wallDt;let hudSnapshot=null;if(inGame&&hudElapsed>=.05){hudElapsed=0;hudSnapshot={...sim.snapshot(),priorityAdvice,fps,cameraZoom:44/orbitView.distance};}profiler.mark('hudSnapshot');if(hudSnapshot)ui.update(hudSnapshot);profiler.mark('hud');profiler.current.radar=hudSnapshot?ui.timings.radar:0;profiler.current.hudDOM=Math.max(0,profiler.current.hud-profiler.current.radar);profiler.end(rawDt*1000,sim.time,sim.phase,sim.level);
}

const initial=sim.phase;abandonTo('menu');ui.showMenu(sim.meta);ui.setSound(sound);
if(!storageAvailable)ui.toast('저장 데이터를 읽을 수 없어 새 기록으로 시작합니다.','warning');
camera.position.set(21,18,26);camera.lookAt(0,0,0);
const qaFrameClock=new URLSearchParams(location.search);const adaptiveFrameClock=qaFrameClock.get('qa')==='1'&&qaFrameClock.get('qaLegacyClock')==='1'?null:createFrameScheduler(frame);
if(adaptiveFrameClock){adaptiveFrameClock.start();window.addEventListener('pagehide',()=>adaptiveFrameClock.stop());window.addEventListener('pageshow',()=>adaptiveFrameClock.start());}else {const nativeFrame=now=>{requestAnimationFrame(nativeFrame);frame(now);};requestAnimationFrame(nativeFrame);}
const assetQA=new URLSearchParams(location.search).has('qa')?document.body.appendChild(Object.assign(document.createElement('output'),{id:'asset-qa-status'})):null;if(assetQA){assetQA.hidden=true;setInterval(()=>{assetQA.textContent=JSON.stringify({assets:assetDiagnostics(),fps,drawCalls,phase:sim.phase});},1000);}
window.__VOID_ARK__={growthHistory:()=>structuredClone(growthHistory),baseWarmup:()=>baseWarmup?{state:baseWarmup.state,textures:baseWarmup.textures?.length||0,uploaded:baseWarmup.index,buffers:baseWarmup.drawIndex}:null,departure:()=>structuredClone(departure?.gate.metrics||lastDeparture),snapshot:()=>sim.snapshot(),profileCapture:()=>profiler.captureResult(),diagnostics:()=>({nebula:nebulaBake.diagnostics(),receivedImpact:combatFeedback.diagnostics(),renderIndex:{...renderIndex.stats},factionMarkers:{...factionMarkerBatch.stats},growthPreparation:{current:growthPreparation?{state:growthPreparation.state,...structuredClone(growthPreparation.metrics)}:null,last:lastGrowthPreparation?structuredClone(lastGrowthPreparation):null,resumeNeeded:growthResumeNeeded},endingTransition:lastEndingTransition?structuredClone(lastEndingTransition):null,endingPreparation:endingPreparation?.diagnostics()||null,outputSurface:{...stableOutput.diagnostics(),canvasWidth:canvas.width,canvasHeight:canvas.height,pixelRatio:renderer.getPixelRatio()},hudArt:ui.skillArtDiagnostics(),departureCompilation:departure?.compilation?.diagnostics()||null,hostileShaders:sortieShaderWarmup?.diagnostics()||null,transientShaders:sortieTransientWarmup?.diagnostics()||null,presentationStamp:presentationStamp?.diagnostics()||null,scheduler:adaptiveFrameClock?.diagnostics()||null,preparation:ui.timings.preparation,context:renderer.getContext().getContextAttributes(),assets:assetDiagnostics(),effectAtlas:{ready:effects.atlas.preparationResources().ready,textures:effects.atlas.preparationResources().textures.length,failed:effects.atlas.preparationResources().failed},playerAsset:playerModel.userData.hullAssetId||null,bossSections:[...enemies.values()].map(o=>o.userData.meshyBossSections||0).filter(Boolean),camera:{yaw:orbitView.yaw,pitch:orbitView.pitch,distance:orbitView.distance,manual:orbitView.manual,dragging:!!orbitView.drag},fps,lowestFPS,drawCalls,triangles:renderer.info.render.triangles,profile:profiler.last,renderScale:combatResolution.scale,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,engineFlames:{...engineFlameBatch.stats},shipLOD:[...enemies.values(),...fleetModels.values(),...allies.values()].map(o=>o.userData.factionIdentity?.lod?.diagnostics()).filter(Boolean),assetBatches:assetInstanceBatch.stats,launchCamera:missileLaunchCamera.diagnostics(),healthBars:healthBarBatch.diagnostics(),projectileTrails:{live:projectileVisuals.mesh.count,capacity:projectileVisuals.capacity},models:{enemies:enemies.size,shots:shots.size,pickups:pickups.size},storageAvailable,audio:audio.enabled,audioState:audio.context?.state||'locked',soundAssets:audio.diagnostics()}),meta:()=>structuredClone(sim.meta)};
// Instrumentation is opt-in; the normal game exposes only read-only diagnostics.
function inspectBatchIntegration(){
 const instance=new THREE.Matrix4(),world=new THREE.Matrix4();let checked=0,mismatches=0,maxRelativeError=0;const examples=[];
 for(const group of assetInstanceBatch.groups.values())for(const entry of group.visible){
  group.mesh.getMatrixAt(entry.slot,instance);world.multiplyMatrices(group.mesh.matrixWorld,instance);let error=0;
  for(let i=0;i<16;i++)error=Math.max(error,Math.abs(world.elements[i]-entry.object.matrixWorld.elements[i])/Math.max(1,Math.abs(entry.object.matrixWorld.elements[i])));
  checked++;maxRelativeError=Math.max(maxRelativeError,error);if(error>1e-5){mismatches++;if(examples.length<3)examples.push({name:entry.object.name,error});}
 }
 const factions={enemy:0,ally:0,boss:0},markers={total:0,visible:0},modules=[];scene.traverse(o=>{const faction=o.userData.factionIdentity?.faction;if(faction){factions[faction]++;const marker=o.userData.factionIdentity.marker;if(marker){markers.total++;if(marker.visible)markers.visible++;}}});
 playerModel.traverse(o=>{if(o.userData.meshy&&o.name.startsWith('meshy:'))modules.push({id:o.name.slice(6),position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray()});});
 return {staticGeometry:staticGeometryDiagnostics(),primaryCameraRestored:assetInstanceBatch.camera===camera,engineCameraRestored:engineFlameBatch.camera===camera,instances:{checked,mismatches,maxRelativeError,examples},factions,markers,player:{position:playerModel.position.toArray(),rotation:playerModel.rotation.toArray(),modules},viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),targetIsDefault:renderer.getRenderTarget()===null,audit:assetInstanceBatch.audit()};
}
if(new URLSearchParams(location.search).get('qa')==='1')window.__VOID_QA__={projectileGlowDiagnostics:()=>projectileVisuals.glowPool?.diagnostics(),projectileGlowPixelProbe:()=>{if(sim.phase==='playing')throw Error('Pause before readback');return compareProjectileGlowPixels({roots:[...shots.values()],scene,camera,renderer,draw:renderBattlefield,refresh:()=>{assetInstanceBatch.update(0,camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},pool:projectileVisuals.glowPool});},sim,audio,healthbarMode(enabled){healthBarBatch.setEnabled(enabled);healthBarBatch.update(camera,{worldMatricesFresh:true});return healthBarBatch.diagnostics();},healthbarFixtureProbe(){if(sim.phase==='playing'||combatResolution.scale!==1)throw new Error('Pause at native resolution');const fixtures=[],green=new THREE.MeshBasicMaterial({color:0x82ffd3,depthTest:false});try{for(let i=0;i<16;i++){const root=new THREE.Group(),bar=makeHealthBar();root.position.set((i%4-1.5)*.8,(Math.floor(i/4)-1.5)*.48,-18-(i%3)*.04).applyMatrix4(camera.matrixWorld);root.quaternion.copy(camera.quaternion);root.scale.set(.7+(i%3)*.13,1+(i%2)*.22,1);bar.rotation.z=(i%3-1)*.08;bar.userData.fill.scale.x=4*(.15+(i%5)*.17);if(i%2){bar.userData.fill.material=green;bar.userData.fill.position.x=-(4-bar.userData.fill.scale.x)/2;}root.add(bar);root.userData.healthbar=bar;const release=healthBarBatch.register(root,bar);fixtures.push({root,release});scene.add(root);}return {fixtureBars:fixtures.length,...compareHealthBarBatchRendering({scene,camera,batch:healthBarBatch,renderer,render(){renderer.info.reset();renderBattlefield();},refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});}})};}finally{for(const {root,release} of fixtures){scene.remove(root);release();}green.dispose();assetInstanceBatch.update(performance.now(),camera);healthBarBatch.update(camera,{worldMatricesFresh:true});}},healthbarPixelProbe(){if(sim.phase==='playing'||combatResolution.scale!==1)throw new Error('Pause at native resolution');return compareHealthBarBatchRendering({scene,camera,batch:healthBarBatch,renderer,render(){renderer.info.reset();renderBattlefield();return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});}});},batchIntegrationCheck:inspectBatchIntegration,outputFramebufferPixelProbe(){if(sim.phase==='playing'||combatResolution.scale!==1)throw new Error('Pause at native resolution');const gl=renderer.getContext(),width=canvas.width,height=canvas.height,a=new Uint8Array(width*height*4),b=new Uint8Array(a.length);try{stableOutput.setNativeDirect(false);assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});renderBattlefield();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);renderer.readRenderTargetPixels(stableOutput.target,0,0,width,height,b);let sum=0,max=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d*d;max=Math.max(max,d);if(d)changed++;}return {width,height,canvasSamples:gl.getParameter(gl.SAMPLES),rmsRGBA:Math.sqrt(sum/a.length),maxChannelDifference:max,changedChannels:changed};}finally{stableOutput.setNativeDirect(true);}},prepareNebula,nativeSkyMode(cached){return nebulaBake.setEnabled(cached);},async nebulaResolution(resolution){if(sim.phase==='playing'||![512,1024].includes(resolution))throw new Error('Pause and choose 512/1024');nebulaBake.dispose();nebulaBake=createBakedNebula(renderer,nebulaDome,{resolution});nebulaBake.setEnabled(true);return prepareNebula();},nebulaPixelProbe(){if(sim.phase==='playing')throw new Error('Pause before pixel readback');const position=camera.position.clone(),rotation=camera.quaternion.clone(),rows=[];try{for(const [name,pitch,yaw] of [['current',null,null],['east',0,Math.PI/2],['west',0,-Math.PI/2],['north',0,Math.PI],['zenith',1.1,.4],['nadir',-1.1,-.8]]){if(pitch!==null)camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));camera.updateMatrixWorld();rows.push({name,...compareRenderScenePixels({renderer,draw:renderBattlefield,refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},setIndexed(enabled){nebulaBake.setEnabled(enabled);},canvas})});}return {resolution:nebulaBake.diagnostics().resolution,rows};}finally{camera.position.copy(position);camera.quaternion.copy(rotation);camera.updateMatrixWorld();assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});}},async nebulaGPUCostProbe(){if(sim.phase==='playing')throw new Error('Pause before GPU probe');const freeze=qaCameraFreeze;qaCameraFreeze={position:camera.position.clone(),quaternion:camera.quaternion.clone()};const was=!!profiler.ext;profiler.setGPUProfiling(false);try{return await compareGPUVariants({renderer,variants:[{label:'procedural-sky',set(){nebulaBake.setEnabled(false);}},{label:'cached-sky',set(){nebulaBake.setEnabled(true);}}],draw:renderBattlefield,refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},restore(){nebulaBake.setEnabled(true);}});}finally{qaCameraFreeze=freeze;profiler.setGPUProfiling(was);}},nativeOutputMode(enabled){stableOutput.setNativeDirect(enabled);},nativeOutputPixelProbe(){if(sim.phase==='playing')throw new Error('Pause before pixel readback');return compareRenderScenePixels({renderer,draw:renderBattlefield,refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},setIndexed(enabled){stableOutput.setNativeDirect(enabled);},canvas});},async outputGPUCostProbe(){if(sim.phase==='playing')throw new Error('Pause before GPU probe');const freeze=qaCameraFreeze;qaCameraFreeze={position:camera.position.clone(),quaternion:camera.quaternion.clone()};const was=!!profiler.ext;profiler.setGPUProfiling(false);try{return await compareGPUVariants({renderer,variants:[{label:'RGBA8+copy',set(){stableOutput.setNativeDirect(false);}},{label:'native-output',set(){stableOutput.setNativeDirect(true);}}],draw:renderBattlefield,refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},restore(){stableOutput.setNativeDirect(true);}});}finally{qaCameraFreeze=freeze;profiler.setGPUProfiling(was);}},markerPixelProbe(){if(sim.phase==='playing')throw new Error('Pause before pixel readback');return compareRenderScenePixels({renderer,draw:renderBattlefield,refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},setIndexed(enabled){factionMarkerBatch.setEnabled(enabled);},canvas});},renderScenePixelProbe(){if(sim.phase==='playing')throw new Error('Pause before pixel readback');return compareRenderScenePixels({renderer,draw:renderBattlefield,refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},setIndexed(enabled){qaNativeRender=!enabled;},canvas});},effectBatchPixelProbe(){if(sim.phase==='playing')throw new Error('Pause before pixel readback');return compareEffectBatchRendering({effects,renderer,draw:renderBattlefield,refresh(){assetInstanceBatch.update(performance.now(),camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});},time:gameTime,camera,height:innerHeight,canvas});},fixedCamera(){qaCameraFreeze={position:camera.position.clone(),quaternion:camera.quaternion.clone()};},markerTextureCostProbe(){factionMarkerBatch.setEnabled(false);factionMarkerBatch.update(camera,{worldMatricesFresh:true});try{return compareFactionMarkerTextures(scene,()=>{renderer.info.reset();renderBattlefield();return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries};});}finally{factionMarkerBatch.setEnabled(true);factionMarkerBatch.update(camera,{worldMatricesFresh:true});}},async fleetSceneCosts(cases){const original={fleet:sim.fleet,shots:sim.shots,hazards:sim.hazards},rows=[];try{for(const c of cases){sim.fleet=c.fleet;sim.shots=c.shots;sim.hazards=c.hazards||original.hazards;updateVisuals(0,sim.time);await Promise.resolve();await Promise.resolve();assetInstanceBatch.update(performance.now()+10000,camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});const result=compareEffectCosts(scene,camera,effects,c.events,()=>{assetInstanceBatch.update(performance.now()+10000,camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});renderer.info.reset();renderBattlefield();return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},3);rows.push({label:c.label,ships:c.fleet.length,shots:c.shots.length,events:c.events.length,result,batch:assetInstanceBatch.audit()});}}finally{sim.fleet=original.fleet;sim.shots=original.shots;sim.hazards=original.hazards;updateVisuals(0,sim.time);await Promise.resolve();assetInstanceBatch.update(performance.now()+10000,camera);engineFlameBatch.update(camera);factionMarkerBatch.update(camera,{worldMatricesFresh:true});}return rows;},compareEffectCosts(events){const before=JSON.stringify({meta:sim.meta,hp:sim.enemies.map(e=>[e.id,e.hp])});const result=compareEffectCosts(scene,camera,effects,events,()=>{renderer.info.reset();renderBattlefield();return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});return {...result,simulationUnchanged:before===JSON.stringify({meta:sim.meta,hp:sim.enemies.map(e=>[e.id,e.hp])}),batch:assetInstanceBatch.audit()};},setPriorityModelVisible(visible){const id=carrierPriorityGuide.data?.id;const model=enemies.get(id);if(model)model.visible=visible;return !!model;},priorityCostProbe(){
 const state=JSON.stringify({meta:sim.meta,hp:sim.enemies.map(e=>[e.id,e.hp])});const draws=[],pairs=[];
 for(let batch=0;batch<4;batch++){const values=[];for(const active of (batch%2?[true,false]:[false,true])){const t=performance.now();for(let i=0;i<1000;i++)carrierPriorityGuide.update(sim,camera,enemies,innerWidth,innerHeight,100000+batch*20000+i*16.67,active);values.push({active,ms:(performance.now()-t)/1000});}pairs.push(values);}
 for(const active of [false,true]){carrierPriorityGuide.update(sim,camera,enemies,innerWidth,innerHeight,performance.now()+1000000,active);renderer.info.reset();renderBattlefield();draws.push({active,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});}
 carrierPriorityGuide.lastScan=-Infinity;return {pairs,draws,diagnostics:carrierPriorityGuide.diagnostics(),unchanged:state===JSON.stringify({meta:sim.meta,hp:sim.enemies.map(e=>[e.id,e.hp])})};
 },priorityDiagnostics(){return carrierPriorityGuide.diagnostics();},effectDiagnostics(){return {meshItems:effects.items.length,liveBeams:effects.beamField.slots.reduce((n,p)=>n+(p.life>0?1:0),0),liveAtlas:effects.atlas.slots.reduce((n,p)=>n+(p.life>0?1:0),0),liveParticles:effects.particles.reduce((n,p)=>n+(p.life>0?1:0),0),liveChunks:effects.chunks.reduce((n,p)=>n+(p.life>0?1:0),0)};},showDebrief(){ui.showEnd(sim.result,sim.meta);},setDepartureDelay(ms){qaDepartureHoldMs=Math.max(0,Math.min(60000,Number(ms)||0));},previewRendererDiagnostics,sandboxSession(meta={}){departure?.compilation?.dispose();departure?.warmTarget?.dispose();departure=null;qaNoSave=true;abandonTo('menu');sim.meta=cleanMeta(meta);sim.reset();ui.showMenu(sim.meta);},compareHiddenMatrices(){return compareHiddenMatrices(scene);},auditBatches(){return assetInstanceBatch.audit();},probeMatrices(){return probeWorldMatrices(scene);},compareMatrices(){return compareMatrixCache(scene);},launchPreview(x,y){missileLaunchCamera.clear();camera.updateMatrixWorld();const origin=new THREE.Vector3(x,y,-35).applyMatrix4(camera.matrixWorld);sim.shot(origin,null,1,'enemyMissile',false);},gpuProfiling(enabled){profiler.setGPUProfiling(enabled);},beginProfile(){profiler.beginCapture();},endProfile(){return profiler.endCapture();},resolutionBudget(slowFPS){qaFixedResolution=false;combatResolution.setBudget(slowFPS);combatResolution.scale=1;applyCombatResolution();},fixedResolution(){qaFixedResolution=true;combatResolution.scale=1;applyCombatResolution();},loseGraphics(){const ext=renderer.getContext().getExtension('WEBGL_lose_context');ext.loseContext();setTimeout(()=>ext.restoreContext(),1200);},requestSubmissionReport(){qaSubmissionRequested=true;},submissionReport(){return qaSubmissionReport;},profileMode(mode){qaProfileMode=mode;},clockPacing(before){adaptiveFrameClock?.setPacing(before);},clockPoll(ms){adaptiveFrameClock?.setPollMs(ms);},setInput(input){qaInput=input;},choose(id){return choosePreparedUpgrade(id);},advance(seconds,input={}){for(let t=0;t<seconds;t+=.05){if(sim.phase==='upgrade')sim.chooseUpgrade(sim.choices[0].id);sim.step(.05,input);sim.drainEvents();}ui.hideModal();},start};













































