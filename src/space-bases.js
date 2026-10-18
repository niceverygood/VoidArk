export const SOLAR_FOUNDATION_COST=400;
import {TUNING_DEFS,applyTuning} from './upgrade-tuning.js';
import {FLEET_ROLES,FLEET_TIERS} from './fleet.js';
export const SOLAR_FACILITIES=[
 {id:'command',name:'항성 함대 사령부',cost:180,description:'선단 건조 한도 4 → 7 → 10척 · 상위 시설 단계 해금'},
 {id:'shipyard',name:'코로나 대형 조선소',cost:220,description:'태양 기함 설계 해금 · 3종 기함 제작 단계 / 선체 +60씩'},
 {id:'forge',name:'항성 무장 주조소',cost:160,description:'모든 무장 피해 +10%씩 · 기함에 추가 포탑 장착'},
 {id:'shield',name:'헬리오 방어막 연구소',cost:150,description:'실드 +40씩 · 기함 외부에 에너지 링 추가'},
 {id:'reactor',name:'태양광 공명 반응로',cost:170,description:'스킬 대기 4%씩 감소 · 기함 항성 코어 확장'},
 {id:'logistics',name:'원정 보급 격납고',cost:140,description:'추진 충전 +10%씩 · 영구 호위기 +1씩'},
];
export const SOLAR_CAPITALS=[
 {id:'helios',ship:'sovereign',name:'헬리오스 · 태양 항모',rank:1,cost:650,hull:180,shield:100,power:.1,escorts:4,description:'대형 비행갑판 · 추가 호위기 4대 · 함대 지휘형'},
 {id:'prometheus',ship:'dread',name:'프로메테우스 · 항성 전함',rank:2,cost:900,hull:300,shield:60,power:.25,escorts:1,description:'중장 포탑 · 선체 +300 · 전 무장 화력 +25%'},
 {id:'aurora',ship:'oracle',name:'오로라 · 광자 요새함',rank:3,cost:1200,hull:140,shield:240,power:.15,escorts:2,description:'이중 공명 링 · 실드 +240 · 스킬 대기 -10%'},
];
const rank=n=>Number.isFinite(n)?Math.max(0,Math.min(3,Math.floor(n))):0;
export function cleanSpaceBase(input={}) {
 const facilities=Object.fromEntries(SOLAR_FACILITIES.map(d=>[d.id,rank(input?.facilities?.[d.id])]));
 const owned=SOLAR_CAPITALS.filter(d=>input?.owned?.includes(d.id)).map(d=>d.id);
 return {initialized:input?.initialized===true,sunBuilt:input?.sunBuilt===true,active:input?.active==='sun'?'sun':'earth',facilities,owned,capital:owned.includes(input?.capital)?input.capital:null,fleetHealth:Array.isArray(input?.fleetHealth)?input.fleetHealth.slice(0,10).map(n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):1):[],roster:Array.isArray(input?.roster)?input.roster.filter(id=>Object.hasOwn(FLEET_ROLES,id)).slice(0,10):[]};
}
export function cleanCampaignShip(input={}) {
 const limits={cannon:5,chain:5,missile:5,laser:5,fighter:4,armor:5,shield:5,magnet:4,reactor:4};
 const gear=Object.fromEntries(Object.entries(limits).map(([id,max])=>[id,Math.max(id==='cannon'?1:0,Math.min(max,Number.isFinite(input?.gear?.[id])?Math.floor(input.gear[id]):0))]));
 const ratio=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):1;
 const tuning=Object.fromEntries(TUNING_DEFS.map(d=>[d.id,Math.max(0,Math.min(d.maxLevel,Number.isFinite(input?.tuning?.[d.id])?Math.floor(input.tuning[d.id]):0))]));
 return {gear,tuning,hp:ratio(input?.hp),shield:ratio(input?.shield)};
}
export function solarStats(meta) {
 const b=cleanSpaceBase(meta.spaceBase),f=b.sunBuilt&&meta.campaign?.systemOwned?b.facilities:{};
 const capital=b.sunBuilt&&meta.campaign?.systemOwned?SOLAR_CAPITALS.find(d=>d.id===b.capital&&d.ship===meta.ship):null;
 return {hull:(f.shipyard||0)*60+(capital?.hull||0),shield:(f.shield||0)*40+(capital?.shield||0),power:(f.forge||0)*.1+(capital?.power||0),cooldown:(f.reactor||0)*.04+(capital?.id==='aurora'?.1:0),boostRegen:(f.logistics||0)*.1,escorts:(f.logistics||0)+(capital?.escorts||0),capital};
}
export function solarFacilityLock(meta,id) {
 const b=cleanSpaceBase(meta.spaceBase),d=SOLAR_FACILITIES.find(d=>d.id===id);
 if(!meta.campaign?.systemOwned||!b.sunBuilt)return '태양 궤도 기지 건설 필요';
 if(!d)return '알 수 없는 시설';if(b.facilities[id]>=3)return '최대 단계';
 if(id!=='command'&&b.facilities[id]>=b.facilities.command)return '함대 사령부 '+(b.facilities[id]+1)+'단계 필요';return '';
}
export const solarFacilityCost=(meta,id)=>{const d=SOLAR_FACILITIES.find(d=>d.id===id);return d?d.cost*(cleanSpaceBase(meta.spaceBase).facilities[id]+1)**2:Infinity;};
export const FLEET_BUILD_COST={frigate:120,interceptor:140,support:180,destroyer:240,cruiser:360};
export function solarFleetConstructionState(meta,count){
 const b=cleanSpaceBase(meta.spaceBase),f=b.facilities;
 count??=Math.max(b.roster.length,FLEET_TIERS[meta.fleetRank||0]?.count||0);
 const capacity=f.command?Math.min(10,1+f.command*3):0;
 const requiredCommand=Math.min(3,Math.max(1,Math.ceil(count/3)));
 const reason=!b.sunBuilt?'태양 기지 건설 필요':!f.shipyard?'대형 조선소 1단계 필요':count>=capacity?(f.command>=3?'건조 한도 10척 · 격납고에서 재설계·개조':`함대 사령부 ${requiredCommand}단계 필요 · 한도 ${1+requiredCommand*3}척`):'';
 return {count,capacity,reason};
}
export function persistCampaignShip(sim) {
 if(sim.mode!=='campaign'&&!sim.campaignDock)return;
 const old=cleanCampaignShip(sim.meta.campaignShip);
 if(sim.meta.spaceBase)sim.meta.spaceBase.fleetHealth=sim.fleet.map(a=>a.hp/a.maxHp);
 sim.meta.campaignShip={...old,tuning:Object.fromEntries(TUNING_DEFS.map(d=>[d.id,sim.upgrades[d.id]||0])),hp:sim.player.hp/sim.player.maxHp,shield:sim.player.shield/sim.player.maxShield};
}
// Snapshot once before the caller removes the combat objects. Menu actions must
// not snapshot that cleared world over the damage and equipment just saved.
export function closeCampaignSession(sim) {
 persistCampaignShip(sim);sim.mode='hangar';sim.campaignDock=null;sim.campaign=null;
}
export function prepareCampaignShip(sim) {
 const saved=cleanCampaignShip(sim.meta.campaignShip),extra=solarStats(sim.meta);sim.solar=extra;if(extra.capital)sim.vessel.name=extra.capital.name;
 sim.upgrades={...saved.gear,...saved.tuning};applyTuning(sim.tech,saved.tuning);if(sim.vessel.weapon!=='cannon')sim.upgrades[sim.vessel.weapon]=Math.max(1,sim.upgrades[sim.vessel.weapon]);
 sim.player.maxHp+=saved.gear.armor*35+extra.hull;sim.player.maxShield+=saved.gear.shield*25+extra.shield;
 sim.player.hp=sim.player.maxHp*Math.max(.25,saved.hp);sim.player.shield=sim.player.maxShield*saved.shield;
 sim.stage=extra.capital?2:0;sim.player.radius=extra.capital?4.7:2.1;sim.syncAllies();sim.syncFleet();
 for(const a of sim.fleet){a.hp=a.maxHp*(sim.meta.spaceBase?.fleetHealth?.[a.slot]??1);if(a.hp===0)a.disabled=45;}
}
export function openCampaignBase(sim,location='earth') {
 if(!['menu','ended','base'].includes(sim.phase))return false;
 if(location==='sun'&&!sim.meta.campaign?.systemOwned)return false;
 if(sim.campaignDock)persistCampaignShip(sim);
 sim.meta.spaceBase=cleanSpaceBase(sim.meta.spaceBase);const b=sim.meta.spaceBase;
 if(!b.initialized){b.initialized=true;sim.meta.bank+=80;}
 b.active=location;sim.reset();sim.mode='hangar';sim.campaignDock=location;prepareCampaignShip(sim);sim.phase='base';return true;
}
function spend(sim,cost){if(sim.scrap+sim.meta.bank<cost)return false;const from=Math.min(sim.scrap,cost);sim.scrap-=from;sim.meta.bank-=cost-from;return true;}
export function buildSolar(sim,id) {
 if(sim.phase!=='base'||sim.campaignDock!=='sun'||!sim.meta.campaign?.systemOwned)return false;
 const b=sim.meta.spaceBase;
 if(id==='foundation'){if(b.sunBuilt||!spend(sim,SOLAR_FOUNDATION_COST))return false;b.sunBuilt=true;}
 else {if(solarFacilityLock(sim.meta,id)||!spend(sim,solarFacilityCost(sim.meta,id)))return false;b.facilities[id]++;}
 refreshSolar(sim);return true;
}
function refreshSolar(sim){const previous=sim.solar||solarStats(sim.meta),next=solarStats(sim.meta);sim.solar=next;sim.player.maxHp+=next.hull-previous.hull;sim.player.hp+=next.hull-previous.hull;sim.player.maxShield+=next.shield-previous.shield;sim.player.shield+=next.shield-previous.shield;sim.syncAllies();sim.syncFleet();persistCampaignShip(sim);}
export function buildCapital(sim,id) {
 if(sim.phase!=='base'||sim.campaignDock!=='sun')return false;
 const d=SOLAR_CAPITALS.find(d=>d.id===id),b=sim.meta.spaceBase;
 if(!d||!sim.meta.campaign?.systemOwned||!b.sunBuilt||b.facilities.shipyard<d.rank||b.owned.includes(id)||!spend(sim,d.cost))return false;
 b.owned.push(id);return selectCapital(sim,id);
}
export function selectCapital(sim,id) {
 const b=sim.meta.spaceBase,d=SOLAR_CAPITALS.find(d=>d.id===id);
 if(sim.phase!=='base'||sim.campaignDock!=='sun'||!sim.meta.campaign?.systemOwned||!b?.sunBuilt||!d||!b.owned.includes(id))return false;
 persistCampaignShip(sim);b.capital=id;sim.meta.ship=d.ship;return openCampaignBase(sim,'sun');
}
export function buildFleetShip(sim,role) {
 const b=sim.meta.spaceBase;
 if(sim.phase!=='base'||sim.campaignDock!=='sun'||!sim.meta.campaign?.systemOwned||!b?.sunBuilt||!b.facilities.shipyard||!Object.hasOwn(FLEET_BUILD_COST,role))return false;
 const capacity=b.facilities.command?Math.min(10,1+b.facilities.command*3):0;
 if(sim.fleet.length>=capacity||!spend(sim,FLEET_BUILD_COST[role]))return false;
 b.roster=[...sim.fleet.map(a=>a.role),role];sim.syncFleet();return true;
}

