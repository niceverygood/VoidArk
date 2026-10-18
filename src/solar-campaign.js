import {applyPlanetEnemy} from './planet-enemies.js';
import {civilizationCaptain} from './civilization-captains.js';
import {campaignFleetConfiguration} from './campaign-commanders.js';
import {selectEnemyReinforcementRole} from './enemy-reinforcements.js';
import {SortieRecord} from './sortie-record.js';
import {JupiterRecord} from './jupiter-record.js';
import {CAMPAIGN_TUNING_LIMIT} from './campaign-growth.js';
import {configureAndromedaBoss,BOSS_DOCTRINES} from './andromeda-boss.js';
import {configureSolarBoss,solarBossGuide} from './solar-boss.js';
import {ANDROMEDA_STAGES} from './andromeda-campaign.js';
import {prepareCampaignShip,persistCampaignShip} from './space-bases.js';
export const SOLAR_STAGES=Object.freeze([
 ['mercury','수성',0xbba28c,'태양 근접 방어선',3],['venus','금성',0xdab176,'폭풍 구름 봉쇄',3],
 ['mars','화성',0xc46843,'붉은 궤도 요새',4],['jupiter','목성',0xcbb08a,'대적점 항모 전단',4],
 ['saturn','토성',0xddc38b,'고리 방어 함대',5],['uranus','천왕성',0x80d6dc,'빙결 전초 기지',5],
 ['neptune','해왕성',0x447ddd,'심해색 중력 전선',6],['pluto','명왕성',0xb8a69b,'태양계 최후의 관문',6]
].map(([id,name,color,title,bases],index)=>({id,name,color,title,bases,index,kills:18+index*4,reward:200+index*100,extent:{x:600,y:240,z:600}})));
export const CAMPAIGN_STAGES=Object.freeze([...SOLAR_STAGES,...ANDROMEDA_STAGES]);
export function cleanCampaign(value={}) {
 const cleared=Number.isFinite(value?.cleared)?Math.max(0,Math.min(8,Math.floor(value.cleared))):0;
 const andromedaCleared=cleared===8&&Number.isFinite(value?.andromedaCleared)?Math.max(0,Math.min(9,Math.floor(value.andromedaCleared))):0;
 return {cleared,systemOwned:cleared===8,andromedaCleared,andromedaOwned:andromedaCleared===9};
}
export function constrainArena(entity,extent) {
 let touched=false;
 for(const axis of ['x','y','z'])if(Math.abs(entity.position[axis])>extent[axis]) {
   const sign=Math.sign(entity.position[axis]);entity.position[axis]=sign*extent[axis];
   if(entity.velocity?.[axis]*sign>0)entity.velocity[axis]=0;touched=true;
 }
 return touched;
}
export const ARENA_GRACE=5;
export const ARENA_DRAIN=24;
export function arenaBoundary(position,extent) {
 const target=Object.fromEntries(['x','y','z'].map(a=>[a,Math.max(-extent[a]+20,Math.min(extent[a]-20,position[a]))]));
 const distance=Math.hypot(...['x','y','z'].map(a=>Math.max(0,Math.abs(position[a])-extent[a])));
 return {outside:distance>0,distance,target};
}
export function updateArenaBoundary(sim,dt) {
 const state=sim.campaign,p=sim.player,b=arenaBoundary(p.position,CAMPAIGN_STAGES[state.index].extent);
 const previous=state.outsideTime||0;
 state.outsideTime=b.outside?previous+dt:0;
 if(b.outside&&!previous)sim.emit('announce',{title:'전장 이탈 · 즉시 복귀하세요',sub:'5초 복귀 유예 후 실드 에너지 소모 · 실드 소진 시 선체 손상'});
 if(!b.outside&&previous)sim.emit('announce',{title:'전장 복귀 완료',sub:'경계 에너지 소모 중지 · 작전을 계속하세요.'});
 const draining=Math.max(0,state.outsideTime-ARENA_GRACE)-Math.max(0,previous-ARENA_GRACE);
 if(b.outside&&draining>0){
  const amount=ARENA_DRAIN*draining,shielded=Math.min(p.shield,amount);
  sim.sortieRecorder?.damage(Math.min(p.hp,amount-shielded),shielded,'boundary');p.shield-=shielded;p.hp=Math.max(0,p.hp-(amount-shielded));p.lastDamage=sim.time;
  if(p.hp<=0)sim.finish(false);
 }
}
export function beginSolarStage(sim,index=cleanCampaign(sim.meta.campaign).cleared) {
 if(!Number.isInteger(index)||index<0||index>=8||index>cleanCampaign(sim.meta.campaign).cleared)return false;
 return beginCampaignStage(sim,index);
}
export function beginAndromedaStage(sim,index=cleanCampaign(sim.meta.campaign).andromedaCleared) {
 const progress=cleanCampaign(sim.meta.campaign);
 if(!progress.systemOwned||!Number.isInteger(index)||index<0||index>=9||index>progress.andromedaCleared)return false;
 return beginCampaignStage(sim,index+8);
}
function beginCampaignStage(sim,index) {
 persistCampaignShip(sim);delete sim.preparedCampaignTarget;sim.meta.campaign=cleanCampaign(sim.meta.campaign);sim.reset();sim.mode='campaign';sim.phase='playing';sim.campaign={index,chapter:index>=8?'andromeda':'solar',phase:'blockade',baseKills:0,combatKills:0,bossRank:null,spawnTimer:1,outsideTime:0};
 sim.sortieRecorder=new SortieRecord(index);sim.battleRecorder=index===3?new JupiterRecord():null;delete sim.preferredInvestment;delete sim.preparationReport;delete sim.preferredDebriefEquipment;prepareCampaignShip(sim);const stage=CAMPAIGN_STAGES[index];sim.galaxyId=stage.chapter==='andromeda'?'andromeda':'milky';sim.nextTitan=Infinity;sim.cosmicTimer=Infinity;
 // Each campaign sortie starts from Earth with existing permanent ship research.
 for(let i=0;i<(stage.chapter==='andromeda'?4:3);i++)spawnGroup(sim,stage);
 for(let i=0;i<7;i++)sim.pickups.push({id:sim.nextId++,position:{x:(i-3)*3,y:0,z:-12-i*4},xp:1,scrap:1,life:100});
 sim.emit('start');sim.emit('warp',{position:{...sim.player.position},name:(stage.chapter==='andromeda'?'태양 관문 → 안드로메다':sim.meta.spaceBase?.active==='sun'?'태양 기지':'지구')+' → '+stage.name});
 sim.emit('announce',{title:(stage.chapter==='andromeda'?'ANDROMEDA ':'STAGE ')+((stage.localIndex??index)+1)+' / '+stage.name+' 침공',sub:stage.title+' · 봉쇄 함대 '+stage.kills+'척 → 궤도 요새 → 중간보스 → 총독'});return true;
}
function spawnGroup(sim,stage) {
 // Reuse the existing full-3D carrier/escort AI, with stage-specific combat scaling.
 const proxy={id:'planet-'+stage.index,index:stage.index,level:1+stage.index,name:stage.name,campaignFleet:stage.chapter==='andromeda'};
 const fleet=campaignFleetConfiguration(stage,civilizationCaptain(proxy,sim.war.owners[proxy.id]));
 const leader=sim.spawnEnemyFleet(proxy,fleet);if(!leader)return;
 if(stage.chapter==='andromeda'){leader.name=stage.system.faction+' 항모';leader.speed=stage.system.id==='crown'?10:7;}
 const group=sim.enemies.filter(e=>e===leader||e.leaderId===leader.id);
 for(const e of group){applyPlanetEnemy(e,stage);e.campaignUnit=true;if(stage.chapter==='andromeda'){e.captain=leader.captain;if(e.fleetRole==='flagship'||e.fleetRole==='guard')e.armor=stage.armor;e.enemyAppearance.color=leader.captain.color;}e.damage*=.62+stage.index*.055;e.hp*=.75+stage.index*.05;e.maxHp=e.hp;constrainArena(e,stage.extent);}
}
function spawnBases(sim,stage) {
 for(let i=0;i<stage.bases;i++) {
  const angle=i*Math.PI*2/stage.bases;
  const e=sim.spawn('planetBase',{x:Math.cos(angle)*145,y:(i%3-1)*32,z:Math.sin(angle)*145},false,true);
  Object.assign(e,{armor:stage.armor||e.armor,campaignBase:true,hp:150+stage.index*45,maxHp:150+stage.index*45,radius:7,damage:7+stage.index,name:stage.name+' 궤도 요새 '+(i+1)});
 }
 for(const e of sim.enemies.filter(e=>e.campaignBase))applyPlanetEnemy(e,stage);
 sim.emit('announce',{title:'봉쇄 돌파 · 궤도 요새 공격',sub:'금빛 항로를 따라 '+stage.bases+'개 요새를 파괴하세요.'});
}
export function campaignCommanderStats(stage,rank='governor'){
 const mid=rank==='warden',hp=((mid?520:950)+stage.index*(mid?170:290))*(stage.bossScale||1);
 return {armor:stage.armor||'heavy',hp,maxHp:hp,damage:mid?11+stage.index:15+stage.index*1.4,radius:mid?10:15,speed:mid?7:5};
}
function spawnCommander(sim,stage,rank) {
 const e=sim.spawn('boss',{x:sim.player.position.x+65,y:sim.player.position.y+18,z:sim.player.position.z-70},false,true),mid=rank==='warden';
 Object.assign(e,{...campaignCommanderStats(stage,rank),campaignBoss:rank,name:mid?(stage.warden||stage.name+' 방어 사령관'):(stage.governor||stage.name+' 행성 총독'),cooldown:2});
 if(stage.chapter==='andromeda')configureAndromedaBoss(e,stage);else configureSolarBoss(e,stage);
 applyPlanetEnemy(e,stage);
 sim.sortieRecorder?.boss(e);constrainArena(e,stage.extent);sim.emit('boss',{enemy:e});
 sim.emit('announce',{title:e.name+' 출현',sub:stage.chapter==='andromeda'?BOSS_DOCTRINES[stage.system.id].counter+' · 공격 후 코어 노출에 집중 사격':solarBossGuide(e)+' · '+(mid?'사령관 격파 후 요새 공략':'총독 격파 후 '+stage.name+' 표면 착륙')});
}
export function solarEnemyDefeated(sim,e) {
 const state=sim.campaign;if(!state||state.completed)return;
 if(e.campaignBase)state.baseKills++;
 else if(e.campaignBoss){state.bossRank=e.campaignBoss;state[e.campaignBoss+'Defeated']=true;}
 else state.combatKills++;
}
export function landingSite(stage){const radius=100+stage.index*4;return {x:0,y:-115+radius*.6,z:-265+radius*.8};}
export function campaignObjectiveProgress(sim){
 const s=sim.campaign,stage=CAMPAIGN_STAGES[s?.index];
 if(sim.mode!=='campaign'||!s||!stage)return null;
 return {index:s.index,phase:s.phase,combatKills:s.combatKills,combatRequired:stage.kills,baseKills:s.baseKills,basesRequired:stage.bases,wardenDefeated:s.wardenDefeated===true,crownDefeated:s.crownDefeated===true,landed:s.completed===true};
}
export function updateSolarCampaign(sim,dt) {
 const state=sim.campaign,stage=CAMPAIGN_STAGES[state.index];
 updateArenaBoundary(sim,dt);if(sim.phase!=='playing')return;
 for(const e of sim.enemies)constrainArena(e,stage.extent);
 // Level encounters can arrive before the fortress objective, but never skip it.
 if(sim.level>=3&&!state.levelWarning){state.levelWarning=true;sim.emit('announce',{title:'LV.4 중간보스 접근',sub:'다음 강화부터 방어 사령관이 전장에 합류합니다.'});}
 if(sim.level>=4&&!state.wardenSpawned&&!sim.enemies.some(e=>e.hp>0&&e.kind==='boss')){state.wardenSpawned=true;spawnCommander(sim,stage,'warden');}
 if(sim.level>=7&&!state.finalWarning){state.finalWarning=true;sim.emit('announce',{title:'LV.8 최종보스 접근',sub:'방어 사령관을 격파하면 행성 총독이 출전합니다.'});}
 if(sim.level>=8&&state.wardenDefeated&&!state.crownSpawned&&!sim.enemies.some(e=>e.hp>0&&e.kind==='boss')){state.crownSpawned=true;spawnCommander(sim,stage,'crown');}
 if(state.phase==='blockade'&&state.combatKills>=stage.kills){state.phase='bases';spawnBases(sim,stage);}
 if(state.phase==='bases'&&state.baseKills>=stage.bases){state.phase='warden';if(!state.wardenSpawned){state.wardenSpawned=true;spawnCommander(sim,stage,'warden');}}
 if(state.phase==='warden'&&state.wardenDefeated){state.phase='governor';if(!state.crownSpawned){state.crownSpawned=true;spawnCommander(sim,stage,'crown');}}
 if(state.phase==='governor'&&state.crownDefeated){state.phase='landing';state.landing=landingSite(stage);sim.enemies=[];sim.shots=[];sim.hazards=[];sim.emit('announce',{title:stage.name+' 진입 항로 확보',sub:'행성 표면의 착륙 지점까지 이동하세요 · 점령 완료 후 엔딩 재생'});}
 if(state.phase==='landing'&&Math.hypot(sim.player.position.x-state.landing.x,sim.player.position.y-state.landing.y,sim.player.position.z-state.landing.z)<=12) {
  state.completed=true;const remote=state.chapter==='andromeda',progress=cleanCampaign(sim.meta.campaign),first=remote?progress.andromedaCleared===stage.localIndex:progress.cleared===state.index;
  if(first){sim.meta.campaign=cleanCampaign({...progress,...(remote?{andromedaCleared:stage.localIndex+1}:{cleared:state.index+1})});sim.meta.bank+=stage.reward;}
  sim.finish(true);sim.result.banked+=first?stage.reward:0;sim.result.campaign={planet:stage.name,index:state.index,chapter:state.chapter,reward:first?stage.reward:0,complete:remote?sim.meta.campaign.andromedaOwned:sim.meta.campaign.systemOwned};return;
 }
 if(state.phase==='landing')return;
 state.spawnTimer-=dt;
 const cap=stage.chapter==='andromeda'?48+Math.floor(stage.localIndex/3)*4:30+Math.min(stage.index*2,14),alive=sim.enemies.filter(e=>e.hp>0&&!e.campaignBase&&!e.campaignBoss).length;
 if(state.spawnTimer<=0&&alive<cap){const leader=sim.enemies.find(e=>e.hp>0&&e.fleetRole==='flagship'&&e.fleetPlan!=='retreat'&&sim.enemies.filter(a=>a.hp>0&&a.leaderId===e.id).length<8);if(leader){const escort=sim.spawnEnemyOfficer(leader,selectEnemyReinforcementRole(leader,sim.enemies),sim.nextId,1+stage.index*.09);if(escort){applyPlanetEnemy(escort,stage);escort.campaignUnit=true;escort.damage*=.62+stage.index*.055;}}else spawnGroup(sim,stage);state.spawnTimer=1.2;}
}
export function solarSnapshot(sim) {
 const s=sim.campaign;if(sim.mode!=='campaign'||!s)return null;
 const stage=CAMPAIGN_STAGES[s.index];
 const candidates=sim.enemies.filter(e=>e.hp>0&&(s.phase==='bases'?e.campaignBase:e.campaignBoss));
 candidates.sort((a,b)=>Math.hypot(a.position.x-sim.player.position.x,a.position.y-sim.player.position.y,a.position.z-sim.player.position.z)-Math.hypot(b.position.x-sim.player.position.x,b.position.y-sim.player.position.y,b.position.z-sim.player.position.z));
 const objective=s.phase==='landing'?'행성 표면 착륙 지점으로 이동':s.phase==='blockade'?'봉쇄 함대 '+Math.min(s.combatKills,stage.kills)+' / '+stage.kills+'척 격파':s.phase==='bases'?'궤도 요새 '+s.baseKills+' / '+stage.bases+' 파괴':s.phase==='warden'?'방어 사령관 격파':'행성 총독 격파';
 const b=arenaBoundary(sim.player.position,stage.extent);
 return {...stage,tuningEarned:s.tuningEarned||0,tuningLimit:CAMPAIGN_TUNING_LIMIT,chapter:s.chapter,galaxyName:s.chapter==='andromeda'?'안드로메다 은하':'우리 은하',systemName:stage.system?.name||'태양계',boundary:{...b,grace:Math.max(0,ARENA_GRACE-(s.outsideTime||0)),draining:b.outside&&(s.outsideTime||0)>ARENA_GRACE},phase:s.phase,objective,landing:s.landing?{...s.landing,distance:Math.hypot(s.landing.x-sim.player.position.x,s.landing.y-sim.player.position.y,s.landing.z-sim.player.position.z)}:null,target:s.phase==='landing'?{position:{...s.landing},name:stage.name+' 착륙 지점'}:candidates[0]?{position:{...candidates[0].position},name:candidates[0].name}:null,cleared:sim.meta.campaign.cleared,edge:Math.min(...['x','y','z'].map(a=>stage.extent[a]-Math.abs(sim.player.position[a])))};
}
