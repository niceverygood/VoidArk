import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,UPGRADE_DEFS} from '../src/sim.js';
import {preparationState} from '../src/base-preparation.js';
import {bossInvestmentReport,applyBossInvestment,bossWeaponSample,bossInvestmentsMarkup} from '../src/boss-investments.js';
import {preparationBudget} from '../src/campaign-economy.js';
import {campaignCommanderStats} from '../src/solar-campaign.js';
const base=(meta={})=>{const s=new Simulation({bank:3000,campaign:{cleared:3},...meta,spaceBase:{initialized:true,...meta.spaceBase}});s.openCampaignBase('earth');return s;};
const snapshot=s=>structuredClone({meta:s.meta,player:s.player,gear:s.upgrades,fleet:s.fleet,allies:s.allies,events:s.events,scrap:s.scrap,phase:s.phase,war:s.war.snapshot()});

test('first installation, later upgrade and fleet refit describe the actual quoted operation',()=>{
 const s=base({campaign:{cleared:1},fleetRank:1}),state=preparationState(s),first=bossInvestmentReport(s,state).rows[1];
 assert.equal(first.level,0);assert.equal(first.verb,'설치');assert.match(bossInvestmentsMarkup(s,state),/data-confirm-verb="설치"/);
 assert.equal(applyBossInvestment(s,state,'survival',first.token),true);
 const next=bossInvestmentReport(s,state);assert.equal(next.rows[1].verb,'강화');assert.equal(next.rows[2].verb,'개조');
 const markup=bossInvestmentsMarkup(s,state);assert.match(markup,/50 아르켈륨 · 개조 확인/);
 const empty=base({campaign:{cleared:8}});assert.equal(bossInvestmentReport(empty,preparationState(empty)).rows[2].verb,'건조');
});

test('preview never invokes runtime wrappers bound to the live game instance',()=>{
 const s=base({campaign:{cleared:8},fleetRank:1}),before=snapshot(s);let calls=0;
 for(const name of ['serviceBase','chooseUpgrade','openCarrier','upgradeFleet','closeCarrier','openCampaignBase','buildSolar','buildFleetShip']){const original=s[name].bind(s);s[name]=(...args)=>{calls++;return original(...args);};}
 bossInvestmentReport(s,preparationState(s));assert.equal(calls,0);assert.deepEqual(snapshot(s),before);
 const empty=base({campaign:{cleared:8}}),emptyBefore=snapshot(empty);empty.openCampaignBase=()=>{throw Error('live-bound wrapper invoked');};bossInvestmentReport(empty,preparationState(empty));assert.deepEqual(snapshot(empty),emptyBefore);
});

