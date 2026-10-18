import {Simulation} from './sim.js';
import {SOLAR_FOUNDATION_COST,SOLAR_FACILITIES,SOLAR_CAPITALS,FLEET_BUILD_COST,solarFacilityCost,solarFacilityLock,solarFleetConstructionState} from './space-bases.js';
import {FLEET_ROLES} from './fleet.js';

const money=s=>s.scrap+s.meta.bank;
const fingerprint=s=>JSON.stringify([s.phase,s.campaignDock,s.scrap,s.meta,s.fleet.map(a=>[a.slot,a.role,a.upgrades])]);
const methods={solar:'buildSolar',capital:'buildCapital',fleet:'buildFleetShip'};
const n=v=>Math.round(v).toLocaleString('ko-KR');
export function solarFleetConstructionGuide(sim){
 return solarFleetConstructionState(sim.meta,sim.fleet.length);
}
export function solarPurchaseQuote(sim,kind,id){
 const b=sim.meta.spaceBase,f=b?.facilities||{},capacity=f.command?Math.min(10,1+f.command*3):0;
 let cost=Infinity,name='',reason='',verb='건설';
 if(sim.phase!=='base'||sim.campaignDock!=='sun'||!sim.meta.campaign?.systemOwned)reason='태양계 점령 후 태양 기지에서 이용할 수 있습니다.';
 if(kind==='solar'){
  const d=SOLAR_FACILITIES.find(d=>d.id===id);cost=id==='foundation'?SOLAR_FOUNDATION_COST:solarFacilityCost(sim.meta,id);name=id==='foundation'?'태양 궤도 성채':d?.name||'시설';
  reason ||= id==='foundation'?(b?.sunBuilt?'이미 건설된 기지입니다.':''):solarFacilityLock(sim.meta,id);
  if(f[id])verb='증축';
 }else if(kind==='capital'){
  const d=SOLAR_CAPITALS.find(d=>d.id===id);cost=d?.cost??Infinity;name=d?.name||'기함';verb='제작';
  reason ||= !d?'알 수 없는 기함입니다.':!b?.sunBuilt?'태양 기지 건설 필요':b.owned.includes(id)?'이미 보유한 기함입니다.':f.shipyard<d.rank?`대형 조선소 ${d.rank}단계 필요`:'';
 }else if(kind==='fleet'){
  cost=FLEET_BUILD_COST[id]??Infinity;name=FLEET_ROLES[id]?.name||'함선';verb='건조';
  reason ||= !FLEET_ROLES[id]?'알 수 없는 함종입니다.':solarFleetConstructionGuide(sim).reason;
 }else reason='알 수 없는 구매입니다.';
 const balance=money(sim);reason ||= balance<cost?`${n(cost-balance)} 아르켈륨 부족`:'';
 const q={kind,id,cost,name,verb,balance,remaining:balance-cost,reason,eligible:!reason,token:fingerprint(sim)};
 if(!q.eligible)return q;
 // Disposable rules-only copy: quote the actual resulting hull and fleet,
 // without changing the live simulation, resources, events or saved metadata.
 const trial=new Simulation(structuredClone(sim.meta));trial.openCampaignBase('sun');trial.scrap=sim.scrap;
 const before={hull:trial.player.maxHp,shield:trial.player.maxShield,power:trial.power(),cooldown:trial.solar.cooldown,escorts:trial.solar.escorts};
 if(!trial[methods[kind]](id))return {...q,eligible:false,reason:'구매 조건을 다시 확인하세요.'};
 const effects=[];
 if(kind==='solar')effects.push(id==='foundation'?'태양 궤도 성채 활성화 · 항성 시설 건설 해금':`${name} 단계 ${f[id]} → ${trial.meta.spaceBase.facilities[id]}`);
 if(kind==='capital')effects.push(`${sim.vessel.name} → ${trial.vessel.name} · 제작 후 지휘 기함으로 선택`);
 if(kind==='fleet'){const a=trial.fleet.at(-1);q.afterConfiguration=structuredClone(a.configuration);effects.push(`선단 ${sim.fleet.length} → ${trial.fleet.length} / ${capacity}척`,`${name} 선체 ${n(a.maxHp)} · 기본 화력 ${n(a.configuration.damage)} · 사거리 ${n(a.configuration.range)}m`);}
 if(id==='command'){
  const nextCapacity=Math.min(10,1+trial.meta.spaceBase.facilities.command*3);
  effects.push(`추가 건조 한도 ${capacity} → ${nextCapacity}척`);
  if(sim.fleet.length>nextCapacity)effects.push(`현재 선단 ${sim.fleet.length}척 유지 · 추가 건조에는 사령부 증축 필요`);
 }
 if(before.hull!==trial.player.maxHp)effects.push(`기함 최대 선체 ${n(before.hull)} → ${n(trial.player.maxHp)}`);
 if(before.shield!==trial.player.maxShield)effects.push(`기함 최대 실드 ${n(before.shield)} → ${n(trial.player.maxShield)}`);
 if(Math.abs(before.power-trial.power())>1e-8)effects.push(`현재 무장 피해 배율 ${before.power.toFixed(2)} → ${trial.power().toFixed(2)}`);
 if(before.cooldown!==trial.solar.cooldown)effects.push(`항성 스킬 대기 감소 ${n(before.cooldown*100)}% → ${n(trial.solar.cooldown*100)}%`);
 if(before.escorts!==trial.solar.escorts)effects.push(`항성 호위기 ${before.escorts} → ${trial.solar.escorts}대`);
 if(id==='logistics')effects.push(`항성 추진 충전 보너스 +${n(trial.solar.boostRegen*100)}%`);
 q.effect=effects.join(' · ');return q;
}

export function createSolarPurchase(sim,kind,id){
 const quote=solarPurchaseQuote(sim,kind,id);let closed=false;
 return {quote,cancel(){closed=true;},commit(){
  if(closed)return false;closed=true;
  if(!quote.eligible||fingerprint(sim)!==quote.token)return false;
  return sim[methods[kind]](id);
 }};
}