export const fleetRefitCost=role=>Object.hasOwn(FLEET_BUILD_COST,role)?Math.ceil(FLEET_BUILD_COST[role]*.6):Infinity;
export function fleetRefitLock(sim,slot,role) {
 const b=sim.meta.spaceBase;slot=Number(slot);
 if(sim.phase!=='carrier'||sim.carrierPrevious!=='base'||sim.campaignDock!=='sun'||!sim.meta.campaign?.systemOwned)return '태양 기지의 선단 격납고에서 이용할 수 있습니다.';
 if(!b?.sunBuilt||!b.facilities.shipyard)return '태양 기지와 대형 조선소 건설 필요';
 if(!Number.isInteger(slot)||!Object.hasOwn(FLEET_BUILD_COST,role))return '함선과 함종을 다시 선택하세요.';
 const a=sim.fleet.find(a=>a.slot===slot);
 if(!a)return '선택한 함선이 없습니다.';
 if(a.role===role)return '현재 함종입니다.';
 const missing=fleetRefitCost(role)-sim.scrap-sim.meta.bank;
 return missing>0?Math.ceil(missing).toLocaleString('ko-KR')+' 아르켈륨 부족':'';
}
export function refitFleetShip(sim,slot,role) {
 if(fleetRefitLock(sim,slot,role)||!spend(sim,fleetRefitCost(role)))return false;
 const b=sim.meta.spaceBase,a=sim.fleet.find(a=>a.slot===Number(slot));
 const health=a.hp/a.maxHp;a.role=role;b.roster=sim.fleet.map(a=>a.role);sim.syncFleet();a.hp=a.maxHp*health;persistCampaignShip(sim);return true;
}
