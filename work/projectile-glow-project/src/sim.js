import {inheritPlanetEnemy,planetCarrierIdentity} from './planet-enemies.js';
import {ShotCollisionGrid} from './shot-collision-grid.js';
import {distanceMayBeInside} from './distance-candidates.js';
import {cleanSortieRecord} from './sortie-record.js';
import {SHIELD_RECOVERY_DELAY,shieldRecoveryRate} from './shield-balance.js';
import {bossDamageFactor,bossStatus,updateAndromedaBoss} from './andromeda-boss.js';
import {solarBossStatus,updateSolarBoss} from './solar-boss.js';
import {tuningAvailable} from './campaign-growth.js';
import {permanentEquipmentCost,supportedServiceCosts,campaignFleetRepairUnits} from './campaign-economy.js';
import {TUNING_DEFS} from './upgrade-tuning.js';
import {cleanSpaceBase,cleanCampaignShip,openCampaignBase,buildSolar,buildCapital,selectCapital,buildFleetShip,refitFleetShip,persistCampaignShip} from './space-bases.js';
import {cleanCampaign,beginSolarStage,beginAndromedaStage,updateSolarCampaign,solarEnemyDefeated,solarSnapshot,constrainArena,CAMPAIGN_STAGES,campaignObjectiveProgress} from './solar-campaign.js';
import {moveEnemy, arriveEnemy} from './enemy-motion.js';
import {formationPosition, fleetDestination, updateFleetPlan} from './enemy-formation.js';
import {spawnPoliticalBattles,updatePoliticalShip} from './political-battles.js';
import {civilizationCaptain} from './civilization-captains.js';
import {cleanEconomy,trade,useItem,mine,updateMining} from './economy.js';
import {ensureHeadquarters,designateHeadquarters,requestDefense,updateRecall,recallSnapshot} from './defense-recall.js';
import {cleanDefenses,buildDefense,updateDefenses,defenseProtection} from './defenses.js';
import {updateCosmic} from './cosmic.js';
import {configureTitan,updateTitan,titanReward} from './titan.js';
import {approachPosition,encounterPressure,nextLevelXp} from './encounters.js';
import {damageMultiplier,shipArmor,fleetArmor,enemyArmor,planetArmor} from './combat-relations.js';
import {captainFor,ENEMY_OFFICERS,CAPTAIN_ATTRIBUTES} from './enemy-captains.js';
import {cleanFleetUpgrades,fleetConfiguration,fleetConfigurationKey,fleetUpgradeCost,FLEET_UPGRADES} from './fleet-upgrades.js';
import {FLEET_TIERS,FLEET_ROLES,FLEET_ROSTER,FLEET_COMMANDS,fleetRankFor,fleetFormation} from './fleet.js';
import {LINK_WINDOW,SKILL_STYLE,skillLearned,nextLinks,resolveLink} from './skill-links.js';
import {GALAXIES,galaxyDefinition,cleanDiscoveries} from './galaxies.js';
import {TerritoryWar, initialOwner} from './territory-war.js';
import {SHIP_FAMILIES, shipDefinition, shipStats} from './ships.js';
import {commanderDefinition} from './commanders.js';
import {REGIONS, regionFor} from './universe.js';
import { PLANETS, basesDestroyed, planetBases, cleanConquest, occupied, galaxyProgress } from './galaxy.js';
import { shipGrowth, hullDisplayName } from './ship-growth.js';
import { forward, tailPosition, tailTarget } from './dogfight.js';
import { cleanBase, baseStats, constructionCost, constructionLock } from './base-tech.js';
import { cleanTree, treeStats } from './skill-tree.js';
import { SECTOR_DEFS, sectorDefinition, enemyPool } from './sectors.js';
// Deterministic game simulation; no renderer, DOM or audio required.
export const DURATION = 360;
export const STAGES = ['스카우트 · 정찰선', '바스티온 · 전투함', '아크 · 우주 모함'];
export const SECTORS = SECTOR_DEFS.map(s=>s.name);
export const v = (x=0,y=0,z=0) => ({x,y,z});
export const copy = p => v(p.x,p.y,p.z);
export const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export const BASE_POSITION = Object.freeze({x:0,y:0,z:0});
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const addScaled = (a,b,s) => {a.x+=b.x*s;a.y+=b.y*s;a.z+=b.z*s;};
const norm = a => {const l=Math.hypot(a.x,a.y,a.z)||1;return v(a.x/l,a.y/l,a.z/l);};
const towards = (a,b) => norm(v(b.x-a.x,b.y-a.y,b.z-a.z));
const shotCollisionGrids=new WeakMap();
// Avoid square roots for broad collision checks; preserve the old rounded boundary.
const withinShotRadius = (x,y,z,radius) => {
  if(radius<=0)return false;
  const distanceSquared=x*x+y*y+z*z,radiusSquared=radius*radius;
  if(Math.abs(distanceSquared-radiusSquared)>Number.EPSILON*Math.max(distanceSquared,radiusSquared)*8)return distanceSquared<radiusSquared;
  return Math.hypot(x,y,z)<radius;
};
export function rng(seed=1489) {let a=seed>>>0;return () => {a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}

export const UPGRADE_DEFS = [
  {id:'cannon',name:'레일 기관포',description:'발사 속도와 관통 화력 증가. 3단계부터 두 발을 동시에 발사합니다.',maxLevel:5,icon:'cannon',color:'#75eaff',tag:'주 무장'},
  {id:'chain',name:'아크 방전기',description:'청백색 번개가 적 함선 사이를 뛰어넘으며 연쇄 피해를 줍니다.',maxLevel:5,icon:'chain',color:'#c795ff',tag:'연쇄 · 자동'},
  {id:'missile',name:'군집 유도탄',description:'장갑을 추적하는 유도탄을 발사합니다. 폭발은 주변 적도 파괴합니다.',maxLevel:5,icon:'missile',color:'#ffbb68',tag:'폭발 · 자동'},
  {id:'laser',name:'프리즘 관통포',description:'굵은 에너지 광선으로 일직선의 적 함대를 관통합니다.',maxLevel:5,icon:'laser',color:'#76ffcf',tag:'관통 · 자동'},
  {id:'fighter',name:'요격기 격납고',description:'호위 전투기가 출격해 주변 적을 독립적으로 공격합니다.',maxLevel:4,icon:'fighter',color:'#83c4ff',tag:'함대 · 자동'},
  {id:'armor',name:'세라믹 적층 장갑',description:'최대 선체 내구도 +35. 현재 내구도도 35 회복합니다.',maxLevel:5,icon:'armor',color:'#e1e7dd',tag:'생존'},
  {id:'shield',name:'재생 방어막',description:'최대 방어막 +25. 피격 후 재충전 속도가 증가합니다.',maxLevel:5,icon:'shield',color:'#58dcff',tag:'생존'},
  {id:'magnet',name:'잔해 회수장',description:'회수 반경 +8m, 이동 속도 +7%. 멀리 떨어진 잔해까지 끌어옵니다.',maxLevel:4,icon:'magnet',color:'#ffd67a',tag:'회수 · 기동'},
  {id:'reactor',name:'공명 반응로',description:'모든 무장 피해 +12%, 액티브 스킬 재사용 시간 -6%.',maxLevel:4,icon:'reactor',color:'#ff91bb',tag:'화력 · 스킬'},
];
export const LEVEL_UPGRADE_DEFS=[...UPGRADE_DEFS,...TUNING_DEFS];
export const SKILL_DEFS = [
  {id:'pulse',name:'전자기 펄스',key:'1',cooldown:12,icon:'pulse'},
  {id:'barrage',name:'유도탄 폭우',key:'2',cooldown:20,icon:'missile'},
  {id:'overcharge',name:'코어 과충전',key:'3',cooldown:28,icon:'reactor'},
  {id:'nova',name:'플라즈마 신성',key:'4',cooldown:24,icon:'pulse'},
  {id:'stasis',name:'시간 구속장',key:'5',cooldown:26,icon:'shield'},
  {id:'repair',name:'긴급 재구성',key:'6',cooldown:32,icon:'hull'},
  {id:'lance',name:'성간 관통 창',key:'7',cooldown:22,icon:'laser'},
  {id:'countermeasure',name:'유도탄 교란',key:'8',cooldown:18,icon:'shield'},
  {id:'sentry',name:'긴급 호위대',key:'9',cooldown:36,icon:'fighter'},
];
const ENEMIES = {
  planetBase:{hp:400,speed:0,radius:7,damage:16,xp:8},
  swarm:{hp:28,speed:9,radius:1.35,damage:7,xp:1},
  interceptor:{hp:52,speed:13,radius:1.7,damage:11,xp:2},
  sniper:{hp:70,speed:5.4,radius:2.1,damage:16,xp:2},
  gravity:{hp:105,speed:5,radius:2.8,damage:10,xp:3},
  carrier:{hp:215,speed:4,radius:4.2,damage:13,xp:5},
  boss:{hp:2400,speed:4.5,radius:8.5,damage:24,xp:35},
};

export function cleanMeta(input) {
  const m=input&&typeof input==='object'?input:{};
  const legacy=m.conquest&&!m.conquestVersion;const conquest=cleanConquest(m.conquest);if(legacy)for(const p of PLANETS)if(basesDestroyed(conquest,p)===p.baseCount)conquest[p.id].push('crown','warden');
  const int=(n,max=1e8)=>Number.isFinite(n)?clamp(Math.floor(n),0,max):0;
  return {...(cleanSortieRecord(m.lastSortie)?{lastSortie:cleanSortieRecord(m.lastSortie)}:{}),...(m.spaceBase?{spaceBase:cleanSpaceBase(m.spaceBase)}:{}),...(m.campaignShip?{campaignShip:cleanCampaignShip(m.campaignShip)}:{}),...(m.campaign?{campaign:cleanCampaign(m.campaign)}:{}),economy:cleanEconomy(m),...(PLANETS.some(p=>p.id===m.headquarters)?{headquarters:m.headquarters}:{}),...(m.defenses?{defenses:cleanDefenses(m.defenses)}:{}),...(m.fleetUpgrades?{fleetUpgrades:cleanFleetUpgrades(m.fleetUpgrades)}:{}),fleetRank:int(m.fleetRank,5),discoveries:cleanDiscoveries(m.discoveries),...(m.war?{war:new TerritoryWar(m.war,m.conquest).snapshot()}:{}),...(m.ship?{ship:shipDefinition(m.ship).id}:{}),...(m.conquest?{conquest,conquestVersion:2}:{}),...(m.base?{base:cleanBase(m.base)}:{}),...(m.tree?{tree:cleanTree(m.tree)}:{}),bank:int(m.bank),bestKills:int(m.bestKills),wins:int(m.wins),runs:int(m.runs),sector:clamp(int(m.sector,3)||1,1,3),research:{hull:int(m.research?.hull,5),reactor:int(m.research?.reactor,5),salvage:int(m.research?.salvage,5)}};
}
export function buyResearch(meta,id) {
  if(!['hull','reactor','salvage'].includes(id))return false;
  const base={hull:70,reactor:90,salvage:60}[id];
  if(!base||meta.research[id]>=5)return false;
  const cost=base*(meta.research[id]+1)**2;
  if(meta.bank<cost)return false;
  meta.bank-=cost;meta.research[id]++;return true;
}

export class Simulation {
  constructor(meta={},seed=19071) {
    this.meta=cleanMeta(meta);this.seed=seed;this.random=rng(seed);this.events=[];this.nextId=1;this.phase='menu';this.reset();this.phase='menu';
  }
  openMarket(){if(!['menu','playing','base','paused'].includes(this.phase))return false;this.marketPrevious=this.phase;this.phase='market';return true;}
  closeMarket(){if(this.phase!=='market')return false;this.phase=this.marketPrevious||'menu';return true;}
  tradeItem(id,operation){return trade(this,id,operation);}
  useItem(id){const used=useItem(this,id);if(used&&this.phase==='base'&&this.campaignDock)persistCampaignShip(this);return used;}
  mine(){return mine(this);}
  bankMinerals(){if(this.phase!=='base'||this.scrap<=0)return false;this.meta.bank+=this.scrap;this.scrap=0;this.emit('economySave');return true;}
  emit(type,data={}) {if(type==='territorySave'&&this.mode==='galaxy'&&!this.sharedWar)this.meta.war=this.war.snapshot();this.events.push({type,...data});}
  drainEvents() {const out=this.events;this.events=[];return out;}
  reset() {
    this.war=new TerritoryWar(this.meta.war,this.meta.conquest);this.actor='player';this.sharedWar=false;this.vessel=shipStats(this.meta.ship);this.mode='survival';this.campaign=null;this.campaignDock=null;this.solar=null;this.galaxyId='milky';this.warpCooldown=0;this.incomeTimer=30;this.tech=treeStats(this.meta.tree);this.infrastructure=baseStats(this.meta.base);
    this.cosmicRandom=rng(this.seed+901);this.cosmicTimer=48+this.cosmicRandom()*18;this.cosmicIndex=0;this.time=0;this.kills=0;this.scrap=0;this.level=1;this.xp=0;this.xpNeed=7;this.stage=0;this.pendingLevels=0;
    this.minerals=[];this.mineralGalaxy=null;this.mineReady=0;this.marketPrevious=null;this.defenseRecall=null;this.recalledRaids={};this.defenses=[];this.defenseState={};this.defenseWarTimers={};this.approachIndex=0;this.interceptorIndex=0;this.enemies=[];this.shots=[];this.pickups=[];this.hazards=[];this.allies=[];this.fleet=[];this.fleetCommand='guard';this.enemyFleetVisits={};this.politicalVisits=new Set();this.choices=[];
    this.sortieRecorder=null;this.battleRecorder=null;this.nextTitan=180;this.titanCount=0;this.titanForewarned=false;this.firstBoss=false;this.finalBoss=false;this.finalDefeated=false;this.spawnTimer=.15;this.patrolTimer=18;this.fever=false;this.feverAnnounced=false;this.lastFighterShot=0;this.result=null;
    this.upgrades=Object.fromEntries(LEVEL_UPGRADE_DEFS.map(d=>[d.id,d.id==='cannon'?1:0]));
    if(this.vessel.weapon!=='cannon')this.upgrades[this.vessel.weapon]=1;
    this.weaponTimers={cannon:0,chain:1.7,missile:1.4,laser:1.4};this.skillTimers=Object.fromEntries(SKILL_DEFS.map(s=>[s.id,0]));this.skillDurations={};this.lastSkill=null;this.linkChain=0;this.linkNotice=null;this.comboGuard=0;
    this.player={position:v(),velocity:v(),heading:0,hp:this.vessel.hull+this.meta.research.hull*20,maxHp:this.vessel.hull+this.meta.research.hull*20,shield:this.vessel.shield,maxShield:this.vessel.shield,boost:100,boostMax:100,hit:0,lastDamage:-10,overcharge:0,radius:2.1};
    this.player.maxHp+=this.tech.hull+this.infrastructure.hull;this.player.hp=this.player.maxHp;this.player.maxShield+=this.tech.shield+this.infrastructure.shield;this.player.shield=this.player.maxShield;
    this.syncAllies();this.syncFleet();this.evadeTimer=0;this.evadeCooldown=0;this.evadeDirection=v();this.boosting=false;this.nextHint=0;this.events=[];
  }
  openCampaignBase(location){return openCampaignBase(this,location);}
  buildSolar(id){return buildSolar(this,id);}
  buildCapital(id){return buildCapital(this,id);}
  selectCapital(id){return selectCapital(this,id);}
  refitFleetShip(slot,role){return refitFleetShip(this,slot,role);}
  buildFleetShip(role){return buildFleetShip(this,role);}
  startExpedition(index){return beginAndromedaStage(this,index);}
  startCampaign(index){return beginSolarStage(this,index);}
  start(mode='survival') {
    if(mode==='campaign')return this.startCampaign();
    this.reset();this.mode=mode==='galaxy'?'galaxy':'survival';this.random=rng(this.seed+this.meta.runs*17);this.phase='playing';this.emit('start');
    this.emit('announce',{title:'SECTOR 0'+this.meta.sector+' / '+SECTORS[this.meta.sector-1],sub:sectorDefinition(this.meta.sector).tactic});
    if(this.mode==='galaxy'){const origins=PLANETS.filter(p=>p.galaxy===this.galaxyId&&this.war.owners[p.id]!==this.actor);for(const p of origins.slice(0,2))this.spawnEnemyFleet(p);}else for(let i=0;i<7;i++){const a=i*Math.PI*2/7;this.spawn('swarm',v(Math.sin(a)*38,(i%3-1)*7,Math.cos(a)*38));}
    // A small salvage trail rewards moving immediately and teaches collection.
    for(let i=0;i<5;i++)this.pickups.push({id:this.nextId++,position:v((i-2)*3,0,-7-i*4),xp:1,scrap:1,life:100});
  }
  setPaused(value=true) {
    if(value&&this.phase==='playing'){this.phase='paused';return true;}
    if(!value&&this.phase==='paused'){this.phase='playing';return true;}return false;
  }
  spawn(kind,position,bossFinal=false,quiet=false) {
    const def=ENEMIES[kind]||ENEMIES.swarm;
    if(!position)position=approachPosition(this.player,this.approachIndex++,this.random,this.mode);
    const pressure=encounterPressure(this.mode==='galaxy'?Math.min(this.time,180):this.time,this.meta.sector);const difficulty=pressure.hp;
    const hp=def.hp*difficulty*(bossFinal?1.6:1);
    const e={id:this.nextId++,kind,interceptRole:kind==='interceptor'?(this.interceptorIndex++%3===0?'tail':'flank'):null,armor:enemyArmor(kind),heading:Math.atan2(position.x-this.player.position.x,position.z-this.player.position.z),tailLock:0,tailCooldown:0,position:copy(position),velocity:v(),hp,maxHp:hp,radius:def.radius,speed:def.speed*pressure.speed,damage:def.damage*pressure.damage,xp:def.xp,age:0,cooldown:1.2+this.random()*2,contact:0,stun:0,hit:0,warning:0,target:null,side:this.random()<.5?-1:1,final:bossFinal,phase:0};
    this.enemies.push(e);
    if(kind==='boss'&&!quiet){configureTitan(e,bossFinal);e.name=bossFinal?'종말 거함 · 오블리비언':'거인 전함 · 레비아탄';this.emit('boss',{enemy:e});this.emit('announce',{title:e.name,sub:bossFinal?'최종 교전 — 장갑을 파괴하고 코어를 무너뜨리세요.':'거대 개체 접근 — 전자기 펄스로 탄막을 지우고 빈틈을 노리세요.'});}
    return e;
  }
  spawnEnemyFleet(planet,{captain=null,officerFactor=null}={}){
    if(!planet||this.enemies.length>64||this.enemies.filter(e=>e.enemyFleet&&!e.politicalWarId&&e.fleetRole==='flagship'&&e.hp>0&&e.fleetPlan!=='retreat').length>=(planet.campaignFleet?4:this.level>=8?4:3))return null;
    const c=captain||civilizationCaptain(planet,this.war.owners[planet.id]),pos=approachPosition(this.player,this.approachIndex++,this.random,this.mode),leader=this.spawn('carrier',pos),factor=1+Math.min(planet.level,30)*.07;
    Object.assign(leader,{fleetPlan:'approach',planAge:0,ingress:towards(this.player.position,pos),enemyFleet:true,armor:c.tactic==='restore'?'bio':shipArmor(shipDefinition(c.ship)),fleetRole:'flagship',captain:c,planetId:planet.id,name:c.name+' · '+c.title,hp:260*c.hp*factor,maxHp:260*c.hp*factor,radius:7,speed:c.tactic==='assault'?10:7,damage:10*factor,launchTimer:12,sorties:2,appearanceKey:'enemy-'+c.id,enemyAppearance:{ship:c.ship,stage:2,scale:.85,gear:{fighter:3,cannon:2,shield:2},color:c.color}});
    this.battleRecorder?.carrier(leader,this.time);c.roles.forEach((role,i)=>this.spawnEnemyOfficer(leader,role,i,typeof officerFactor==='function'?officerFactor(i,factor):officerFactor??factor));this.emit('enemyFleet',{position:copy(pos),captain:c,planet:planet.name});return leader;
  }
  spawnEnemyOfficer(leader,role,slot,factor=1){if(this.enemies.length>=72)return null;const d=ENEMY_OFFICERS[role],e=this.spawn(d.kind,formationPosition(leader,role,slot,this.player));Object.assign(e,{enemyFleet:true,armor:fleetArmor(role),fleetRole:role,leaderId:leader.id,captain:leader.captain,planetId:leader.planetId,slot,name:leader.captain.name+' / '+d.name,hp:d.hp*factor,maxHp:d.hp*factor,speed:d.speed,damage:d.damage*factor,radius:role==='guard'?3.5:2.8,appearanceKey:'enemy-'+leader.captain.id+'-'+role,enemyAppearance:{ship:d.ship,stage:1,scale:.55,gear:d.gear,color:leader.captain.color}});inheritPlanetEnemy(e,leader);this.battleRecorder?.officer(e);return e;}
  updateEnemyFleetShip(e,dt){
    const p=this.player,c=e.captain,leader=e.fleetRole==='flagship'?e:this.enemies.find(a=>a.id===e.leaderId&&a.hp>0),d=dist(e.position,p.position);let destination;
    if(e.fleetRole==='flagship'){
      updateFleetPlan(e,this.enemies,p,dt);
      e.launchTimer-=dt;
      if(e.fleetPlan==='engage'&&e.launchTimer<=0&&e.sorties>0&&this.enemies.filter(a=>a.leaderId===e.id&&a.hp>0).length<10){e.launchTimer=12;e.sorties--;this.spawnEnemyOfficer(e,'striker',this.nextId);this.emit('launch',{position:copy(e.position)});}
      if(c.tactic==='restore')e.hp=Math.min(e.maxHp,e.hp+dt*2);
    }
    if(leader){
      destination=fleetDestination(e,leader,p);
      if(e.fleetRole==='support')for(const a of this.enemies)if(a.hp>0&&(a.id===leader.id||a.leaderId===leader.id)&&dist(e.position,a.position)<65){const prior=a.hp;a.hp=Math.min(a.maxHp,a.hp+dt*(c.tactic==='restore'?5:3));this.battleRecorder?.heal(a.hp-prior);}
    }else{
      if(!e.orphaned){e.orphaned=true;e.damage*=.65;e.speed*=.8;}
      const replacement=this.enemies.find(a=>a.hp>0&&!a.politicalWarId&&a.fleetRole==='flagship'&&a.captain.id===c.id&&dist(a.position,e.position)<160);
      if(replacement){e.leaderId=replacement.id;destination=formationPosition(replacement,e.fleetRole,e.slot,p);}
      else{const away=towards(p.position,e.position);destination=v(e.position.x+away.x*80,e.position.y+away.y*80,e.position.z+away.z*80);if(d>240)e.hp=0;}
    }
    arriveEnemy(e,destination,dt);
    if(leader&&leader.fleetPlan==='engage'&&d<110&&e.cooldown<=0){
      if(e.fleetRole==='gunner'&&!e.fleetAim){e.fleetAim=copy(p.position);e.cooldown=.7;this.emit('warning',{position:copy(e.position),target:copy(p.position),life:.7});}
      else {e.cooldown=e.fleetRole==='flagship'?c.fire:e.fleetRole==='gunner'?3.5:e.fleetRole==='striker'?4:4.5;
        if(e.fleetRole==='flagship'&&c.tactic==='disrupt')this.addHazard(copy(p.position),9);
        else {const missile=e.fleetRole==='striker'||(e.fleetRole==='flagship'&&c.tactic==='hunter'),aim=towards(e.position,e.fleetAim||p.position);this.shot(e.position,null,e.damage,missile?'enemyMissile':'enemy',false,aim);if(e.fleetRole==='flagship'&&c.tactic==='mirror')for(const side of [-1,1])this.shot(e.position,null,e.damage*.7,'enemy',false,norm(v(aim.x+side*.2,aim.y,aim.z)));if(missile)this.emit('missileAlert',{position:copy(e.position)});}
        e.fleetAim=null;
      }
    }
    if(d<p.radius+e.radius&&e.contact<=0){e.contact=1.2;this.damagePlayer(e.damage,'contact',e.position);}
  }
  nearest(position,range=90,exclude=null) {
    let nearest=null,best=range;
    for(const e of this.enemies){if(e.hp<=0||exclude?.has(e.id))continue;const dx=position.x-e.position.x,dy=position.y-e.position.y,dz=position.z-e.position.z;if(!distanceMayBeInside(dx,dy,dz,best))continue;const d=Math.hypot(dx,dy,dz);if(d<best){nearest=e;best=d;}}
    return nearest;
  }
  power() {return 1+this.upgrades.reactor*.12+this.tech.power+this.infrastructure.power+(this.solar?.power||0);}
  shot(position,target,damage,type='cannon',friendly=true,direction=null) {
    if(this.shots.length>220)return;
    const dir=direction||towards(position,target?.position||this.player.position);
    const s={id:this.nextId++,position:copy(position),previous:copy(position),velocity:v(),direction:dir,target:target?.id,damage,type,weapon:type==='enemyMissile'?'missile':type==='enemy'?'cannon':type,friendly,life:type==='missile'?5:3.5,speed:type==='missile'?32:(friendly?95:38),radius:type==='missile'?1.4:.8,age:0,pierce:friendly&&type==='cannon'?(this.upgrades.cannonPierce||0):0,hitIds:new Set()};
    if(friendly){s.damage*=1+(type===this.vessel.weapon?this.vessel.bonus:0);s.speed*=1+this.tech.shotSpeed;}addScaled(s.velocity,dir,s.speed);this.shots.push(s);this.emit('shot',{shot:s});return s;
  }
  damageEnemy(e,amount,source='cannon',impact=null) {
    if(e.hp<=0)return;const recordHp=e.hp,recordGuard=e.tactics?.guard||0;let critical=false;const matchup=e.kind==='rival'?1:damageMultiplier(source,e.armor||enemyArmor(e.kind));amount*=matchup;
    if(e.enemyFleet){const affinity=CAPTAIN_ATTRIBUTES[e.captain.tactic];if(source===affinity.resist)amount*=.8;if(source===affinity.weak)amount*=1.25;}
    const guarded=e.enemyFleet&&e.fleetRole==='flagship'&&this.enemies.some(a=>a.hp>0&&a.leaderId===e.id&&a.fleetRole==='guard'&&dist(a.position,e.position)<22);if(guarded)amount*=.75;
    if(e.titan&&e.exposed>0)amount*=1.8;
    if(e.kind==='boss')amount*=1+this.vessel.bossDamage;
    if(['boss','planetBase'].includes(e.kind))amount*=1+this.tech.bossPower;
    if(['cannon','chain','missile','laser','lance'].includes(source)&&this.tech.critChance>0&&this.random()<this.tech.critChance){critical=true;amount*=1.5+this.tech.critPower;}
    if(['chain','laser'].includes(source)&&source===this.vessel.weapon)amount*=1+this.vessel.bonus;
    if(['cannon','missile','laser'].includes(source)&&tailTarget(this.player,[e]))amount*=1.3+this.tech.tailPower;
    if(['cannon','chain','missile','laser','fighter'].includes(source))amount*=1+(this.tech[source]||0);amount*=bossDamageFactor(this,e,amount,source);if(e.kind==='rival'){const result=this.pvpHit?.(e.remoteId,amount,source);if(result&&result.damage>0)this.emit('hit',{position:copy(impact||e.position),damage:result.damage,kind:e.kind,source,enemyId:e.id,radius:e.radius,critical,killed:result.killed});return;}e.hp-=amount;e.hit=.14;if(e.enemyFleet){this.battleRecorder?.hit(e,guarded);if(e.hp<=0)this.battleRecorder?.kill(e,this.time,this.enemies);}
    if(e.hp<=0&&e.enemyFleet&&e.fleetRole==='flagship')this.emit('fleetDisrupted',{position:copy(e.position),name:e.captain.name});
    this.emit('hit',{position:copy(impact||e.position),damage:amount,matchup,armor:e.armor,kind:e.kind,source,enemyId:e.id,radius:e.radius,critical,killed:e.hp<=0});
    if(e.kind==='boss'&&e.campaignBoss)this.sortieRecorder?.hitBoss(e,recordHp,recordGuard);
    if(e.hp>0)return;
    this.player.hp=Math.min(this.player.maxHp,this.player.hp+this.tech.hullOnKill);if(this.time-this.player.lastDamage>3)this.player.shield=Math.min(this.player.maxShield,this.player.shield+this.tech.shieldOnKill*.5);
    if(e.warId){this.war.kill(e.warId);}
    if(this.mode==='campaign')solarEnemyDefeated(this,e);
    if(e.kind==='planetBase'&&!e.campaignBase)this.captureBase(e);
    if(e.commander){this.meta.conquest=cleanConquest(this.meta.conquest);this.meta.conquest[e.planetId].push(e.commander.rank);this.emit('territorySave');if(e.commander.rank==='crown')this.completePlanet(PLANETS.find(p=>p.id===e.planetId));}
    this.kills++;this.emit('explosion',{position:copy(e.position),size:e.kind==='boss'?15:e.radius*1.7,color:e.kind==='gravity'?'#a05dff':'#ffab4a',kind:e.kind});
    const scrap=Math.ceil((e.xp+1)*(1+this.meta.research.salvage*.1+this.tech.salvage+this.infrastructure.salvage+this.vessel.salvage));
    if(e.kind==='boss') {
      if(e.titan)titanReward(this,e);
      if(e.final&&!e.commander)this.finalDefeated=true;
      this.scrap+=scrap*4;this.xp+=e.xp;this.player.hp=Math.min(this.player.maxHp,this.player.hp+45);this.player.shield=this.player.maxShield;
      if(!e.titan)this.emit('announce',{title:(e.commander||e.campaignBoss)?e.name+' 격파':e.final?'최종 코어 붕괴':'레비아탄 격파',sub:(e.tactics||e.solarBoss)?'선체 +45 · 실드 충전 · '+(e.campaignBoss==='warden'?'요새 공략을 마치고 총독에게 진격하세요.':'남은 요새 공략 후 행성 표면 착륙 · 첫 점령 보상은 착륙 후 지급됩니다.'):e.final?'잔해 회수 완료. 귀환 항로를 확보했습니다.':'선체 수리 +45 · 방어막 완전 충전 · 대량의 연구 고철 회수'});
      // A massive reactor rupture sweeps its nearby escorts away.
      for(const other of this.enemies)if(other!==e&&other.hp>0&&dist(e.position,other.position)<25)this.damageEnemy(other,120,'reactor');
    } else this.pickups.push({id:this.nextId++,position:copy(e.position),xp:e.xp,scrap,life:100});
    if(this.pickups.length>150){const oldest=this.pickups.shift();this.collect(oldest);}
  }
  damagePlayer(amount,source='contact',origin=null,weapon=null) {
    const p=this.player;if(this.phase!=='playing'||this.comboGuard>0||this.evadeTimer>0||p.hit>.12)return;
    amount*=1-defenseProtection(this,p.position);amount*=damageMultiplier(weapon,shipArmor(this.vessel));amount*=Math.max(.5,1-this.tech.resist-this.vessel.resist);const hullBefore=p.hp;const shielded=Math.min(p.shield,amount);p.shield-=shielded;p.hp-=amount-shielded;p.hit=.28;p.lastDamage=this.time;this.battleRecorder?.damage(Math.min(hullBefore,Math.max(0,amount-shielded)),shielded);this.sortieRecorder?.damage(Math.min(hullBefore,Math.max(0,amount-shielded)),shielded,source);
    this.emit('damage',{amount,shielded,source,position:copy(p.position),origin:origin?copy(origin):null,shieldBreak:shielded>0&&p.shield<=0});
    if(p.hp<=0){p.hp=0;this.finish(false);}
  }
  collect(pickup) {
    if(!pickup||pickup.collected)return;pickup.collected=true;if(pickup.xp>=3)this.meta.economy.inventory.relay=Math.min(9999,this.meta.economy.inventory.relay+1);this.xp+=pickup.xp;this.scrap+=pickup.scrap;this.emit('pickup',{position:copy(pickup.position),xp:pickup.xp});
  }
  upgradeChoices() {
    const eligible=LEVEL_UPGRADE_DEFS.filter(d=>this.upgrades[d.id]<d.maxLevel&&(!d.requires||this.upgrades[d.requires]>0)&&(!d.tuning||tuningAvailable(this)));
    const priority=this.level===2?['chain','missile','laser']:this.level===3?['fighter','shield','cannon']:[];
    const picked=[];
    for(const id of priority){const d=eligible.find(d=>d.id===id);if(d)picked.push(d);}
    const pool=eligible.filter(d=>!picked.includes(d));
    if(!priority.length){for(const tuning of [false,true]){const category=pool.filter(d=>!!d.tuning===tuning);if(category.length){const d=category[Math.floor(this.random()*category.length)];picked.push(d);pool.splice(pool.indexOf(d),1);}}}
    while(picked.length<3&&pool.length){const i=Math.floor(this.random()*pool.length);picked.push(pool.splice(i,1)[0]);}
    return picked.map(d=>({...d,level:this.upgrades[d.id]+1}));
  }
  levelUp() {
    if(this.phase!=='playing'||this.xp<this.xpNeed)return;
    this.xp-=this.xpNeed;this.level++;this.xpNeed=nextLevelXp(this.level);
    this.phase='upgrade';this.choices=this.upgradeChoices();
    if(!this.choices.length){this.phase='playing';if(this.mode!=='campaign')this.player.hp=Math.min(this.player.maxHp,this.player.hp+25);return;}
    this.emit('levelup',{level:this.level,choices:this.choices});
  }
  chooseUpgrade(id) {
    if(this.phase!=='upgrade'||!this.choices.some(c=>c.id===id))return false;
    const def=LEVEL_UPGRADE_DEFS.find(d=>d.id===id);if(!def||this.upgrades[id]>=def.maxLevel||def.requires&&!this.upgrades[def.requires])return false;
    this.upgrades[id]++;if(def.tuning){this.tech[def.stat]=(this.tech[def.stat]||0)+def.value;if(this.mode==='campaign')this.campaign.tuningEarned=(this.campaign.tuningEarned||0)+1;}
    const p=this.player;
    if(id==='armor'){p.maxHp+=35;p.hp=Math.min(p.maxHp,p.hp+35);}
    if(id==='shield'){p.maxShield+=25;p.shield=p.maxShield;}
    if(id==='fighter'){this.syncAllies();}
    const stage=this.solar?.capital?2:this.level>=8?2:this.level>=4?1:0;
    if(stage!==this.stage){this.stage=stage;p.radius=2.1+stage*.9;p.maxHp+=30;p.hp=Math.min(p.maxHp,p.hp+50);p.maxShield+=15;p.shield=p.maxShield;this.emit('evolve',{stage});this.syncAllies();}
    this.phase='playing';this.choices=[];this.syncFleet();this.emit('upgrade',{id,level:this.upgrades[id]});if(def.tuning&&this.mode==='campaign'){persistCampaignShip(this);this.emit('territorySave');}return true;
  }
  dockBase() {
    if(this.mode==='campaign')return false;
    if(this.phase!=='playing'||dist(this.player.position,BASE_POSITION)>this.infrastructure.dockRange)return false;
    this.phase='base';this.player.velocity=v();this.boosting=false;this.emit('dock',{position:copy(this.player.position)});return true;
  }
  leaveBase() {if(this.phase!=='base')return false;if(this.campaignDock){persistCampaignShip(this);this.campaignDock=null;this.phase='menu';return true;}this.phase='playing';this.emit('departure',{position:copy(this.player.position)});return true;}
  baseServices() {
    const p=this.player;
    return supportedServiceCosts(this,{repair:Math.ceil((p.maxHp-p.hp)*.15*(1-this.infrastructure.repairDiscount)),shield:Math.ceil((p.maxShield-p.shield)*.1*(1-this.infrastructure.shieldDiscount)),maintenance:Math.ceil((8+campaignFleetRepairUnits(this))*(1-this.infrastructure.maintenanceDiscount))});
  }
  installEquipment(id) {return this.serviceBase(id,true);}
  serviceBase(id,equipment=false) {
    if(this.phase!=='base')return false;
    const p=this.player, costs=this.baseServices();
    if(!equipment&&Object.hasOwn(costs,id)) {
      const cost=costs[id];
      if(cost<=0||this.scrap+this.meta.bank<cost||(id==='maintenance'&&p.boost>=100&&Object.values(this.skillTimers).every(t=>t===0)&&this.fleet.every(a=>a.hp>=a.maxHp)))return false;
      const spend=Math.min(this.scrap,cost);this.scrap-=spend;this.meta.bank-=cost-spend;
      if(id==='repair')p.hp=p.maxHp;
      if(id==='shield')p.shield=p.maxShield;
      this.emit('service',{position:copy(p.position)});if(id==='maintenance'){for(const ship of this.fleet){ship.hp=ship.maxHp;ship.disabled=0;}p.boost=100;for(const key in this.skillTimers)this.skillTimers[key]=0;for(const key in this.weaponTimers)this.weaponTimers[key]=0;}
      persistCampaignShip(this);return true;
    }
    const def=UPGRADE_DEFS.find(d=>d.id===id);
    if(!def||this.upgrades[id]>=def.maxLevel)return false;
    const cost=this.equipmentCost(id);if(this.scrap+this.meta.bank<cost)return false;
    const spend=Math.min(this.scrap,cost);this.scrap-=spend;this.meta.bank-=cost-spend;this.phase='upgrade';this.choices=[def];this.chooseUpgrade(id);this.phase='base';if(this.campaignDock){const record=cleanCampaignShip(this.meta.campaignShip);record.gear[id]=this.upgrades[id];this.meta.campaignShip=record;this.stage=this.solar?.capital?2:0;persistCampaignShip(this);}return true;
  }
  evade(input={}) {
    if(this.phase!=='playing'||this.evadeCooldown>0||this.player.boost<this.vessel.evadeCost)return false;
    const p=this.player,f=forward(p.heading);this.evadeDirection=Math.hypot(input.x||0,input.y||0,input.z||0)>.1?norm(v(input.x||0,input.y||0,input.z||0)):v(-f.z,0,f.x);
    this.evadeTimer=this.evadeDuration=.6+this.tech.evadeDuration;this.evadeCooldown=this.vessel.evadeCooldown*(1-this.tech.evadeCooldown);p.boost-=this.vessel.evadeCost;
    for(const shot of this.shots)if(shot.type==='enemyMissile'&&dist(shot.position,p.position)<65)shot.trackingLost=true;
    for(const e of this.enemies)e.tailLock=0;
    this.emit('evade',{position:copy(p.position)});return true;
  }
  captureBase(enemy){
    if(!enemy.planetId)return;this.meta.conquest=cleanConquest(this.meta.conquest);this.meta.conquestVersion=2;
    const p=PLANETS.find(p=>p.id===enemy.planetId),list=this.meta.conquest[p.id];
    if(list.includes(enemy.baseIndex))return;list.push(enemy.baseIndex);
    this.scrap+=20+p.level*8;
    this.emit('territorySave');
  }
  completePlanet(p){
    if(occupied(this.meta.conquest,p)){this.war.claim(p.id,this.actor);this.emit('territorySave');const reward=80+p.level*30;this.meta.bank+=reward;this.emit('conquest',{planet:p.name,reward});const region=regionFor(p);if(PLANETS.filter(q=>q.region===p.region&&q.galaxy===p.galaxy).every(q=>occupied(this.meta.conquest,q))){const bonus=300+REGIONS.indexOf(region)*100;this.meta.bank+=bonus;this.emit('regionConquest',{region:region.name,reward:bonus});}}
  }
  updateCommander(e,dt){
    const enraged=e.hp<e.maxHp*.5;
    if(enraged&&!e.enraged){e.enraged=true;this.emit('announce',{title:e.name+' · 2단계 폭주',sub:'공격 간격 단축 · 고도를 바꾸고 R로 유도탄을 회피하세요'});}
    if(e.warning>0){e.warning-=dt;if(e.warning>0)return;e.phase++;
      const aim=towards(e.position,e.target),pattern=(e.commander.pattern+e.phase)%3;
      if(pattern===0){for(let j=-2;j<=2;j++){const a=j*.23,c=Math.cos(a),s=Math.sin(a);this.shot(e.position,null,e.damage,'boss',false,v(aim.x*c-aim.z*s,aim.y,aim.x*s+aim.z*c));}}
      if(pattern===1){for(let j=0;j<(enraged?3:2);j++){const shot=this.shot(v(e.position.x+(j-1)*3,e.position.y,e.position.z),null,e.damage*.8,'enemyMissile',false);if(shot){shot.speed=25;shot.life=6;shot.velocity=v(shot.direction.x*25,shot.direction.y*25,shot.direction.z*25);}}this.emit('missileAlert',{position:copy(e.position)});}
      if(pattern===2)this.addHazard(copy(e.target),enraged?11:8);
      if(e.phase%4===0)for(let j=0;j<2;j++)if(this.enemies.length<60)this.spawn('interceptor',v(e.position.x+j*5,e.position.y+6,e.position.z));
      this.emit('bossfire',{position:copy(e.position)});e.cooldown=enraged?1.5:2.6;
    }else if(e.cooldown<=0){e.target=copy(this.player.position);e.warning=enraged?.7:1.15;this.emit('warning',{enemy:e,position:copy(e.position),target:e.target,life:e.warning});}
  }
  designateHeadquarters(id){return designateHeadquarters(this,id);}
  requestDefense(id){return requestDefense(this,id);}
  openGalaxy(){if(this.phase!=='playing'||!['galaxy','campaign'].includes(this.mode))return false;this.phase='galaxyMap';return true;}
  closeGalaxy(){if(this.phase!=='galaxyMap')return false;this.phase='playing';return true;}
  warpPlanet(id){
    if(this.mode==='campaign')return false;
    if(this.defenseRecall||this.phase!=='galaxyMap'||this.warpCooldown>0||this.enemies.some(e=>e.commander&&e.hp>0&&dist(e.position,this.player.position)<120))return false;
    const p=id==='home'?null:PLANETS.find(p=>p.id===id);if(id!=='home'&&(!p||p.galaxy!==this.galaxyId))return false;
    if(id==='home')this.galaxyId='milky';
    const bases=p?planetBases(p):[],remaining=bases.find(b=>!this.meta.conquest?.[p.id]?.includes(b.index))||bases[0];
    this.player.position=p?v(remaining.position.x+36,remaining.position.y,remaining.position.z+36):v();
    this.player.velocity=v();this.enemies=[];this.shots=[];this.hazards=[];this.cosmicTimer=Math.max(12,this.cosmicTimer);this.pickups=[];this.warpCooldown=20*(1-this.tech.warpHaste);this.spawnTimer=0;this.phase='playing';
    for(const a of [...this.allies,...this.fleet])a.position=copy(this.player.position);
    this.emit('warp',{position:copy(this.player.position),name:p?.name||'방주 정비 기지'});if(p)this.emit('transmission',{captain:captainFor(p),planet:p.name});return true;
  }
  warpGalaxy(id){
    const destination=GALAXIES.find(g=>g.id===id),current=galaxyDefinition(this.galaxyId);
    if(this.defenseRecall||this.phase!=='galaxyMap'||this.mode!=='galaxy'||!destination||!current.links.includes(id)||this.warpCooldown>0||this.enemies.some(e=>e.commander&&e.hp>0&&dist(e.position,this.player.position)<120))return false;
    this.galaxyId=id;const entry=PLANETS.find(p=>p.galaxy===id&&p.index===0);this.player.position=v(entry.position.x+160,entry.position.y+25,entry.position.z);this.player.velocity=v();this.enemies=[];this.shots=[];this.pickups=[];this.hazards=[];this.cosmicTimer=Math.max(12,this.cosmicTimer);
    for(const a of [...this.allies,...this.fleet])a.position=copy(this.player.position);
    this.warpCooldown=45*(1-this.tech.warpHaste);this.spawnTimer=2;this.phase='playing';
    const first=!this.meta.discoveries.includes(id);if(first){this.meta.discoveries.push(id);this.meta.bank+=100*(destination.tier+1);}
    this.emit('territorySave');this.emit('warp',{position:copy(this.player.position),name:destination.name});
    this.emit('announce',{title:'은하 관문 통과 · '+destination.name,sub:first?'첫 발견 보상 '+100*(destination.tier+1)+' 고철 · G에서 현지 행성 선택':'원정 항로 재진입 · 함선과 점령 기록 유지'});return true;
  }
  launchRaid(id){if(this.phase!=='galaxyMap'||this.meta.bank<30||this.war.owners[id]===this.actor)return false;const target=PLANETS.find(p=>p.id===id);if(!target||target.galaxy!==this.galaxyId)return false;const source=PLANETS.find(p=>p.galaxy===target.galaxy&&this.war.owners[p.id]===this.actor);if(!source)return false;const raid=this.war.raid(source.id,id,this.actor,5+this.infrastructure.escorts);if(!raid)return false;this.meta.bank-=30;this.emit('territorySave');return true;}
  syncTerritory(){
    for(const p of PLANETS){if(occupied(this.meta.conquest,p)&&this.war.owners[p.id]!==this.actor)this.meta.conquest[p.id]=[];if(this.war.owners[p.id]===this.actor&&!occupied(this.meta.conquest,p)){this.meta.conquest??={};this.meta.conquest[p.id]=Array.from({length:p.baseCount},(_,i)=>i).concat('warden','crown');}}
    this.enemies=this.enemies.filter(e=>!e.planetId||this.war.owners[e.planetId]!==this.actor);
    if(!this.sharedWar)this.meta.war=this.war.snapshot();
    if(this.sharedWar)return;
    for(const event of this.war.events.splice(0)){this.emit(event.type,event);this.emit('territorySave');}
  }
  updateGalaxy(dt){
    ensureHeadquarters(this);
    if(!this.sharedWar)this.war.tick(dt);this.syncTerritory();spawnPoliticalBattles(this);
    for(const w of this.war.wars){const p=PLANETS.find(p=>p.id===w.target);if(w.defender!==this.actor||p.galaxy!==this.galaxyId||dist(p.position,this.player.position)>320)continue;const alive=this.enemies.filter(e=>e.warId===w.id&&e.hp>0).length;for(let i=alive;i<w.strength-w.kills;i++){const a=i*Math.PI*2/w.strength,e=this.spawn(i===0?'carrier':'interceptor',v(p.position.x+Math.cos(a)*65,p.position.y+10,p.position.z+Math.sin(a)*65));e.warId=w.id;e.name='침공 함대';e.hp=e.maxHp=e.hp*(1+p.level*.08);}}
    this.warpCooldown=Math.max(0,this.warpCooldown-dt);this.incomeTimer-=dt;
    if(this.incomeTimer<=0){this.incomeTimer=30;const income=Math.ceil(galaxyProgress(this.meta.conquest).reduce((n,p)=>n+p.level*2,0)*(1+this.tech.income));if(income){this.meta.bank+=income;this.emit('territorySave');}}
    for(const p of PLANETS){if(p.galaxy!==this.galaxyId||dist(p.position,this.player.position)>320||occupied(this.meta.conquest,p))continue;
      for(const b of planetBases(p)){if(this.meta.conquest?.[p.id]?.includes(b.index)||this.enemies.some(e=>e.planetId===p.id&&e.baseIndex===b.index))continue;
        const e=this.spawn('planetBase',b.position);e.planetId=p.id;e.armor=planetArmor(p);e.baseIndex=b.index;e.hp=e.maxHp=280+p.level*120;e.damage=10+p.level*2;e.name=p.name+' 방어 기지 '+(b.index+1);e.cooldown=1.8;
      }
      if(!this.enemyFleetVisits[p.id]&&this.enemies.length<60){const leader=this.spawnEnemyFleet(p);if(leader)this.enemyFleetVisits[p.id]=true;}
      const state=this.meta.conquest?.[p.id]||[],count=basesDestroyed(this.meta.conquest,p);
      const rank=!state.includes('warden')&&count>=Math.ceil(p.baseCount/2)?'warden':state.includes('warden')&&count===p.baseCount&&!state.includes('crown')?'crown':null;
      if(rank&&!this.enemies.some(e=>e.commander&&e.planetId===p.id&&e.hp>0)){
        const def=commanderDefinition(p,rank,this.war.owners[p.id]),e=this.spawn('boss',{x:p.position.x+30,y:p.position.y+12,z:p.position.z},false,true);e.commander=def;e.planetId=p.id;e.name=def.name;e.hp=e.maxHp=def.hp;e.damage=def.damage;e.radius=8.5*def.scale;e.speed=rank==='crown'?6:8;e.cooldown=2;e.xp=rank==='crown'?18:9;
        this.emit('boss',{enemy:e});this.emit('announce',{title:e.name,sub:def.personality.trait+' · '+def.quote});
      }
    }
    // Roaming patrols keep space active even outside planetary orbits.
    const hostile=PLANETS.filter(p=>p.galaxy===this.galaxyId&&this.war.owners[p.id]!==this.actor).sort((a,b)=>dist(a.position,this.player.position)-dist(b.position,this.player.position)),nearest=hostile[0];
    const inOrbit=nearest&&dist(nearest.position,this.player.position)<=320,threat=inOrbit?nearest.level:Math.min(12,this.level+galaxyDefinition(this.galaxyId).tier*3);
    const isActive=e=>e.hp>0&&!e.politicalWarId&&e.kind!=='planetBase'&&e.kind!=='boss'&&dist(e.position,this.player.position)<160&&e.fleetPlan!=='retreat'&&!this.enemies.some(l=>l.id===e.leaderId&&l.fleetPlan==='retreat');
    const mobile=this.enemies.filter(isActive).length,cap=Math.min(48,32+Math.floor(this.level/3)*2+(inOrbit?4:0));
    if(this.spawnTimer<=0&&mobile<cap&&this.enemies.length<64){
      let leaders=this.enemies.filter(e=>e.hp>0&&e.fleetRole==='flagship'&&!e.politicalWarId&&e.fleetPlan!=='retreat'&&dist(e.position,this.player.position)<160);
      if(nearest&&(leaders.length===0||(leaders.length<(this.level>=8?4:3)&&leaders.every(l=>this.enemies.filter(e=>e.hp>0&&e.leaderId===l.id).length>=5)))){const l=this.spawnEnemyFleet(hostile[this.approachIndex%Math.min(hostile.length,4)]||nearest);if(l)leaders.push(l);}
      const count=Math.min(cap-mobile,this.time<2?6:inOrbit?5:3);
      for(let i=0;i<count&&this.enemies.length<64&&this.enemies.filter(isActive).length<cap;i++){
        const l=leaders.filter(l=>l.fleetPlan!=='retreat'&&this.enemies.filter(e=>e.hp>0&&e.leaderId===l.id).length<10).sort((a,b)=>this.enemies.filter(e=>e.hp>0&&e.leaderId===a.id).length-this.enemies.filter(e=>e.hp>0&&e.leaderId===b.id).length)[0];
        if(!l)break;const escorts=this.enemies.filter(e=>e.hp>0&&e.leaderId===l.id);if(escorts.length>=10)break;
        const role=!escorts.some(e=>e.fleetRole==='guard')?'guard':!escorts.some(e=>e.fleetRole==='support')?'support':['guard','gunner','striker','striker'][escorts.length%4];
        this.spawnEnemyOfficer(l,role,escorts.length,.45*(1+Math.min(threat,30)*.05));
      }
      this.spawnTimer=inOrbit?Math.max(.7,1.2-threat*.02):1.2;
    }
    this.patrolTimer=(this.patrolTimer??18)-dt;
    if(this.patrolTimer<=0&&nearest&&mobile<cap-4&&this.enemies.length<60){this.spawnEnemyFleet(nearest);this.patrolTimer=24;}
    this.spawnTimer-=dt;
  }
  equipmentCost(id){const discount=this.infrastructure.equipmentDiscount+this.tech.equipmentDiscount;return this.campaignDock?permanentEquipmentCost(this.upgrades[id],discount,(this.meta.campaign?.cleared||0)>=3):Math.ceil((10+this.upgrades[id]*15)*Math.max(.5,1-discount));}
  buildDefense(target,id){return buildDefense(this,target,id);}
  constructBase(id) {
    if(this.phase!=='base'||constructionLock(this.meta.base,id))return false;
    const cost=Math.ceil(constructionCost(this.meta.base,id)*(1-this.tech.constructionDiscount));if(this.scrap+this.meta.bank<cost)return false;
    const fromScrap=Math.min(this.scrap,cost);this.scrap-=fromScrap;this.meta.bank-=cost-fromScrap;
    this.meta.base=cleanBase(this.meta.base);this.meta.base[id]++;
    const previous=this.infrastructure;this.infrastructure=baseStats(this.meta.base);const p=this.player;
    p.maxHp+=this.infrastructure.hull-previous.hull;p.hp+=this.infrastructure.hull-previous.hull;
    p.maxShield+=this.infrastructure.shield-previous.shield;p.shield+=this.infrastructure.shield-previous.shield;
    this.syncAllies();return true;
  }
  syncFleet(){
    const previous=this.meta.fleetRank;this.meta.fleetRank=Math.max(previous,fleetRankFor(this.level));const tier=FLEET_TIERS[this.meta.fleetRank];
    const roster=this.solar&&this.meta.campaign?.systemOwned&&this.meta.spaceBase?.sunBuilt?this.meta.spaceBase.roster:[];
    while(this.fleet.length<Math.max(tier.count,roster.length)){const slot=this.fleet.length,role=roster[slot]||FLEET_ROSTER[slot],def=FLEET_ROLES[role],maxHp=def.hp+this.infrastructure.hull*.8+this.tech.hull*.5+(this.solar?.hull||0)*.4;this.fleet.push({id:this.nextId++,slot,role,position:fleetFormation(this.player.position,this.player.heading,slot,this.fleetCommand),heading:this.player.heading,hp:maxHp,maxHp,radius:def.radius,cooldown:this.random(),supportTimer:0,disabled:0,hit:0});}
    for(const ship of this.fleet){if(roster[ship.slot])ship.role=roster[ship.slot];const value=this.meta.fleetUpgrades?.[ship.slot],key=fleetConfigurationKey(ship.role,value);if(ship.appearanceKey!==key){const configuration=fleetConfiguration(ship.role,value);Object.assign(ship,{configuration,upgrades:configuration.upgrades,appearanceKey:configuration.key,radius:configuration.radius});}const configuration=ship.configuration;const max=configuration.hp+this.infrastructure.hull*.8+this.tech.hull*.5+(this.solar?.hull||0)*.4;if(max!==ship.maxHp){if(ship.hp>0)ship.hp=Math.max(1,Math.min(max,ship.hp+max-ship.maxHp));ship.maxHp=max;}}
    if(this.meta.fleetRank>previous){this.emit('fleetUnlocked',{rank:this.meta.fleetRank,name:tier.name,count:tier.count});this.emit('territorySave');}
  }
  openCarrier(){if(!['playing','base'].includes(this.phase)||!this.fleet.length)return false;this.carrierPrevious=this.phase;this.phase='carrier';return true;}
  closeCarrier(){if(this.phase!=='carrier')return false;this.phase=this.carrierPrevious||'playing';return true;}
  upgradeFleet(slot,id){
    if(this.phase!=='carrier'||!Object.hasOwn(FLEET_UPGRADES,id)||!/^([0-9])$/.test(String(slot)))return false;
    slot=Number(slot);if(!this.fleet.some(a=>a.slot===slot))return false;
    const records=cleanFleetUpgrades(this.meta.fleetUpgrades),u=records[slot],cost=fleetUpgradeCost(u,id);
    if(u[id]>=3||this.scrap+this.meta.bank<cost)return false;
    const spend=Math.min(this.scrap,cost);this.scrap-=spend;this.meta.bank-=cost-spend;u[id]++;this.meta.fleetUpgrades=records;this.syncFleet();this.emit('territorySave');this.emit('fleetUpgraded',{slot,name:FLEET_UPGRADES[id].name});return true;
  }
  commandFleet(command){if(this.phase!=='playing'||!this.fleet.length||!Object.hasOwn(FLEET_COMMANDS,command))return false;this.fleetCommand=command;this.emit('fleetCommand',{command,name:FLEET_COMMANDS[command].name});return true;}
  damageFleet(ship,amount,weapon=null){amount*=damageMultiplier(weapon,fleetArmor(ship.role));if(ship.hp<=0)return;const before=ship.hp;ship.hp=Math.max(0,ship.hp-amount*(this.fleetCommand==='guard'?.75:1)*(1-(ship.configuration?.resistance||0)));if(this.sortieRecorder)this.sortieRecorder.fleetLoss+=before-ship.hp;ship.hit=.2;this.emit('explosion',{position:copy(ship.position),size:ship.hp?1.2:4,color:'#83e8db'});if(ship.hp<=0){if(this.sortieRecorder)this.sortieRecorder.fleetDisabled++;ship.disabled=45;this.emit('fleetDisabled',{name:FLEET_ROLES[ship.role].name});}}
  updateFleet(dt){
    if(this.phase!=='playing')return;this.syncFleet();const growth=shipGrowth(this.upgrades,this.meta.tree,this.meta.base,this.meta.research).scale.x;
    for(const ship of this.fleet){const def=ship.configuration;ship.hit=Math.max(0,ship.hit-dt);ship.cooldown-=dt;
      const destination=fleetFormation(this.player.position,this.player.heading,ship.slot,this.fleetCommand,growth);const blend=1-Math.exp(-dt*def.follow);for(const axis of ['x','y','z'])ship.position[axis]+=(destination[axis]-ship.position[axis])*blend;
      ship.heading=this.player.heading;if(ship.hp<=0){ship.disabled=Math.max(0,ship.disabled-dt*def.recovery*(this.fleetCommand==='rally'?2:1));if(ship.disabled===0){ship.hp=ship.maxHp*.5;this.emit('fleetRecovered',{name:def.name});}continue;}
      ship.hp=Math.min(ship.maxHp,ship.hp+dt*(this.fleetCommand==='rally'?5:.4));
      if(ship.role==='support'){ship.supportTimer-=dt;if(ship.supportTimer<=0){ship.supportTimer=1;const multiplier=def.support*(this.fleetCommand==='rally'?2:1),hpBefore=this.player.hp,shieldBefore=this.player.shield;this.player.hp=Math.min(this.player.maxHp,this.player.hp+.8*multiplier);if(this.time-this.player.lastDamage>SHIELD_RECOVERY_DELAY)this.player.shield=Math.min(this.player.maxShield,this.player.shield+.6*multiplier);if(this.sortieRecorder){this.sortieRecorder.supportHull+=this.player.hp-hpBefore;this.sortieRecorder.supportShield+=this.player.shield-shieldBefore;}for(const other of this.fleet)if(other.hp>0){const before=other.hp;other.hp=Math.min(other.maxHp,other.hp+2.5*multiplier);if(this.sortieRecorder)this.sortieRecorder.supportFleet+=other.hp-before;}}}
      if(this.fleetCommand==='rally')continue;const target=this.nearest(ship.position,def.range);if(target){ship.heading=Math.atan2(-(target.position.x-ship.position.x),-(target.position.z-ship.position.z));if(ship.cooldown<=0){ship.cooldown=def.cooldown*(1-(this.solar?.cooldown||0))/(this.fleetCommand==='assault'?1.25:1);const damage=def.damage*this.power()*(1+this.meta.fleetRank*.08);if(ship.role==='cruiser'){this.emit('beam',{from:copy(ship.position),to:copy(target.position),color:'#d7aeff',width:.65,life:.3});this.damageEnemy(target,damage,'laser');}else {const shot=this.shot(ship.position,target,damage,ship.role==='destroyer'?'missile':'fighter');if(shot&&ship.role==='frigate')shot.weapon='cannon';}}}
      if(this.fleetCommand==='guard'&&ship.role==='interceptor'){const missile=this.shots.find(q=>q.life>0&&!q.friendly&&dist(q.position,ship.position)<def.interceptRange);if(missile){if(this.sortieRecorder)this.sortieRecorder.intercepts++;missile.life=-1;this.emit('explosion',{position:copy(missile.position),size:1.8,color:'#91eaff'});}}
    }
    this.shots=this.shots.filter(q=>q.life>0);
  }
  syncAllies() {
    this.allies=this.allies.filter(a=>!a.expires||a.expires>this.time);
    const count=this.upgrades.fighter*2+(this.stage===2?2:0)+this.tech.extraEscort+this.infrastructure.escorts+this.vessel.escorts+(this.solar?.escorts||0);
    while(this.allies.filter(a=>!a.expires).length<count)this.allies.push({id:this.nextId++,position:copy(this.player.position),angle:this.allies.length*2.399,cooldown:this.random()});
  }
  castSkill(id) {
    if(this.phase!=='playing'||!skillLearned(this.meta,id)||!Object.hasOwn(this.skillTimers,id)||this.skillTimers[id]>0)return false;
    const def=SKILL_DEFS.find(s=>s.id===id),link=resolveLink(this.lastSkill,id,this.time);const skillPower=this.power()*(link?.power||1);
    this.skillTimers[id]=def.cooldown*this.cooldownFactor()*(link?.cooldown||1);this.skillDurations[id]=this.skillTimers[id];
    this.linkChain=link?Math.min(9,this.linkChain+1):1;this.lastSkill={id,at:this.time};
    if(link){for(const other in this.skillTimers)if(other!==id)this.skillTimers[other]=Math.max(0,this.skillTimers[other]-1.5);this.linkNotice={name:link.name,detail:link.detail,at:this.time};this.emit('skillLink',{name:link.name,detail:link.detail,chain:this.linkChain});}
    this.comboGuard=Math.max(this.comboGuard,link?.guard||0);this.player.boost=Math.min(100,this.player.boost+(link?.boost||0));
    const p=this.player;
    if(id==='pulse'){
      const radius=24+this.vessel.pulseRadius+this.stage*4+this.tech.pulseRange;this.emit('pulse',{position:copy(p.position),radius});
      for(const e of this.enemies){const d=dist(p.position,e.position);if(d<radius+e.radius){e.stun=1.8;const dir=towards(p.position,e.position);addScaled(e.position,dir,5);this.damageEnemy(e,(70+this.stage*30)*skillPower*(1+this.tech.pulsePower),'pulse');}}
      this.shots=this.shots.filter(s=>s.friendly||dist(s.position,p.position)>radius);
      this.hazards=this.hazards.filter(h=>h.cosmic||dist(h.position,p.position)>radius);
      for(const pickup of this.pickups)this.collect(pickup);this.pickups=[];
    } else if(id==='barrage') {
      const targets=this.enemies.filter(e=>e.hp>0).sort((a,b)=>dist(a.position,p.position)-dist(b.position,p.position)).slice(0,12);
      for(let i=0;i<12+this.stage*4+this.tech.barrageCount;i++){const t=targets[i%targets.length];if(!t)break;const pos=copy(p.position);pos.x+=(i%2===0?1:-1)*(2+this.stage);pos.y+=.6;const shot=this.shot(pos,t,(38+this.stage*12)*skillPower,'missile');if(shot)shot.visualVariant='barrage';}
    } else if(id==='nova'){const radius=30+this.tech.novaRange;this.emit('pulse',{position:copy(p.position),radius,color:'#ffae68'});for(const e of this.enemies)if(dist(p.position,e.position)<radius+e.radius)this.damageEnemy(e,(100+this.tech.nova)*skillPower,'nova');
    } else if(id==='stasis'){const radius=38;this.emit('pulse',{position:copy(p.position),radius,color:'#b590ff'});for(const e of this.enemies)if(dist(p.position,e.position)<radius+e.radius)e.stun=Math.max(e.stun,2+this.tech.stasis+(link?.control||0));this.shots=this.shots.filter(s=>s.friendly||dist(s.position,p.position)>radius);
    } else if(id==='repair'){p.hp=Math.min(p.maxHp,p.hp+(35+this.tech.repair)*(1+this.tech.repairPower)*(link?.heal||1));p.shield=Math.min(p.maxShield,p.shield+(35+this.tech.repair)*(1+this.tech.repairPower)*(link?.heal||1));this.emit('pulse',{position:copy(p.position),radius:8,color:'#81ffb5'});
     } else if(id==='lance'){
      const dir=forward(p.heading),end=copy(p.position);addScaled(end,dir,120);this.emit('beam',{from:copy(p.position),to:end,color:'#ffbc83',width:1.2,life:.45});
      for(const e of this.enemies){const rel=v(e.position.x-p.position.x,e.position.y-p.position.y,e.position.z-p.position.z),t=rel.x*dir.x+rel.y*dir.y+rel.z*dir.z;if(t>=0&&t<=120){const near=copy(p.position);addScaled(near,dir,t);if(dist(near,e.position)<e.radius+2)this.damageEnemy(e,(140+this.tech.lance)*skillPower,'lance');}}
    } else if(id==='countermeasure'){
      const radius=50+this.tech.countermeasure;this.shots=this.shots.filter(s=>s.friendly||dist(s.position,p.position)>radius);for(const e of this.enemies)if(dist(e.position,p.position)<radius)e.tailLock=0;this.emit('pulse',{position:copy(p.position),radius,color:'#ed9fef'});
    } else if(id==='sentry'){
      for(let i=0;i<this.tech.sentry;i++)this.allies.push({id:this.nextId++,position:copy(p.position),angle:this.allies.length*2.399,cooldown:0,expires:this.time+12+(link?.escort||0)});this.emit('pulse',{position:copy(p.position),radius:10,color:'#9bdfbf'});
    } else {p.overcharge=8+this.tech.overTime+(link?.duration||0);p.shield=Math.min(p.maxShield,p.shield+25);this.emit('overcharge',{position:copy(p.position)});}
    this.emit('skill',{id});return true;
  }
  cooldownFactor(){return Math.max(.45,1-this.meta.research.reactor*.05-this.upgrades.reactor*.06-this.tech.cooldown-this.infrastructure.cooldown-this.vessel.cooldown-(this.solar?.cooldown||0));}
  finish(victory) {
    persistCampaignShip(this);
    if(this.phase==='ended')return;
    const finalHullName=hullDisplayName({capitalName:this.solar?.capital?.name,growth:shipGrowth(this.upgrades,this.meta.tree,this.meta.base,this.meta.research),stageName:STAGES[this.stage],stage:this.stage});
    this.phase='ended';const banked=Math.floor(this.scrap*(victory?1:.7))+(victory?120:12);
    this.meta.bank+=banked;this.meta.runs++;this.meta.bestKills=Math.max(this.meta.bestKills,this.kills);
    if(this.mode==='campaign'&&this.sortieRecorder)this.meta.lastSortie=this.sortieRecorder.finish(this,victory);
    if(victory){this.meta.wins++;if(this.mode!=='campaign')this.meta.sector=Math.min(3,this.meta.sector+1);}
    this.result={...(this.mode==='campaign'?{campaign:{planet:CAMPAIGN_STAGES[this.campaign.index].name,index:this.campaign.index,chapter:this.campaign.chapter},objectiveProgress:campaignObjectiveProgress(this)}:{}),victory,kills:this.kills,time:this.time,scrap:this.scrap,level:this.level,stage:this.stage,finalHullName,banked,...(this.battleRecorder?{battleRecord:this.battleRecorder.summary()}:{}),...(this.mode==='campaign'&&this.meta.lastSortie?{sortieRecord:structuredClone(this.meta.lastSortie)}:{}),settlement:{loot:Math.floor(this.scrap*(victory?1:.7)),operation:victory?120:12}};this.emit('end',{result:this.result});
  }
  step(dt,input={}) {
    if(this.phase!=='playing')return;
    dt=clamp(dt,0,.05);this.time+=dt;
    const p=this.player;this.comboGuard=Math.max(0,this.comboGuard-dt);p.hit=Math.max(0,p.hit-dt);p.overcharge=Math.max(0,p.overcharge-dt);
    for(const id in this.skillTimers)this.skillTimers[id]=Math.max(0,this.skillTimers[id]-dt*(p.overcharge>0?1.35:1));
    if(this.time-p.lastDamage>SHIELD_RECOVERY_DELAY&&!(this.mode==='campaign'&&this.campaign.outsideTime>=5))p.shield=Math.min(p.maxShield,p.shield+shieldRecoveryRate(p.maxShield,this.upgrades.shield,this.tech.shieldRegen,this.vessel.shieldRegen)*dt);
    if(this.time-p.lastDamage>4)p.hp=Math.min(p.maxHp,p.hp+(this.tech.regen+this.vessel.regen)*dt);
    this.evadeCooldown=Math.max(0,this.evadeCooldown-dt);this.evadeTimer=Math.max(0,this.evadeTimer-dt);
    if(input.evade)this.evade(input);
    const dir=norm(v(input.x||0,input.y||0,input.z||0));const moving=Math.hypot(input.x||0,input.y||0,input.z||0)>.05;
    const boosting=!!input.boost&&moving&&p.boost>3;
    if(boosting){p.boost=Math.max(0,p.boost-31*Math.max(.15,1-this.tech.boostEconomy-this.vessel.boostEconomy)*dt);if(!this.boosting)this.emit('boost');}else p.boost=Math.min(100,p.boost+(19+this.tech.boostRegen)*(1+this.infrastructure.boostRegen+(this.solar?.boostRegen||0))*dt);
    this.boosting=boosting;
    const speed=(13+this.upgrades.magnet*.9)*this.vessel.speed*(1+this.tech.speed+this.infrastructure.speed)*(boosting?2.15:1)*(p.overcharge>0?1.15:1);
    const damping=1-Math.exp(-dt*(boosting?5:4));
    const desired=moving?v(dir.x*speed,dir.y*speed*.8,dir.z*speed):v();
    p.velocity.x+=(desired.x-p.velocity.x)*damping;p.velocity.y+=(desired.y-p.velocity.y)*damping;p.velocity.z+=(desired.z-p.velocity.z)*damping;
    if(this.campaign?.phase!=='landing')updateCosmic(this,dt);if(this.phase!=='playing')return;
    for(const h of this.hazards){if(h.cosmic||h.warning>0)continue;const d=dist(h.position,p.position);if(d<h.radius){const pull=towards(p.position,h.position);addScaled(p.velocity,pull,16*dt);if(h.tick<=0){this.damagePlayer(5,'gravity',h.position);if(this.phase!=='playing')return;h.tick=.8;}}}
    if(this.evadeTimer>0)p.velocity=v(this.evadeDirection.x*(46+this.tech.evadeSpeed),this.evadeDirection.y*(46+this.tech.evadeSpeed),this.evadeDirection.z*(46+this.tech.evadeSpeed));
    addScaled(p.position,p.velocity,dt);if(this.mode!=='campaign')p.position.y=clamp(p.position.y,this.mode==='campaign'?-240:this.mode==='galaxy'?-400:-30,this.mode==='campaign'?240:this.mode==='galaxy'?400:30);
    if(Math.abs(p.velocity.x)+Math.abs(p.velocity.z)>.5){let target=Math.atan2(-p.velocity.x,-p.velocity.z);let delta=Math.atan2(Math.sin(target-p.heading),Math.cos(target-p.heading));p.heading+=delta*(1-Math.exp(-dt*5));}
    if(this.mode==='campaign'){updateSolarCampaign(this,dt);if(this.phase!=='playing')return;}else if(this.mode==='galaxy')this.updateGalaxy(dt);else {
    this.fever=(this.time>=105&&this.time<130)||(this.time>=255&&this.time<280);
    if(this.fever&&!this.feverAnnounced){this.feverAnnounced=true;this.emit('announce',{title:'OVERDRIVE / 함대 대공세',sub:'적 증원 급증 · 잔해 회수량 증가 · 광역 무장으로 돌파하세요.'});}
    if(!this.fever)this.feverAnnounced=false;
    this.spawnTimer-=dt;
    if(this.spawnTimer<=0&&this.enemies.filter(e=>e.hp>0).length<72){
      const available=enemyPool(this.meta.sector,this.time);
      const count=this.fever?4:1+(this.time>70?1:0);
      for(let i=0;i<count;i++)this.spawn(available[Math.floor(this.random()*available.length)]);
      this.spawnTimer=Math.max(.28,1.15-this.time*.0022)*(this.fever?.45:1);
    }
    if((this.level>=4||this.time>=150)&&!this.firstBoss&&!this.enemies.some(e=>e.kind==='boss'&&e.hp>0)){this.firstBoss=true;this.titanForewarned=false;this.spawn('boss',null,false);}
    if((this.level>=8||this.time>=310)&&this.firstBoss&&!this.finalBoss&&!this.enemies.some(e=>e.kind==='boss'&&e.hp>0)){this.finalBoss=true;this.spawn('boss',null,true);}
    }
    updateRecall(this,dt);
    if(this.mode!=='campaign')this.updateTitanArrival();
    this.updateEnemies(dt);
    // A lethal contact or projectile settles the run immediately. Do not let
    // later systems mutate kills, salvage or XP after the result was recorded.
    if(this.phase!=='playing')return;
    updateDefenses(this,dt);this.updateWeapons(dt);this.updateShots(dt);
    if(this.phase!=='playing')return;
    if(this.mode!=='campaign'){updateMining(this,dt);if(input.mine)this.mine();}this.updatePickups(dt);this.updateAllies(dt);this.updateFleet(dt);
    this.hazards=this.hazards.filter(h=>{h.life-=dt;h.tick-=dt;h.warning=Math.max(0,h.warning-dt);return h.life>0;});
    this.enemies=this.enemies.filter(e=>e.hp>0&&(e.kind==='boss'||(this.mode==='campaign'||(e.kind==='planetBase'?dist(e.position,p.position)<400:dist(e.position,p.position)<190))));
    if(this.mode==='survival'&&this.finalDefeated&&this.time>=DURATION)this.finish(true);
    else this.levelUp();
    if(this.mode==='campaign'){const extent=CAMPAIGN_STAGES[this.campaign.index].extent;for(const e of this.enemies)constrainArena(e,extent);}
  }
  updateTitanArrival() {
    const due=this.mode==='galaxy'?this.nextTitan:!this.firstBoss?150:310;
    if(this.time>=due-12&&this.time<due&&!this.titanForewarned){this.titanForewarned=true;this.emit('announce',{title:'초대형 질량 접근 · '+Math.ceil(due-this.time)+'초',sub:'거인 전함 도약 신호 · R 회피 / Q·E 고도 변경 / 1 펄스 준비'});}
    if(this.mode==='galaxy'&&this.time>=this.nextTitan&&!this.enemies.some(e=>e.kind==='boss'&&e.hp>0)){this.spawn('boss',null,this.titanCount%3===2);this.titanCount++;this.nextTitan=this.time+240;this.titanForewarned=false;}
  }
  updateEnemies(dt) {
    if(this.phase!=='playing')return;
    const p=this.player;
    for(const e of this.enemies){
      if(e.hp<=0)continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);e.contact-=dt;e.cooldown-=dt;e.stun=Math.max(0,e.stun-dt);if(e.stun>0&&!e.tactics&&!e.solarBoss)continue;
      if(e.politicalWarId){updatePoliticalShip(this,e,dt);continue;}
      if(e.enemyFleet){this.updateEnemyFleetShip(e,dt);if(this.phase!=='playing')return;continue;}
      if(e.kind==='rival')continue;
      if(e.tactics){updateAndromedaBoss(this,e,dt);if(this.phase!=='playing')return;continue;}
      if(e.solarBoss){updateSolarBoss(this,e,dt);if(this.phase!=='playing')return;continue;}
      if(e.titan){updateTitan(this,e,dt);if(this.phase!=='playing')return;continue;}
      if(e.kind==='planetBase'){
        if(dist(e.position,p.position)<95&&e.cooldown<=0){e.cooldown=2.4;this.shot(e.position,null,e.damage,'enemy',false);this.emit('warning',{position:copy(e.position),target:copy(p.position),life:.5});}continue;
      }
      const d=dist(e.position,p.position),dir=towards(e.position,p.position);let desired=copy(dir),speed=e.speed;
      if(e.kind==='swarm'){const wiggle=Math.sin(e.age*2+e.id)*.25;desired.x+=dir.z*wiggle;desired.z-=dir.x*wiggle;}
      if(e.kind==='interceptor'){
        if(e.warning>0){e.warning-=dt;speed*=.2;if(e.warning<=0){e.target=copy(p.position);e.phase=1;e.cooldown=.85;this.emit('dash',{position:copy(e.position)});}}
        else if(e.phase===1){desired=towards(e.position,e.target);speed*=3;if(e.cooldown<=0){e.phase=0;e.cooldown=3;}}
        else {desired.x+=dir.z*e.side*.8;desired.z-=dir.x*e.side*.8;if(d<32&&e.cooldown<=0){e.warning=.7;this.emit('warning',{enemy:e,position:copy(e.position),target:copy(p.position),life:.7});}}
      }
      if(e.kind==='sniper'||e.kind==='gravity'||e.kind==='carrier'||e.kind==='boss'){
        const range=e.kind==='sniper'?42:e.kind==='gravity'?27:e.kind==='carrier'?48:36;
        const radial=clamp((d-range)/12,-1,1);desired=v(dir.x*radial+dir.z*.28*e.side,dir.y*.6,dir.z*radial-dir.x*.28*e.side);
        if(e.kind==='sniper'){
          if(e.warning>0){e.warning-=dt;speed*=.25;if(e.warning<=0){const aim=towards(e.position,e.target);this.shot(e.position,null,e.damage,'enemy',false,aim);if(this.time>90)for(const side of [-1,1])this.shot(e.position,null,e.damage*.8,'enemy',false,norm(v(aim.x+side*.12,aim.y,aim.z)));e.cooldown=this.time>180?2.3:2.7;}}
          else if(e.cooldown<=0){e.warning=.85;e.target=v(p.position.x+p.velocity.x*.4,p.position.y+p.velocity.y*.4,p.position.z+p.velocity.z*.4);this.emit('warning',{enemy:e,position:copy(e.position),target:e.target,life:.85});}
        }
        if(e.kind==='gravity'&&e.cooldown<=0){e.cooldown=7;this.addHazard(v(p.position.x+p.velocity.x*.6,p.position.y,p.position.z+p.velocity.z*.6),7.5);}
        if(e.kind==='carrier'&&this.time>60){
          e.salvoTimer=(e.salvoTimer??3)-dt;
          if(e.salvoAim){e.salvoWarning-=dt;if(e.salvoWarning<=0){const aim=towards(e.position,e.salvoAim);for(const side of [-1,0,1])this.shot(e.position,null,e.damage*1.3,'enemy',false,norm(v(aim.x+side*.16,aim.y,aim.z)));e.salvoAim=null;e.salvoTimer=4.8;}}
          else if(e.salvoTimer<=0&&d<100){e.salvoAim=v(p.position.x+p.velocity.x*.5,p.position.y+p.velocity.y*.5,p.position.z+p.velocity.z*.5);e.salvoWarning=.8;this.emit('warning',{position:copy(e.position),target:e.salvoAim,life:.8});}
        }
        if(e.kind==='carrier'&&e.cooldown<=0){e.cooldown=6.5;for(let j=0;j<3;j++)if(this.enemies.length<84){const escort=this.spawn('swarm',v(e.position.x+(j-1)*3,e.position.y+2,e.position.z-3));escort.xp=.35;}this.emit('launch',{position:copy(e.position)});}
        if(e.commander){this.updateCommander(e,dt);}else if(e.kind==='boss'&&e.cooldown<=0){
          if(!e.bossAim){e.bossAim=v(p.position.x+p.velocity.x*.6,p.position.y+p.velocity.y*.6,p.position.z+p.velocity.z*.6);e.cooldown=.75;this.emit('warning',{position:copy(e.position),target:e.bossAim,life:.75});continue;}const enraged=e.hp<e.maxHp*.5;e.cooldown=enraged?1.55:2.7;e.phase++;
          if(e.phase%3===0){this.addHazard(copy(p.position),enraged?13:10);}
          else {const aim=towards(e.position,e.bossAim);for(let j=-3;j<=3;j++){const a=j*.17,c=Math.cos(a),s=Math.sin(a);this.shot(e.position,null,e.damage,'boss',false,v(aim.x*c-aim.z*s,aim.y,aim.x*s+aim.z*c));}if(e.final&&e.phase%2===0){this.shot(e.position,null,e.damage*.9,'enemyMissile',false,aim);this.emit('missileAlert',{position:copy(e.position)});}this.emit('bossfire',{position:copy(e.position)});}e.bossAim=null;
          if(e.phase%4===0)for(let j=0;j<4;j++)if(this.enemies.length<84)this.spawn('interceptor',v(e.position.x+(j-1.5)*4,e.position.y+4,e.position.z));
        }
      }
      if(e.kind==='interceptor'&&e.interceptRole==='tail'&&this.time>12&&e.phase!==1&&d<75) {
        const f=forward(p.heading),behind=v(p.position.x-f.x*16,p.position.y,p.position.z-f.z*16);
        desired=towards(e.position,behind);e.tailCooldown=Math.max(0,e.tailCooldown-dt);
        const caught=tailPosition(e.position,p.position,p.heading,55)&&this.evadeTimer<=0;
        e.tailLock=caught?Math.min(1.2,e.tailLock+dt):Math.max(0,e.tailLock-dt*3);
        if(e.tailLock>=1.2&&e.tailCooldown<=0){const shot=this.shot(e.position,null,14,'enemyMissile',false);if(shot){shot.speed=25;shot.life=6;shot.velocity=v(shot.direction.x*25,shot.direction.y*25,shot.direction.z*25);}e.tailCooldown=5;this.emit('missileAlert',{position:copy(e.position)});}
      }
      moveEnemy(e,norm(desired),speed,dt);
      // Actual body separation prevents the fleet from collapsing into one pile.
      for(const other of this.enemies){if(other.id>=e.id||other.hp<=0||other.kind==="planetBase")continue;const dx=e.position.x-other.position.x,dy=e.position.y-other.position.y,dz=e.position.z-other.position.z,rr=e.radius+other.radius;if(!distanceMayBeInside(dx,dy,dz,rr))continue;const nd=Math.hypot(dx,dy,dz);if(nd<rr&&nd>.01){const sep=v(dx/nd,dy/nd,dz/nd);const correction=Math.min((rr-nd)*.5,dt*9);addScaled(e.position,sep,correction);addScaled(other.position,sep,-correction);}}
      if(d<p.radius+e.radius&&e.contact<=0){e.contact=1.2;this.damagePlayer(e.damage,'contact',e.position);if(this.phase!=='playing')return;addScaled(e.position,dir,-3);}
    }
  }
  addHazard(position,radius){const h={id:this.nextId++,position,radius,warning:1.0,life:5.7,tick:0};this.hazards.push(h);this.emit('gravity',{hazard:h});}
  updateWeapons(dt) {
    if(this.phase!=='playing')return;
    const p=this.player,power=this.power(),haste=p.overcharge>0?2:1;
    for(const id in this.weaponTimers)this.weaponTimers[id]-=dt*haste;
    const target=this.nearest(p.position,Math.max(88+this.tech.cannonRange,this.upgrades.laser>0?100+this.tech.laserRange:0));if(!target)return;
    const cannon=this.upgrades.cannon;
    if(this.weaponTimers.cannon<=0&&dist(p.position,target.position)<=88+this.tech.cannonRange){
      this.weaponTimers.cannon=Math.max(.09,(.42-cannon*.045)/(1+this.tech.fireRate));
      const count=cannon>=3?2:1;for(let i=0;i<count;i++){const pos=copy(p.position);pos.x+=(i-(count-1)/2)*(2+this.stage);pos.y+=1;this.shot(pos,target,(18+cannon*6)*power,'cannon');}
    }
    const chain=this.upgrades.chain;
    if(chain>0&&this.weaponTimers.chain<=0){
      this.weaponTimers.chain=Math.max(.85,2.5-chain*.2);const hit=new Set(),points=[copy(p.position)];let current=this.nearest(p.position,44+chain*3);
      for(let i=0;i<3+chain+this.tech.chainTargets&&current;i++){points.push(copy(current.position));hit.add(current.id);this.damageEnemy(current,(20+chain*12)*power,'chain');current=this.nearest(current.position,21+chain*2+this.tech.chainReach,hit);}
      if(points.length>1)this.emit('chain',{points});
    }
    const missile=this.upgrades.missile;
    if(missile>0&&this.weaponTimers.missile<=0){this.weaponTimers.missile=Math.max(1.2,3.1-missile*.2);for(let i=0;i<missile+1;i++){const pos=copy(p.position);pos.x+=(i%2?1:-1)*(2+this.stage);this.shot(pos,this.enemies[(i+Math.floor(this.random()*this.enemies.length))%this.enemies.length]||target,(26+missile*13)*power,'missile');}}
    const laser=this.upgrades.laser;
    if(laser>0&&this.weaponTimers.laser<=0&&dist(p.position,target.position)<=100+this.tech.laserRange){this.weaponTimers.laser=Math.max(.8,2.7-laser*.25);const dir=towards(p.position,target.position),end=copy(p.position);addScaled(end,dir,100+this.tech.laserRange);this.emit('beam',{from:copy(p.position),to:end,color:'#78ffe1',width:.45+laser*.14,life:.32});for(const e of this.enemies){const relative=v(e.position.x-p.position.x,e.position.y-p.position.y,e.position.z-p.position.z);const t=relative.x*dir.x+relative.y*dir.y+relative.z*dir.z;if(t>0&&t<100+this.tech.laserRange){const nearest=copy(p.position);addScaled(nearest,dir,t);if(dist(nearest,e.position)<e.radius+1.3)this.damageEnemy(e,(38+laser*20)*power,'laser');}}}
  }
  updateShots(dt) {
    if(this.phase!=='playing')return;
    let collisionGrid=null;
    if(this.enemies.length>=32&&this.shots.length>=16) {
      let friendly=0;for(const shot of this.shots)if(shot.friendly&&shot.life>dt)friendly++;
      if(friendly>=16){collisionGrid=shotCollisionGrids.get(this);if(!collisionGrid){collisionGrid=new ShotCollisionGrid();shotCollisionGrids.set(this,collisionGrid);}collisionGrid.prepare(this.enemies);}
    }
    for(const s of this.shots){
      s.life-=dt;s.age+=dt;s.previous=copy(s.position);
      if(s.type==='enemyMissile'&&!s.trackingLost){
        const dir=towards(s.position,this.player.position),blend=1-Math.exp(-dt*1.8);
        s.direction=norm(v(s.direction.x+(dir.x-s.direction.x)*blend,s.direction.y+(dir.y-s.direction.y)*blend,s.direction.z+(dir.z-s.direction.z)*blend));
        s.velocity=v(s.direction.x*s.speed,s.direction.y*s.speed,s.direction.z*s.speed);
      }
      if(s.type==='missile'){
        let target=this.enemies.find(e=>e.id===s.target&&e.hp>0);if(!target){target=this.nearest(s.position,90);s.target=target?.id;}
        if(target){const dir=towards(s.position,target.position),blend=1-Math.exp(-dt*3.5);s.direction=norm(v(s.direction.x+(dir.x-s.direction.x)*blend,s.direction.y+(dir.y-s.direction.y)*blend,s.direction.z+(dir.z-s.direction.z)*blend));}
        s.speed=Math.min(70,s.speed+dt*22);s.velocity=v(s.direction.x*s.speed,s.direction.y*s.speed,s.direction.z*s.speed);
      }
      addScaled(s.position,s.velocity,dt);
      if(s.life<=0)continue;
      // The swept segment is shared by all candidates. Only actual hits need a point object.
      const tx=s.position.x-s.previous.x,ty=s.position.y-s.previous.y,tz=s.position.z-s.previous.z,ll=tx**2+ty**2+tz**2;
      if(s.friendly){const collisions=[];for(const e of collisionGrid?collisionGrid.query(s.previous,s.position,s.radius):this.enemies){if(e.hp<=0||s.hitIds?.has(e.id))continue;const t=ll?clamp(((e.position.x-s.previous.x)*tx+(e.position.y-s.previous.y)*ty+(e.position.z-s.previous.z)*tz)/ll,0,1):0,nx=s.previous.x+tx*t,ny=s.previous.y+ty*t,nz=s.previous.z+tz*t;if(withinShotRadius(nx-e.position.x,ny-e.position.y,nz-e.position.z,e.radius+s.radius))collisions.push({e,t,near:v(nx,ny,nz)});}collisions.sort((a,b)=>a.t-b.t);for(const {e,near} of collisions){if(e.hp<=0)continue;s.hitIds?.add(e.id);this.damageEnemy(e,s.damage,s.weapon||s.type,near);if(s.type==='missile'){this.emit('explosion',{position:copy(near),size:3.8+this.tech.missileRadius*.5,color:'#ffb65b'});for(const other of this.enemies)if(other!==e&&other.hp>0&&dist(other.position,near)<7+this.tech.missileRadius)this.damageEnemy(other,s.damage*.55,'missile');}if(s.pierce>0){s.pierce--;s.damage*=.85;}else{s.life=-1;break;}}}

      else if(this.fleet.some(ship=>{if(ship.hp<=0)return false;const t=ll?clamp(((ship.position.x-s.previous.x)*tx+(ship.position.y-s.previous.y)*ty+(ship.position.z-s.previous.z)*tz)/ll,0,1):0,nx=s.previous.x+tx*t,ny=s.previous.y+ty*t,nz=s.previous.z+tz*t;if(withinShotRadius(nx-ship.position.x,ny-ship.position.y,nz-ship.position.z,ship.radius+s.radius)){s.life=-1;this.damageFleet(ship,s.damage,s.weapon);return true;}return false;})){}
      else if(dist(s.position,this.player.position)<this.player.radius+s.radius){s.life=-1;this.damagePlayer(s.damage,'projectile',s.previous,s.weapon);if(this.phase!=='playing')break;}
    }
    collisionGrid?.release();this.shots=this.shots.filter(s=>s.life>0&&dist(s.position,this.player.position)<160);
  }
  updatePickups(dt) {
    if(this.phase!=='playing')return;
    const radius=19+this.upgrades.magnet*8+this.vessel.magnet+this.tech.magnet+this.infrastructure.magnet;
    this.pickups=this.pickups.filter(pickup=>{pickup.life-=dt;const d=dist(pickup.position,this.player.position);if(d<radius){const dir=towards(pickup.position,this.player.position);addScaled(pickup.position,dir,Math.min(d,dt*(16+(radius-d)*3)));}if(d<3){this.collect(pickup);return false;}return pickup.life>0;});
  }
  updateAllies(dt) {
    if(this.phase!=='playing')return;
    this.syncAllies();
    for(let i=0;i<this.allies.length;i++){const ally=this.allies[i];ally.angle+=dt*.6;const a=ally.angle;const r=8+this.stage*2+i*.4+this.tech.fighterOrbit;ally.position=v(this.player.position.x+Math.cos(a)*r,this.player.position.y+2+Math.sin(a*1.7)*3,this.player.position.z+Math.sin(a)*r);ally.cooldown-=dt;if(!(ally.cooldown<=0))continue;const t=this.nearest(ally.position,60+this.tech.fighterRange);if(t){ally.cooldown=Math.max(.2,(.8-this.upgrades.fighter*.08)/(1+this.tech.fighterHaste));this.shot(ally.position,t,(10+this.upgrades.fighter*5)*this.power(),'fighter');}}
  }
  snapshot() {
    const p=this.player,b=this.enemies.find(e=>e.kind==='boss'&&e.hp>0);
    const growth=shipGrowth(this.upgrades,this.meta.tree,this.meta.base,this.meta.research);
    const nearby=PLANETS.find(planet=>dist(planet.position,p.position)<400);const planetObjective=nearby?regionFor(nearby).name+' / '+nearby.name+' · LV.'+nearby.level+' · 기지 '+basesDestroyed(this.meta.conquest,nearby)+'/'+nearby.baseCount+' 파괴'+(occupied(this.meta.conquest,nearby)?' · 점령 완료':' · '+(b?.planetId===nearby.id?'우두머리 교전':basesDestroyed(this.meta.conquest,nearby)===nearby.baseCount?'우두머리 격파 필요':'침공 중')):galaxyDefinition(this.galaxyId).name+' · G 지도로 행성을 선택하세요';
    const threats=this.enemies.filter(e=>e.kind==='interceptor'&&e.tailLock>0.25);const incoming=this.shots.filter(s=>s.type==='enemyMissile'&&!s.trackingLost&&s.life>0);
    const hostileLeader=this.enemies.filter(e=>e.enemyFleet&&e.fleetRole==='flagship'&&e.hp>0).sort((a,b)=>dist(a.position,p.position)-dist(b.position,p.position))[0];
    const hostileIdentity=hostileLeader?planetCarrierIdentity(hostileLeader):null;
    return {campaign:solarSnapshot(this),economy:{bank:this.meta.bank,...this.meta.economy},minerals:(this.minerals||[]).map(n=>({...n})),hostileFleet:hostileLeader?{name:hostileIdentity.name,title:hostileIdentity.title,trait:hostileIdentity.trait+' · '+({approach:'호위 대형 접근',engage:'측면 협공',regroup:'전단 재집결',retreat:'항모 엄호 퇴각'}[hostileLeader.fleetPlan]||'교전'),color:hostileIdentity.color,hp:hostileLeader.hp,maxHp:hostileLeader.maxHp,ships:this.enemies.filter(e=>e.hp>0&&(e.id===hostileLeader.id||e.leaderId===hostileLeader.id)).length}:null,fleet:{rank:Math.max(this.meta.fleetRank,this.fleet.length?1:0),name:this.fleet.length>FLEET_TIERS[this.meta.fleetRank].count?'태양 원정 선단':FLEET_TIERS[this.meta.fleetRank].name,command:this.fleetCommand,next:FLEET_TIERS[this.meta.fleetRank+1]?.level||null,ships:this.fleet.map(a=>({id:a.id,slot:a.slot,upgrades:a.upgrades,configuration:a.configuration,role:a.role,name:FLEET_ROLES[a.role].name,hp:a.hp,maxHp:a.maxHp,disabled:a.disabled,x:a.position.x,y:a.position.y,z:a.position.z}))},galaxyId:this.galaxyId,territory:this.war.snapshot(),actor:this.actor,vessel:{id:this.vessel.id,name:this.vessel.name,family:SHIP_FAMILIES[this.vessel.family].name,evadeCost:this.vessel.evadeCost},capitalName:this.solar?.capital?.name||null,growth,mode:this.mode,conquest:cleanConquest(this.meta.conquest),warpCooldown:this.warpCooldown,dogfight:{tailBonus:.3+this.tech.tailPower,tailThreats:threats.length,lock:Math.max(0,...threats.map(e=>e.tailLock/1.2)),missiles:incoming.length,tailTarget:tailTarget(p,this.enemies)?.id||null,evadeCooldown:this.evadeCooldown,evading:this.evadeTimer>0},baseRange:this.infrastructure.dockRange,defenseAlert:recallSnapshot(this),defenses:(this.defenses||[]).map(d=>({id:d.id,x:d.position.x,y:d.position.y,z:d.position.z,kind:'defense',hp:d.hp,maxHp:d.maxHp,type:d.type,level:d.level})),cosmic:this.hazards.filter(h=>h.cosmic).map(h=>({id:'cosmic-'+h.id,kind:'cosmic',x:h.position.x,y:h.position.y,z:h.position.z,type:h.cosmic,warning:h.warning,life:h.life,distance:dist(h.position,p.position),radius:h.radius})),phase:this.phase,sector:this.meta.sector,time:this.time,duration:DURATION,kills:this.kills,scrap:this.scrap,level:this.level,xp:this.xp,xpNeed:this.xpNeed,hp:p.hp,maxHp:p.maxHp,shield:p.shield,maxShield:p.maxShield,stage:this.stage,stageName:STAGES[this.stage],altitude:p.position.y,speed:Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z),boost:p.boost,boostMax:100,skillLink:{chain:this.lastSkill&&this.time-this.lastSkill.at<=LINK_WINDOW?this.linkChain:0,remaining:this.lastSkill?Math.max(0,LINK_WINDOW-this.time+this.lastSkill.at):0,last:this.lastSkill?.id,notice:this.linkNotice&&this.time-this.linkNotice.at<3?this.linkNotice:null,overcharge:p.overcharge,guard:this.comboGuard},skills:SKILL_DEFS.map(s=>({...s,...SKILL_STYLE[s.id],learned:skillLearned(this.meta,s.id),link:nextLinks(this.meta,this.lastSkill,this.time).find(r=>r.to===s.id)||null,remaining:this.skillTimers[s.id],cooldown:this.skillDurations[s.id]||s.cooldown*this.cooldownFactor()})),weapons:UPGRADE_DEFS.filter(d=>this.upgrades[d.id]>0&&['cannon','chain','missile','laser','fighter'].includes(d.id)).map(d=>({name:d.name,level:this.upgrades[d.id],color:d.color})),boss:b?{name:b.name,hp:b.hp,maxHp:b.maxHp,titan:b.titan,status:solarBossStatus(b)||bossStatus(b)||(b.titan?(b.exposed>0?'코어 노출 · 피해 ×1.8':b.titanAttack?'충전 · '+b.titanAttack.label:b.hp<b.maxHp*.5?'광폭화 · 회피 후 반격':'주포 재충전 · 기동 유지'):null),distance:dist(b.position,p.position),angle:Math.atan2(b.position.x-p.position.x,-(b.position.z-p.position.z))}:null,player:copy(p.position),heading:p.heading,enemies:this.enemies.map(e=>({id:e.id,x:e.position.x,y:e.position.y,z:e.position.z,kind:e.kind})),objective:this.mode==='campaign'?CAMPAIGN_STAGES[this.campaign.index].name+' · '+solarSnapshot(this).objective:this.mode==='galaxy'?(this.war.wars.find(w=>w.defender===this.actor)?'⚠ 영토 침공 · '+PLANETS.find(p=>p.id===this.war.wars.find(w=>w.defender===this.actor).target).name+' · '+Math.ceil(this.war.wars.find(w=>w.defender===this.actor).remaining)+'초 내 방어 / G':planetObjective):this.fever?'함대 대공세 · 광역 무장으로 돌파하세요':b?'거대 개체의 코어를 파괴하세요':this.time<150?'잔해를 회수해 함선을 진화시키세요':this.time<310?'최종 교전에 대비해 무장을 강화하세요':'최종 보스를 격파하고 귀환하세요'};
  }
}







