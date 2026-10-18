import {Simulation} from './sim.js';
import {FLEET_ROLES} from './fleet.js';
import {fleetRefitCost,fleetRefitLock} from './space-bases.js';

const fingerprint=s=>JSON.stringify([s.phase,s.carrierPrevious,s.campaignDock,s.scrap,s.meta,s.fleet.map(a=>[a.slot,a.role,a.upgrades,a.hp,a.maxHp,a.disabled])]);
const n=value=>Math.round(value).toLocaleString('ko-KR');
export function fleetRefitQuote(sim,slot,role){
 slot=Number(slot);
 const reason=fleetRefitLock(sim,slot,role),cost=fleetRefitCost(role),balance=sim.scrap+sim.meta.bank;
 const q={slot,role,cost,balance,remaining:balance-cost,name:FLEET_ROLES[role]?.name||'함선',verb:'재설계',reason,eligible:!reason,token:fingerprint(sim)};
 if(!q.eligible)return q;
 // Apply the real rules to an isolated copy, including the current damage and
 // upgrades. Quoting must never heal, spend or save the live fleet.
 const trial=new Simulation(structuredClone(sim.meta));
 trial.openCampaignBase('sun');trial.openCarrier();trial.scrap=sim.scrap;
 trial.fleet=structuredClone(sim.fleet);
 const old=trial.fleet.find(a=>a.slot===slot),before=structuredClone(old);
 if(!trial.refitFleetShip(slot,role))return {...q,eligible:false,reason:'재설계 조건을 다시 확인하세요.'};
 const after=trial.fleet.find(a=>a.slot===slot),a=before.configuration,b=after.configuration;
 q.beforeConfiguration=structuredClone(a);q.afterConfiguration=structuredClone(b);
 q.effect=[`${a.name} → ${b.name}`,`최대 내구도 ${n(before.maxHp)} → ${n(after.maxHp)}`,`기본 공격력 ${n(a.damage)} → ${n(b.damage)}`,`공격 간격 ${a.cooldown.toFixed(1)} → ${b.cooldown.toFixed(1)}초`,`사거리 ${n(a.range)} → ${n(b.range)}m`,`개조 단계 유지 · 현재 내구도 비율 ${n(before.hp/before.maxHp*100)}% 유지 · 수리는 별도`];
 if(role==='support')q.effect.push(`주변 선단 수복 ${ (2.5*b.support).toFixed(1)} / 초 · 기함 선체 수복 ${(0.8*b.support).toFixed(1)} / 초`);
 if(role==='interceptor')q.effect.push(`엄호 명령 중 탄환 요격 거리 ${n(b.interceptRange)}m`);
 q.effect=q.effect.join(' · ');
 return q;
}
export function createFleetRefit(sim,slot,role){
 const quote=fleetRefitQuote(sim,slot,role);let closed=false;
 return {quote,cancel(){closed=true;},commit(){
  if(closed)return false;closed=true;
  if(!quote.eligible||fingerprint(sim)!==quote.token)return false;
  return sim.refitFleetShip(quote.slot,quote.role);
 }};
}
