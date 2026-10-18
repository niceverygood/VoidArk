import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {CAMPAIGN_STAGES,updateSolarCampaign,campaignObjectiveProgress} from '../src/solar-campaign.js';
import {expeditionTarget,prepareExpedition} from '../src/campaign-debrief.js';
const ready=(index=0,replay=false)=>{const remote=index>=8,s=new Simulation({bank:1000,campaign:{cleared:remote?8:replay?index+1:index,andromedaCleared:remote?index-8+(replay?1:0):0},spaceBase:{initialized:true}},37);assert.equal(remote?s.startExpedition(index-8):s.startCampaign(index),true);return s;};
function kill(s,base=false){const e=s.spawn(base?'planetBase':'swarm',{x:80,y:0,z:0});if(base)e.campaignBase=true;s.damageEnemy(e,1e9,'reactor');}
test('objective snapshot uses actual campaign counters, not total kills, without borrowing the live state',()=>{
 const s=ready();s.enemies=[];kill(s);kill(s);kill(s,true);assert.equal(s.kills,3);assert.equal(s.campaign.combatKills,2);assert.equal(s.campaign.baseKills,1);
 const before=structuredClone([s.meta,s.events,s.campaign]),p=campaignObjectiveProgress(s);assert.deepEqual([s.meta,s.events,s.campaign],before);assert.equal(p.combatKills,2);assert.equal(p.baseKills,1);assert.equal(p.combatRequired,CAMPAIGN_STAGES[0].kills);assert.equal(p.basesRequired,CAMPAIGN_STAGES[0].bases);
 s.finish(false);const snapshot=structuredClone(s.result.objectiveProgress);s.campaign.combatKills++;s.campaign.baseKills++;assert.deepEqual(s.result.objectiveProgress,snapshot);assert.notEqual(s.result.objectiveProgress,p);
});
test('early level bosses can both be defeated while the blockade and fortresses remain unfinished',()=>{
 const s=ready();s.level=4;updateSolarCampaign(s,0);s.damageEnemy(s.enemies.find(e=>e.campaignBoss==='warden'),1e9,'reactor');s.level=8;updateSolarCampaign(s,0);s.damageEnemy(s.enemies.find(e=>e.campaignBoss==='crown'),1e9,'reactor');updateSolarCampaign(s,0);
 assert.equal(s.campaign.phase,'blockade');assert.equal(s.campaign.combatKills,0);assert.equal(s.campaign.baseKills,0);s.finish(false);assert.equal(s.result.objectiveProgress.wardenDefeated,true);assert.equal(s.result.objectiveProgress.crownDefeated,true);assert.equal(s.result.objectiveProgress.landed,false);assert.equal(s.result.victory,false);assert.equal(s.meta.campaign.cleared,0);
});
test('immediate defeat preserves the ending snapshot through duplicate finish, base return and re-sortie',()=>{
 const s=ready();kill(s);s.player.shield=0;s.player.hp=1;s.player.lastDamage=-99;s.drainEvents();s.damagePlayer(1e9,'projectile');assert.equal(s.phase,'ended');const result=s.result,p=structuredClone(result.objectiveProgress),bank=s.meta.bank;assert.equal(s.drainEvents().filter(e=>e.type==='end').length,1);
 s.campaign.baseKills++;s.finish(true);assert.equal(s.result,result);assert.equal(s.meta.bank,bank);assert.deepEqual(result.objectiveProgress,p);assert(prepareExpedition(s,expeditionTarget(s.meta,result)));assert(s.startCampaign(0));assert.equal(s.campaign.baseKills,0);assert.equal(s.campaign.combatKills,0);assert.deepEqual(result.objectiveProgress,p);assert.equal(s.meta.bank,bank);
 const survival=new Simulation();survival.start();survival.finish(false);assert.equal(Object.hasOwn(survival.result,'objectiveProgress'),false);
});
test('landing and first/replay rewards retain the completed snapshot when campaign result metadata is replaced',()=>{
 for(const index of [0,15])for(const replay of [false,true]){const s=ready(index,replay),stage=CAMPAIGN_STAGES[index];s.enemies=[];for(let i=0;i<stage.kills;i++)kill(s);updateSolarCampaign(s,0);assert.equal(s.campaign.phase,'bases');for(const e of s.enemies.filter(e=>e.campaignBase))s.damageEnemy(e,1e9,'reactor');updateSolarCampaign(s,0);s.damageEnemy(s.enemies.find(e=>e.campaignBoss==='warden'),1e9,'reactor');updateSolarCampaign(s,0);s.damageEnemy(s.enemies.find(e=>e.campaignBoss==='crown'),1e9,'reactor');updateSolarCampaign(s,0);assert.equal(s.campaign.phase,'landing');assert.equal(campaignObjectiveProgress(s).landed,false);s.scrap=0;const bank=s.meta.bank;s.player.position={...s.campaign.landing};updateSolarCampaign(s,0);
  assert.equal(s.result.victory,true);const p=structuredClone(s.result.objectiveProgress);assert.equal(p.index,index);assert.equal(p.landed,true);assert.equal(p.wardenDefeated,true);assert.equal(p.crownDefeated,true);assert.equal(p.combatKills,stage.kills);assert.equal(p.baseKills,stage.bases);assert.equal(s.result.campaign.reward,replay?0:stage.reward);assert.equal(s.meta.bank,bank+120+(replay?0:stage.reward));assert.notEqual(expeditionTarget(s.meta,s.result).stage.index,p.index);const saved=structuredClone(s.meta);updateSolarCampaign(s,0);s.finish(false);assert.deepEqual(s.meta,saved);assert.deepEqual(s.result.objectiveProgress,p);
 }
});
