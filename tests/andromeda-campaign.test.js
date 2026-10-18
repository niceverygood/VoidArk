import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,cleanMeta} from '../src/sim.js';
import {ANDROMEDA_STAGES,ANDROMEDA_SYSTEMS} from '../src/andromeda-campaign.js';
import {updateSolarCampaign,solarSnapshot,updateArenaBoundary} from '../src/solar-campaign.js';
test('Andromeda requires solar ownership, preserves legacy progress and starts a dense four-carrier invasion',()=>{
 const locked=new Simulation({campaign:{cleared:7,andromedaCleared:9}});assert.equal(locked.startExpedition(0),false);assert.equal(locked.meta.campaign.andromedaCleared,0);
 const s=new Simulation({campaign:{cleared:8},bank:500,base:{command:1},campaignShip:{gear:{missile:3}}});assert.equal(s.startExpedition(1),false);assert.equal(s.startExpedition(0),true);
 assert.equal(s.galaxyId,'andromeda');assert.equal(s.enemies.length,40);assert.equal(s.enemies.filter(e=>e.fleetRole==='flagship').length,4);assert.equal(s.upgrades.missile,3);assert.equal(s.meta.bank,500);assert.equal(s.meta.base.command,1);
 assert.equal(solarSnapshot(s).systemName,'아스트라 행성계');assert.equal(s.enemies.filter(e=>e.fleetRole==='support').length,12);assert.ok(s.enemies.filter(e=>e.fleetRole==='flagship').every(e=>e.armor==='energy'&&e.captain.tactic==='restore'));
 assert.deepEqual(ANDROMEDA_SYSTEMS.map(s=>s.name),['아스트라 행성계','벨카르 행성계','에테르 행성계']);
});
function conquer(s) {
 const stage=ANDROMEDA_STAGES[s.campaign.index-8];
 while(s.campaign.combatKills<stage.kills){const e=s.enemies.find(e=>e.hp>0&&!e.campaignBoss&&!e.campaignBase)||s.spawn('swarm',{x:20,y:0,z:20});s.damageEnemy(e,1e9);}
 updateSolarCampaign(s,.01);assert.equal(s.campaign.phase,'bases');assert.equal(s.enemies.filter(e=>e.campaignBase&&e.hp>0).length,stage.bases);
 for(const e of [...s.enemies].filter(e=>e.campaignBase&&e.hp>0))s.damageEnemy(e,1e9);
 updateSolarCampaign(s,.01);const mid=s.enemies.find(e=>e.hp>0&&e.campaignBoss==='warden');assert.equal(mid.name,stage.warden);s.damageEnemy(mid,1e9);
 updateSolarCampaign(s,.01);const crown=s.enemies.find(e=>e.hp>0&&e.campaignBoss==='crown');assert.equal(crown.name,stage.governor);s.damageEnemy(crown,1e9);updateSolarCampaign(s,.01);
 assert.equal(s.campaign.phase,'landing');assert.equal(s.phase,'playing');s.player.position={...s.campaign.landing};updateSolarCampaign(s,.01);assert.equal(s.phase,'ended');assert.equal(s.result.victory,true);
}
test('all nine real fortress and named boss sequences unlock three systems and settle galaxy ownership/rewards once',()=>{
 let s=new Simulation({campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,owned:['helios'],capital:'helios',facilities:{command:2,shipyard:1},roster:['support','destroyer']},ship:'sovereign'});
 for(let i=0;i<9;i++){assert.equal(s.startExpedition(i),true);assert.equal(s.fleet[0].role,'support');assert.equal(s.stage,2);conquer(s);assert.equal(s.meta.campaign.andromedaCleared,i+1);assert.equal(s.result.campaign.reward,ANDROMEDA_STAGES[i].reward);assert.equal(s.meta.campaign.cleared,8);s=new Simulation(structuredClone(s.meta));}
 assert.equal(s.meta.campaign.andromedaOwned,true);assert.equal(s.startExpedition(9),false);s.startExpedition(8);conquer(s);assert.equal(s.result.campaign.reward,0);assert.equal(s.result.campaign.complete,true);
 s.startCampaign(0);assert.equal(s.meta.campaign.andromedaOwned,true);
});
test('expanded XYZ arena retains return grace, map pause and failed-stage progress without losing either chapter',()=>{
 const s=new Simulation({campaign:{cleared:8,andromedaCleared:3}});s.startExpedition(3);s.player.position={x:740,y:290,z:-740};updateArenaBoundary(s,6);assert.equal(s.campaign.outsideTime,0);
 s.player.position.y=320;updateArenaBoundary(s,4);assert.equal(solarSnapshot(s).boundary.distance,20);const shield=s.player.shield;s.openGalaxy();s.step(.05,{});assert.equal(s.campaign.outsideTime,4);s.closeGalaxy();updateArenaBoundary(s,2);assert.equal(s.player.shield,Math.max(0,shield-24));
 s.finish(false);assert.equal(s.meta.campaign.andromedaCleared,3);assert.equal(s.meta.campaign.systemOwned,true);assert.equal(cleanMeta(s.meta).campaign.andromedaCleared,3);
});
