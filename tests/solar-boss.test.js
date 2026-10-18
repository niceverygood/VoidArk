import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {SOLAR_STAGES,updateSolarCampaign,campaignCommanderStats} from '../src/solar-campaign.js';
import {SOLAR_BOSS_PATTERNS,configureSolarBoss,updateSolarBoss,solarBossStatus} from '../src/solar-boss.js';
import {ANDROMEDA_STAGES} from '../src/andromeda-campaign.js';
import {configureAndromedaBoss} from '../src/andromeda-boss.js';

function setup(index=0){const s=new Simulation({bank:29446,campaign:{cleared:8,andromedaCleared:6}});s.startCampaign(index);s.enemies=[];s.fleet=[];const e=s.spawn('boss',{x:0,y:0,z:-60},false,true);Object.assign(e,campaignCommanderStats(SOLAR_STAGES[index],'crown'),{campaignBoss:'crown'});configureSolarBoss(e,SOLAR_STAGES[index]);e.solarBoss.cooldown=0;s.drainEvents();return {s,e};}

test('both actual Solar ranks use the planet profile; original stats, meta and Andromeda doctrine remain intact',()=>{
 for(const stage of SOLAR_STAGES)for(const rank of ['warden','crown']){const {s}=setup(stage.index),meta=structuredClone(s.meta);s.enemies=[];s.level=rank==='warden'?4:8;Object.assign(s.campaign,{phase:rank==='warden'?'warden':'governor',wardenSpawned:rank!=='warden',wardenDefeated:rank!=='warden'});updateSolarCampaign(s,0);const boss=s.enemies.find(e=>e.campaignBoss===rank);assert.ok(boss);assert.equal(boss.solarBoss.planet,stage.id);assert.equal(boss.tactics,undefined);assert.equal(boss.maxHp,campaignCommanderStats(stage,rank).maxHp);assert.deepEqual(s.meta,meta);assert.match(s.snapshot().boss.status,new RegExp(SOLAR_BOSS_PATTERNS[stage.id].name));}
 const {s,e}=setup();configureAndromedaBoss(e,ANDROMEDA_STAGES[0]);delete e.solarBoss;const before=structuredClone(e.tactics);assert.equal(configureSolarBoss(e,ANDROMEDA_STAGES[0]),false);assert.deepEqual(e.tactics,before);assert.equal(s.meta.bank,29446);
});
test('all eight 3D telegraphs lock targets before any fire and give bounded cooldown openings without extra units',()=>{
 const designs=new Set();for(const stage of SOLAR_STAGES){const d=SOLAR_BOSS_PATTERNS[stage.id];designs.add(d.patterns.join(','));for(let cycle=0;cycle<d.patterns.length;cycle++){const {s,e}=setup(stage.index);e.solarBoss.cycle=cycle;updateSolarBoss(s,e,0);const a=structuredClone(e.solarBoss.attack);assert.ok(a.remaining>=.9);assert.equal(s.shots.length,0);assert.equal(s.hazards.length,0);assert.equal(s.drainEvents().filter(v=>v.type==='warning').length,a.lines.length);s.player.position={x:60,y:40,z:10};updateSolarBoss(s,e,.2);assert.deepEqual(e.solarBoss.attack.target,a.target);updateSolarBoss(s,e,2);assert.equal(e.solarBoss.attack,null);assert.equal(e.solarBoss.attacks,1);assert.equal(e.solarBoss.exposed,d.opening);assert.ok(s.shots.length<=8);assert.ok(s.hazards.length<=2);assert.equal(s.enemies.length,1);assert.match(solarBossStatus(e),/집중 공격/);const count=s.shots.length;updateSolarBoss(s,e,.2);assert.equal(s.shots.length,count);}}
 assert.equal(designs.size,8);
});
test('locked Mercury beam damages staying ships, XYZ sidestep avoids it, and normal damage has no opening multiplier',()=>{
 const hit=setup(),avoid=setup();for(const x of [hit,avoid])updateSolarBoss(x.s,x.e,0);avoid.s.player.position.y=25;updateSolarBoss(hit.s,hit.e,2);updateSolarBoss(avoid.s,avoid.e,2);assert.ok(hit.s.player.shield<hit.s.player.maxShield);assert.equal(avoid.s.player.shield,avoid.s.player.maxShield);assert.ok(hit.s.sortieRecorder.causes.beam>0);
 const a=setup(),b=setup();a.e.solarBoss.exposed=3;const hpA=a.e.hp,hpB=b.e.hp;a.s.damageEnemy(a.e,10,'reactor');b.s.damageEnemy(b.e,10,'reactor');assert.equal(hpA-a.e.hp,hpB-b.e.hp);
});
test('actual pulse interrupts Solar charging once; pause and upgrade freeze time/target and later fire stays canceled',()=>{
 const {s,e}=setup(3);e.position.z=-25;updateSolarBoss(s,e,0);const locked=structuredClone(e.solarBoss);for(const phase of ['paused','upgrade']){s.phase=phase;s.step(1,{});assert.deepEqual(e.solarBoss,locked);}s.phase='playing';assert.ok(s.castSkill('pulse'));s.updateEnemies(1/30);assert.equal(e.solarBoss.attack,null);assert.equal(e.solarBoss.interrupts,1);assert.equal(e.solarBoss.attacks,0);assert.ok(!s.shots.some(q=>!q.friendly));s.updateEnemies(1/30);assert.equal(e.solarBoss.interrupts,1);assert.ok(s.sortieRecorder.bosses.some(b=>b.interrupt===1));
});
test('boss death cancels queued attack; landing and repeat settlement still happen once without new conquest rewards',()=>{
 const {s,e}=setup(2);Object.assign(s.campaign,{phase:'governor',wardenSpawned:true,wardenDefeated:true,crownSpawned:true});updateSolarBoss(s,e,0);s.damageEnemy(e,1e9,'reactor');s.drainEvents();updateSolarBoss(s,e,2);assert.equal(e.solarBoss.attack,null);assert.equal(s.shots.length,0);updateSolarCampaign(s,0);assert.equal(s.campaign.phase,'landing');s.player.position={...s.campaign.landing};updateSolarCampaign(s,0);assert.equal(s.result.victory,true);assert.equal(s.result.campaign.reward,0);const bank=s.meta.bank;updateSolarCampaign(s,0);assert.equal(s.meta.bank,bank);assert.equal(s.meta.campaign.cleared,8);
});
test('lethal first cross beam stops the second beam, fleet damage, announcements and later enemies in the same update',()=>{
 const {s,e}=setup(5);updateSolarBoss(s,e,0);const a=e.solarBoss.attack;s.player.position={...a.lines[0].target};s.player.hp=.1;s.player.shield=0;s.player.lastDamage=-99;s.drainEvents();let fleetDamage=0;s.damageFleet=()=>fleetDamage++;const after=s.spawn('swarm',{x:50,y:0,z:-10}),position={...after.position};s.drainEvents();s.updateEnemies(2);assert.equal(s.phase,'ended');assert.equal(s.result.victory,false);assert.equal(fleetDamage,0);assert.deepEqual(after.position,position);const events=s.drainEvents();assert.equal(events.filter(e=>e.type==='beam').length,1);assert.ok(!events.some(e=>e.type==='bossfire'));assert.equal(e.solarBoss.attack,null);const bank=s.meta.bank;s.updateEnemies(2);assert.equal(s.meta.bank,bank);
});
