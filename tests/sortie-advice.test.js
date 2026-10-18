import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,cleanMeta} from '../src/sim.js';
import {CAMPAIGN_STAGES,updateSolarCampaign} from '../src/solar-campaign.js';
import {configureAndromedaBoss,updateAndromedaBoss} from '../src/andromeda-boss.js';
import {SortieRecord,cleanSortieRecord,sortieConfiguration} from '../src/sortie-record.js';
import {sortieAdvice,sortieSummaryMarkup} from '../src/sortie-advice.js';
import {bossInvestmentReport} from '../src/boss-investments.js';
import {preparationState} from '../src/base-preparation.js';
import {expeditionTarget,prepareExpedition,debriefMarkup} from '../src/campaign-debrief.js';
const setup=(index=8)=>{const s=new Simulation({bank:1000,campaign:{cleared:Math.min(8,index),andromedaCleared:Math.max(0,index-8)},spaceBase:{initialized:true},fleetRank:1,campaignShip:{gear:{cannon:2,missile:1}}},41);s.openCampaignBase('earth');assert.ok(index<8?s.startCampaign(index):s.startExpedition(index-8));return s;};
test('actual damage, device openings, support and interception are recorded without changing rules/events/RNG',()=>{
 const a=setup(),b=setup();b.sortieRecorder=null;
 for(const s of [a,b]){
  s.enemies=[];const e=s.spawn('boss',{x:0,y:0,z:-20},false,true);Object.assign(e,{campaignBoss:'crown',maxHp:1000,hp:1000});configureAndromedaBoss(e,CAMPAIGN_STAGES[8]);
  s.damageEnemy(e,20,'chain');e.tactics.attack={};e.stun=1;updateAndromedaBoss(s,e,.01);
  s.player.hit=0;s.player.shield=5;s.damagePlayer(20,'projectile');
  s.fleet[0].role='support';s.fleet[1].role='interceptor';s.syncFleet();s.player.hp-=10;s.player.lastDamage=-10;s.updateFleet(.01);
  const interceptor=s.fleet[1];s.shot({...interceptor.position},null,5,'enemyMissile',false);s.updateFleet(.01);
  s.damageFleet(s.fleet[0],1e6,'laser');
 }
 assert.deepEqual(a.player,b.player);assert.deepEqual(a.fleet,b.fleet);assert.deepEqual(a.enemies,b.enemies);assert.deepEqual(a.drainEvents(),b.drainEvents());assert.equal(a.random(),b.random());
 const r=a.sortieRecorder.finish(a,false,Date.now());assert.equal(r.hull,15);assert.equal(r.shield,5);assert.equal(r.causes.projectile,20);assert.equal(r.bosses[0].hits,1);assert.equal(r.bosses[0].interrupt,1);assert.ok(r.bosses[0].deviceDamage>0);assert.ok(r.supportHull>0);assert.ok(r.intercepts>0);assert.equal(r.fleetDisabled,1);
});
test('all campaign results persist one bounded record and recovery/next selection spend nothing',()=>{
 for(const i of [0,3,7,8,11,16]){const s=setup(i);s.time=12;s.player.shield=0;s.damagePlayer(10,'contact');s.finish(false);const bank=s.meta.bank,r=structuredClone(s.meta.lastSortie);assert.equal(r.stage,i);assert.deepEqual(s.result.sortieRecord,r);s.finish(false);assert.equal(s.meta.bank,bank);assert.deepEqual(s.meta.lastSortie,r);
  const restored=new Simulation(cleanMeta(JSON.parse(JSON.stringify(s.meta))));assert.deepEqual(restored.meta.lastSortie,r);assert.ok(prepareExpedition(restored,expeditionTarget(restored.meta,s.result)));assert.equal(restored.meta.bank,bank);assert.equal(sortieAdvice(restored.meta,preparationState(restored).next).status,'valid');assert.ok(bossInvestmentReport(restored,preparationState(restored)).rows.every(q=>q.evidence));}
});
test('victory transitions Mercury to Venus and Pluto to Andromeda using current target doctrine',()=>{
 for(const i of [0,7]){const s=setup(i);s.campaign.phase='landing';s.campaign.landing={...s.player.position};s.time=20;updateSolarCampaign(s,.01);const target=expeditionTarget(s.meta,s.result);assert.ok(prepareExpedition(s,target));const advice=sortieAdvice(s.meta,preparationState(s).next);assert.equal(advice.status,'valid');assert.match(advice.transition,new RegExp(i===0?'수성.*금성':'명왕성.*이리스'));if(i===7)assert.match(advice.reasons.weapon,/다른 전술/);assert.match(debriefMarkup({...s.result,campaign:{index:i,chapter:'solar'},sortieRecord:s.meta.lastSortie},s.meta),/정비소에서 검토할 세 투자/);}
});
test('first, short, stale, changed and corrupted records fall back without attributing causes',()=>{
 const s=setup();s.time=20;s.finish(false);const next=CAMPAIGN_STAGES[8],meta=structuredClone(s.meta),now=meta.lastSortie.at;
 assert.equal(sortieAdvice({...meta,lastSortie:null},next,now).status,'first');
 assert.equal(sortieAdvice(meta,next,now+8*864e5).status,'stale');assert.equal(sortieAdvice({...meta,runs:meta.runs+3},next,now).status,'stale');
 const changed=structuredClone(meta);changed.campaignShip.gear.missile++;assert.equal(sortieAdvice(changed,next,now).status,'changed');assert.deepEqual(sortieAdvice(changed,next,now).reasons,{weapon:'',survival:'',escort:''});
 meta.lastSortie.duration=2;assert.equal(sortieAdvice(meta,next,now).status,'partial');
 assert.equal(cleanSortieRecord({...meta.lastSortie,version:99}),null);assert.equal(cleanSortieRecord({...meta.lastSortie,stage:17}),null);assert.equal(cleanSortieRecord({...meta.lastSortie,bosses:{find:1}}).bosses.length,0);
 const oversized={...meta.lastSortie,arbitrary:'x'.repeat(1e5),bosses:Array(1000).fill({rank:'crown',damage:Infinity,hits:1e99}),causes:{projectile:Infinity}};const r=cleanSortieRecord(oversized);assert.ok(JSON.stringify(r).length<1400);assert.equal(r.bosses.length,1);assert.equal(r.causes.projectile,0);assert.ok(!JSON.stringify(r).includes('arbitrary'));
});
test('repair and wallet changes retain relevance; new upgrades and permanent fleet roles invalidate it',()=>{
 const s=setup();s.time=20;s.finish(false);prepareExpedition(s,expeditionTarget(s.meta,s.result));const stage=preparationState(s).next,signature=sortieConfiguration(s.meta);s.meta.bank+=100;s.serviceBase('repair');assert.equal(sortieConfiguration(s.meta),signature);assert.equal(sortieAdvice(s.meta,stage).status,'valid');s.installEquipment('missile');assert.equal(sortieAdvice(s.meta,stage).status,'changed');assert.match(sortieSummaryMarkup(s.meta,stage),/구성이 바뀜/);
});
test('boundary drain uses actual lost health, and a long sortie maintains a constant-size record',()=>{
 const s=setup(3);s.player.position.x=700;s.campaign.outsideTime=5;s.player.shield=1;updateSolarCampaign(s,.05);assert.equal(s.sortieRecorder.shield,1);assert.ok(s.sortieRecorder.causes.boundary>1);
 const r=new SortieRecord(3);for(let i=0;i<100000;i++)r.damage(1,2,'projectile');assert.equal(r.hull,100000);assert.ok(JSON.stringify(r.finish(s,false)).length<1400);
});
