import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,cleanMeta} from '../src/sim.js';
import {SOLAR_STAGES,updateSolarCampaign,constrainArena,updateArenaBoundary,solarSnapshot} from '../src/solar-campaign.js';
test('Earth campaign locks future planets, starts Mercury with dense escorted groups, and preserves legacy saves',()=>{
 const s=new Simulation({bank:777,conquest:{'planet-0':[0]},campaign:{cleared:0}});
 assert.equal(s.startCampaign(1),false);assert.equal(s.phase,'menu');assert.equal(s.meta.bank,777);
 assert.equal(s.startCampaign(0),true);assert.equal(s.mode,'campaign');assert.equal(s.enemies.length,30);
 assert.equal(s.enemies.filter(e=>e.fleetRole==='flagship').length,3);
 assert.equal(s.warpPlanet('planet-0'),false);assert.equal(s.dockBase(),false);
 assert.deepEqual(SOLAR_STAGES.map(p=>p.name),['수성','금성','화성','목성','토성','천왕성','해왕성','명왕성']);
 assert.equal(cleanMeta({campaign:{cleared:999}}).campaign.cleared,8);
});
function conquer(s){
 const spec=SOLAR_STAGES[s.campaign.index];
 for(const e of [...s.enemies].slice(0,spec.kills))s.damageEnemy(e,1e6);
 // Later stages require more than the initial group: use actual spawned combat ships.
 while(s.campaign.combatKills<spec.kills){const e=s.spawn('swarm',{x:30,y:20,z:20});s.damageEnemy(e,1e6);}
 updateSolarCampaign(s,.01);assert.equal(s.campaign.phase,'bases');
 for(const e of [...s.enemies].filter(e=>e.campaignBase))s.damageEnemy(e,1e6);
 updateSolarCampaign(s,.01);assert.equal(s.campaign.phase,'warden');
 s.damageEnemy(s.enemies.find(e=>e.hp>0&&e.campaignBoss==='warden'),1e6);
 updateSolarCampaign(s,.01);assert.equal(s.campaign.phase,'governor');
 s.damageEnemy(s.enemies.find(e=>e.hp>0&&e.campaignBoss==='crown'),1e6);
 updateSolarCampaign(s,.01);assert.equal(s.campaign.phase,'landing');assert.equal(s.phase,'playing');s.player.position={...s.campaign.landing};updateSolarCampaign(s,.01);assert.equal(s.phase,'ended');assert.equal(s.result.victory,true);
}
test('all eight actual fortress and boss sequences unlock sequentially, persist, and grant solar ownership once',()=>{
 let s=new Simulation();
 for(let i=0;i<8;i++) {assert.equal(s.startCampaign(i),true);conquer(s);assert.equal(s.meta.campaign.cleared,i+1);s=new Simulation(structuredClone(s.meta));}
 assert.equal(s.meta.campaign.systemOwned,true);assert.equal(s.startCampaign(8),false);
 s.startCampaign(0);const bank=s.meta.bank;conquer(s);assert.equal(s.result.campaign.reward,0);assert.equal(s.meta.campaign.cleared,8);assert.ok(s.meta.bank>=bank);
});
test('arena constrains all three dimensions and outward boost velocity; defeat and map pause preserve stage progress',()=>{
 const s=new Simulation();s.startCampaign(0);s.player.position={x:900,y:500,z:-1000};s.player.velocity={x:40,y:40,z:-40};
 assert.equal(constrainArena(s.player,SOLAR_STAGES[0].extent),true);assert.deepEqual(s.player.position,{x:600,y:240,z:-600});assert.deepEqual(s.player.velocity,{x:0,y:0,z:0});
 s.openGalaxy();const before=s.time;s.step(.05,{boost:true,x:1});assert.equal(s.time,before);s.closeGalaxy();s.step(.05,{x:1,boost:true});assert.ok(s.player.position.x>600);
 s.finish(false);assert.equal(s.meta.campaign.cleared,0);assert.equal(s.meta.campaign.systemOwned,false);
});

test('boundary grants five seconds in every axis, drains shield then hull, and stops on return',()=>{
 for(const axis of ['x','y','z'])for(const sign of [-1,1]){
  const s=new Simulation();s.startCampaign(0);s.player.position[axis]=sign*(SOLAR_STAGES[0].extent[axis]+30);
  const hp=s.player.hp,shield=s.player.shield,boost=s.player.boost;
  updateArenaBoundary(s,4.8);assert.equal(s.player.shield,shield);assert.equal(solarSnapshot(s).boundary.outside,true);
  updateArenaBoundary(s,.4);assert.ok(Math.abs(s.player.shield-(shield-4.8))<1e-8);assert.equal(s.player.hp,hp);assert.equal(s.player.boost,boost);
  s.player.shield=1;updateArenaBoundary(s,.5);assert.equal(s.player.shield,0);assert.equal(s.player.hp,hp-11);
  s.player.position[axis]=0;updateArenaBoundary(s,1);assert.equal(s.player.hp,hp-11);assert.equal(solarSnapshot(s).boundary.outside,false);
  s.player.position[axis]=sign*(SOLAR_STAGES[0].extent[axis]+30);updateArenaBoundary(s,4);assert.equal(s.player.hp,hp-11);
 }
});
test('boundary timer pauses with maps and lethal exposure settles only once',()=>{
 const s=new Simulation();s.startCampaign(0);s.player.position.x=650;s.campaign.outsideTime=4;s.openGalaxy();s.step(20,{});assert.equal(s.campaign.outsideTime,4);s.closeGalaxy();
 s.player.shield=0;s.player.hp=1;updateSolarCampaign(s,2);assert.equal(s.phase,'ended');assert.equal(s.player.hp,0);const runs=s.meta.runs;s.step(5,{});assert.equal(s.meta.runs,runs);
});
