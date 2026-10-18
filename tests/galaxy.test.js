import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {PLANETS,planetBases,cleanConquest,occupied} from '../src/galaxy.js';
test('galaxy defines 480 unique planets, 2160 bases and safe persistent conquest',()=>{
  assert.equal(PLANETS.length,480);assert.equal(new Set(PLANETS.map(p=>p.id)).size,480);
  assert.equal(PLANETS.reduce((n,p)=>n+p.baseCount,0),2160);
  assert.equal(new Set(PLANETS.flatMap(p=>planetBases(p).map(b=>b.id))).size,2160);
  assert.deepEqual(cleanConquest({'planet-0':[0,0,1,999,-1,NaN]})['planet-0'],[0,1]);
});
test('warp streams local fortresses, respects cooldown and returns to home in real XYZ',()=>{
  const s=new Simulation();s.start('galaxy');assert.ok(s.openGalaxy());const p=PLANETS[5];
  assert.ok(s.warpPlanet(p.id));s.step(.05,{});
  assert.equal(s.enemies.filter(e=>e.kind==='planetBase').length,p.baseCount);
  assert.ok(Math.abs(s.player.position.y-p.position.y)<20);
  s.openGalaxy();assert.equal(s.warpPlanet('home'),false);s.closeGalaxy();s.warpCooldown=0;s.openGalaxy();assert.ok(s.warpPlanet('home'));
  assert.deepEqual(s.player.position,{x:0,y:0,z:0});assert.equal(s.shots.length,0);
});
test('bases plus both commanders grant ownership, once, persisted across sorties',()=>{
  const s=new Simulation();s.start('galaxy');s.openGalaxy();s.warpPlanet(PLANETS[0].id);s.updateGalaxy(.05);
  const bases=s.enemies.filter(e=>e.kind==='planetBase'),p=PLANETS[0];
  s.damageEnemy(bases[0],1e6,'pulse');assert.equal(occupied(s.meta.conquest,p),false);
  const partial=new Simulation(s.meta);partial.start('galaxy');partial.openGalaxy();partial.warpPlanet(p.id);partial.updateGalaxy(.05);
  assert.equal(partial.enemies.filter(e=>e.kind==='planetBase').length,p.baseCount-1);
  for(const b of bases.slice(1))s.damageEnemy(b,1e6,'pulse');assert.equal(occupied(s.meta.conquest,p),false);s.updateGalaxy(.05);s.damageEnemy(s.enemies.find(e=>e.commander?.rank==='warden'),1e6);s.updateGalaxy(.05);s.damageEnemy(s.enemies.find(e=>e.commander?.rank==='crown'),1e6);assert.ok(occupied(s.meta.conquest,p));assert.equal(s.meta.bank,110);
  s.damageEnemy(bases[0],1e6);assert.equal(s.meta.bank,110);
  const restored=new Simulation(JSON.parse(JSON.stringify(s.meta)));restored.start('galaxy');restored.openGalaxy();restored.warpPlanet(p.id);restored.updateGalaxy(.05);
  assert.equal(restored.enemies.filter(e=>e.kind==='planetBase').length,0);
  restored.incomeTimer=0;restored.updateGalaxy(.05);assert.equal(restored.meta.bank,112);
});
test('open world permits roaming titans without six-minute forced result and map freezes play',()=>{
  const s=new Simulation();s.start('galaxy');s.time=360;s.firstBoss=false;s.finalBoss=false;s.step(.05,{});
  assert.equal(s.phase,'playing');assert.equal(s.enemies.some(e=>e.titan&&!e.final),true);assert.equal(s.finalBoss,false);
  s.openGalaxy();const time=s.time;s.step(.05,{x:1});assert.equal(s.time,time);
  assert.equal(s.warpPlanet('bad-id'),false);assert.equal(s.phase,'galaxyMap');
});

test('regional liberation rewards once and every world has lore and a valid region',async()=>{
 const {REGIONS,regionFor,planetLore}=await import('../src/universe.js');
 assert.equal(REGIONS.length,8);
 for(const p of PLANETS){assert.ok(regionFor(p));assert.ok(planetLore(p).history.includes(p.name));}
 const s=new Simulation();s.start('galaxy');s.meta.conquest=cleanConquest();const group=PLANETS.filter(p=>p.region===REGIONS[0].id&&p.galaxy==='milky'),last=group.at(-1);
 for(const p of group){s.meta.conquest[p.id]=Array.from({length:p.baseCount},(_,i)=>i).concat('warden','crown');s.war.owners[p.id]=s.actor;}
 s.war.owners[last.id]='faction-1';s.meta.conquest[last.id]=Array.from({length:last.baseCount-1},(_,i)=>i).concat('warden');const enemy={planetId:last.id,baseIndex:last.baseCount-1};
 const before=s.meta.bank;s.captureBase(enemy);s.player.position={...last.position};s.updateGalaxy(.05);const boss=s.enemies.find(e=>e.commander?.rank==='crown');s.damageEnemy(boss,1e6);assert.equal(s.meta.bank-before,80+last.level*30+300);
 s.damageEnemy(boss,1e6);assert.equal(s.meta.bank-before,80+last.level*30+300);
});