test('three investment categories are pure, doctrine-specific and include current repair reserve',()=>{
 for(const [progress,weapon] of [[0,'chain'],[3,'missile'],[6,'cannon']]){
  const s=base({campaign:{cleared:8,andromedaCleared:progress},campaignShip:{hp:.25,shield:0},fleetRank:2}),before=snapshot(s),r=bossInvestmentReport(s,preparationState(s));
  assert.deepEqual(r.rows.map(q=>q.key),['weapon','survival','escort']);assert.equal(r.rows[0].id,weapon);
  assert.equal(r.reserve,preparationBudget(s).reserve);for(const q of r.rows){assert.equal(q.total,q.cost+r.reserve);assert.equal(q.shortfall,Math.max(0,q.total-r.balance));}
  assert.deepEqual(snapshot(s),before);assert.ok(r.rows[0].metrics.find(m=>m.label==='장치 단발 피해').after>0);
 }
});
test('previewed weapon damage and survival capacity match actual one-time confirmed purchases',()=>{
 const s=base({campaign:{cleared:8},campaignShip:{gear:{cannon:3,chain:2},tuning:{chainPower:2},hp:.4,shield:.2},research:{reactor:2}}),state=preparationState(s),q=bossInvestmentReport(s,state).rows[0],bank=s.meta.bank;
 assert.equal(applyBossInvestment(s,state,'weapon',q.token),true);assert.equal(s.meta.bank,bank-q.cost);assert.equal(s.phase,'base');
 const actual=bossWeaponSample(s,q.id,state.next);assert.equal(actual.damage,q.metrics.find(m=>m.label==='보스 단발 피해').after);
 assert.equal(actual.guard,q.metrics.find(m=>m.label==='장치 단발 피해').after);
 assert.equal(bossWeaponSample(s,q.id,state.next,true).damage,q.metrics.find(m=>m.label==='코어 노출 피해').after);
 const guard=bossInvestmentReport(s,state).rows[1];assert.equal(applyBossInvestment(s,state,'survival',guard.token),true);
 assert.equal(s.player.maxHp,guard.metrics.find(m=>m.label==='최대 선체').after);assert.equal(s.player.maxShield,guard.metrics.find(m=>m.label==='최대 실드').after);
 const saved=structuredClone(s.meta.campaignShip);s.openCampaignBase('earth');assert.deepEqual(s.meta.campaignShip.gear,saved.gear);assert.deepEqual(s.meta.campaignShip.tuning,saved.tuning);
});
test('resource failure and stale confirmations leave all state unchanged',()=>{
 const s=base({bank:0}),before=snapshot(s);assert.equal(applyBossInvestment(s,preparationState(s),'weapon'),false);assert.deepEqual(snapshot(s),before);
 s.meta.bank=1000;const q=bossInvestmentReport(s,preparationState(s)).rows[0];s.installEquipment(q.id);const changed=snapshot(s);
 assert.equal(applyBossInvestment(s,preparationState(s),'weapon',q.token),false);assert.deepEqual(snapshot(s),changed);
});
test('fully maxed equipment and fleets produce a free existing-tactics alternative, without invalid purchases',()=>{
 const gear=Object.fromEntries(UPGRADE_DEFS.map(d=>[d.id,d.maxLevel]));
 const s=base({campaign:{cleared:8},campaignShip:{gear},fleetRank:1,fleetUpgrades:Array.from({length:10},()=>({weapon:3,armor:3,engine:3,special:3}))}),before=snapshot(s),r=bossInvestmentReport(s,preparationState(s));
 for(const q of r.rows){assert.equal(q.complete,true);assert.equal(q.cost,0);assert.equal(q.affordable,false);assert.equal(applyBossInvestment(s,preparationState(s),q.key),false);}
 assert.deepEqual(snapshot(s),before);
});
test('no-fleet early campaign explains level unlock and prevents future construction spending',()=>{
 const s=base({bank:5000}),before=snapshot(s),q=bossInvestmentReport(s,preparationState(s)).rows[2];
 assert.equal(q.locked,true);assert.match(q.load,/LV.6.*2척 무료/);assert.equal(q.cost,920);assert.equal(q.steps.reduce((n,d)=>n+d.cost,0),q.cost);
 assert.equal(applyBossInvestment(s,preparationState(s),'escort'),false);assert.deepEqual(snapshot(s),before);
});
test('galaxy-ready first escort pays prerequisites once, preserves scrap and matches built configuration',()=>{
 const s=base({bank:900,campaign:{cleared:8},campaignShip:{gear:{cannon:4,armor:2},tuning:{cannonPower:2}},conquest:{'planet-0':[0]}});s.scrap=200;
 const q=bossInvestmentReport(s,preparationState(s)).rows[2],original=structuredClone(s.meta),balance=s.meta.bank+s.scrap;
 assert.equal(q.cost,980);assert.equal(applyBossInvestment(s,preparationState(s),'escort',q.token),true);
 assert.equal(s.meta.bank+s.scrap,balance-q.cost);assert.equal(s.campaignDock,'sun');assert.equal(s.phase,'base');assert.equal(s.fleet.length,1);
 assert.equal(s.fleet[0].maxHp,q.metrics.find(m=>m.label==='새 함선 최대 선체').after);assert.deepEqual(s.fleet[0].configuration,q.afterConfiguration);
 assert.deepEqual(s.meta.campaign,original.campaign);assert.deepEqual(s.meta.conquest,original.conquest);assert.deepEqual(s.meta.campaignShip.gear,original.campaignShip.gear);assert.deepEqual(s.meta.campaignShip.tuning,original.campaignShip.tuning);
 const s2=base({campaign:{cleared:8},spaceBase:{sunBuilt:true,facilities:{command:1,shipyard:1}}});assert.equal(bossInvestmentReport(s2,preparationState(s2)).rows[2].cost,180);
});
test('existing interceptor special upgrade matches preview and adds no units; dead escorts retain recovery state',()=>{
 const s=base({campaign:{cleared:8,andromedaCleared:6},fleetRank:1,spaceBase:{sunBuilt:true,facilities:{command:1,shipyard:1},roster:['interceptor','support'],fleetHealth:[0,1]}}),q=bossInvestmentReport(s,preparationState(s)).rows[2],count=s.fleet.length,bank=s.meta.bank;
 assert.equal(q.slot,0);assert.equal(q.id,'special');assert.equal(applyBossInvestment(s,preparationState(s),'escort',q.token),true);
 assert.equal(s.meta.bank,bank-q.cost);assert.equal(s.fleet.length,count);assert.equal(s.fleet[0].hp,0);assert.equal(s.fleet[0].configuration.interceptRange,q.metrics.find(m=>m.label==='요격 반경').after);assert.deepEqual(s.fleet[0].configuration,q.afterConfiguration);assert.equal(s.phase,'base');
});

test('partially maxed loadouts fall back to real reactor cooldown and non-interceptor specialization range',()=>{
 const s=base({campaign:{cleared:8,andromedaCleared:3},fleetRank:1,campaignShip:{gear:{armor:5,shield:5,reactor:3,missile:5,laser:5}},fleetUpgrades:[{weapon:3,armor:3,engine:3,special:0},{weapon:3,armor:3,engine:3,special:3}]}),r=bossInvestmentReport(s,preparationState(s));
 assert.equal(r.rows[0].id,'reactor');assert.equal(r.rows[1].id,'reactor');assert.ok(r.rows[1].metrics.find(m=>m.label==='스킬 대기 배율').after<r.rows[1].metrics.find(m=>m.label==='스킬 대기 배율').before);assert.match(r.rows[1].reason,/Z\/C 회피 대기/);
 const q=r.rows[2];assert.equal(q.id,'special');const range=q.metrics.find(m=>m.label==='무장 사거리');assert.ok(range.after>range.before);assert.equal(applyBossInvestment(s,preparationState(s),'escort',q.token),true);assert.equal(s.fleet[0].configuration.range,range.after);
});

test('maxed weapon samples obey the actual governor device hit cap instead of a synthetic HP cap',()=>{
 const s=base({campaign:{cleared:8,andromedaCleared:3},campaignShip:{gear:{missile:5,reactor:4}}}),stage=preparationState(s).next,stats=campaignCommanderStats(stage),sample=bossWeaponSample(s,'missile',stage);
 assert.ok(Math.abs(sample.guard-stats.maxHp*.45*.08)<1e-6);assert.ok(sample.damage>0);
 assert.equal(stats.hp,stats.maxHp);assert.ok(campaignCommanderStats(stage,'warden').maxHp<stats.maxHp);
});
