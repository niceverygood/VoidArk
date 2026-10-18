import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,cleanMeta} from '../src/sim.js';
import {updateSolarCampaign,CAMPAIGN_STAGES} from '../src/solar-campaign.js';
import {campaignDebrief,expeditionTarget,prepareExpedition,validateExpeditionTarget} from '../src/campaign-debrief.js';
import {preparationState} from '../src/base-preparation.js';
function settle(s,index,remote=false){assert.equal(remote?s.startExpedition(index):s.startCampaign(index),true);s.scrap=37.8;s.campaign.phase='landing';s.campaign.landing={...s.player.position};updateSolarCampaign(s,.01);return campaignDebrief(s.result,s.meta);}
test('first capture separates exact loot, operation and one-time award without double settlement',()=>{
 const s=new Simulation({bank:1234,spaceBase:{initialized:true},conquest:{'planet-0':[0]},research:{hull:2}}),d=settle(s,0);
 assert.deepEqual([d.loot,d.operation,d.first,d.total,d.bank],[37,120,200,357,1591]);assert.equal(d.target.stage.name,'금성');assert.equal(d.target.stage.reward,300);
 const saved=structuredClone(s.meta);updateSolarCampaign(s,1);assert.deepEqual(s.meta,saved);assert.equal(d.total,s.result.banked);
 assert.equal(prepareExpedition(s,d.target),true);assert.equal(preparationState(s).next.name,'금성');assert.equal(s.meta.bank,1591);assert.deepEqual(s.meta.conquest,saved.conquest);assert.deepEqual(s.meta.research,saved.research);
 assert.equal(s.startCampaign(preparationState(s).index),true);assert.equal(s.preparedCampaignTarget,undefined);
});
test('replayed captured planet never promises a repeated first reward; next target follows saved frontier',()=>{
 const s=new Simulation({bank:500,campaign:{cleared:3},spaceBase:{initialized:true}}),d=settle(s,0);
 assert.deepEqual([d.loot,d.operation,d.first,d.total],[37,120,0,157]);assert.equal(d.target.stage.name,'목성');assert.equal(d.target.stage.reward,500);assert.equal(s.meta.campaign.cleared,3);
});
test('Solar completion opens a free Andromeda sortie but does not grant a free base/capital/fleet',()=>{
 const s=new Simulation({bank:0,campaign:{cleared:7},spaceBase:{initialized:true}}),d=settle(s,7);
 assert.equal(d.first,900);assert.equal(d.target.stage.name,'이리스');assert.equal(d.target.chapter,'andromeda');assert.equal(d.target.index,0);assert.equal(d.target.stage.reward,1100);
 assert.equal(d.unlocks[0].status,'건설 가능');assert.equal(d.unlocks.find(u=>u.name==='영구 원정 선단').status,'현재 선단 0척 · 추가 건조 한도 0척 · 태양 기지 건설 필요');assert.equal(d.unlocks.find(u=>u.name==='안드로메다 원정').status,'출격 가능 · 무료');
 assert.equal(prepareExpedition(s,d.target),true);assert.equal(s.campaignDock,'sun');const state=preparationState(s);assert.equal(state.next.name,'이리스');assert.equal(state.chapter,'andromeda');assert.equal(s.meta.spaceBase.sunBuilt,false);assert.equal(s.startExpedition(state.index),true);
});
test('selected owned capital and facility prerequisites reflect actual state and remain stable across save reload',()=>{
 const meta=cleanMeta({bank:1000,ship:'sovereign',campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,owned:['helios'],capital:'helios',facilities:{command:2,shipyard:1}}});
 const d=campaignDebrief({victory:true,campaign:{index:7,reward:0}},meta);
 assert.equal(d.unlocks.find(u=>u.name.includes('헬리오스')).status,'지휘 중');assert.equal(d.unlocks.find(u=>u.name.includes('프로메테우스')).status,'조선소 2단계 필요');assert.equal(d.unlocks.find(u=>u.name==='영구 원정 선단').status,'현재 선단 0척 · 추가 건조 한도 7척 · 추가 건조 가능');
 assert.deepEqual(campaignDebrief({victory:true,campaign:{index:7,reward:0}},JSON.parse(JSON.stringify(meta))),d);
});
test('failed old stage prepares the same unlocked target rather than the later frontier and settles 70 percent',()=>{
 const s=new Simulation({bank:300,campaign:{cleared:4},spaceBase:{initialized:true}});s.startCampaign(1);s.scrap=37.8;s.finish(false);const d=campaignDebrief(s.result,s.meta);
 assert.deepEqual([d.loot,d.operation,d.first,d.total],[26,12,0,38]);assert.equal(d.target.stage.name,'금성');assert.equal(d.target.retry,true);assert.equal(prepareExpedition(s,d.target),true);assert.equal(preparationState(s).index,1);assert.equal(s.meta.campaign.cleared,4);
});
test('Andromeda advances across systems and completion honestly offers a replay without another galaxy',()=>{
 const s=new Simulation({campaign:{cleared:8,andromedaCleared:2},spaceBase:{initialized:true}}),d=settle(s,2,true);assert.equal(d.target.stage.name,'신더');assert.equal(d.target.stage.system.name,'벨카르 행성계');assert.equal(d.target.stage.reward,CAMPAIGN_STAGES[11].reward);assert.equal(prepareExpedition(s,d.target),true);assert.equal(preparationState(s).index,3);
 const end=new Simulation({campaign:{cleared:8,andromedaCleared:8},spaceBase:{initialized:true}}),last=settle(end,8,true);assert.equal(last.target.completed,true);assert.equal(last.target.replay,true);assert.equal(last.target.stage.name,'에테리온');assert.equal(last.first,7300);assert.equal(expeditionTarget(JSON.parse(JSON.stringify(end.meta))).completed,true);
});
test('invalid or locked prepared targets cannot mutate phase, resources or saved equipment',()=>{
 const s=new Simulation({bank:50,spaceBase:{initialized:true},campaignShip:{gear:{missile:2}}}),before=structuredClone(s.meta);
 for(const target of [{chapter:'andromeda',index:0},{chapter:'solar',index:1},{chapter:'solar',index:-1},{chapter:'solar',index:Infinity},{chapter:'bogus',index:0}]){assert.equal(validateExpeditionTarget(s.meta,target),false);assert.equal(prepareExpedition(s,target),false);assert.deepEqual(s.meta,before);assert.equal(s.phase,'menu');}
});

test('unlock availability agrees with insufficient resources and a full fleet',()=>{
 const low=new Simulation({bank:399,campaign:{cleared:8},spaceBase:{initialized:true}});low.openCampaignBase('sun');let d=campaignDebrief({victory:true,campaign:{index:7,reward:0}},low.meta);
 assert.equal(d.unlocks[0].status,'자원 부족');assert.equal(low.buildSolar('foundation'),false);low.meta.bank=400;assert.equal(low.buildSolar('foundation'),true);
 const full=new Simulation({bank:2000,fleetRank:3,campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,facilities:{command:1,shipyard:1}}});full.openCampaignBase('sun');d=campaignDebrief({victory:true,campaign:{index:7,reward:0}},full.meta);
 assert.equal(d.unlocks.find(u=>u.name==='영구 원정 선단').status,'현재 선단 5척 · 추가 건조 한도 4척 · 함대 사령부 2단계 필요 · 한도 7척');assert.equal(full.buildFleetShip('frigate'),false);
});
