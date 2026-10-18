import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';import {PLANETS,occupied,cleanConquest} from '../src/galaxy.js';import {commanderDefinition} from '../src/commanders.js';
test('midboss unlocks at half bases, final awaits midboss and both persist across sorties',()=>{
 const s=new Simulation();s.start('galaxy');const p=PLANETS[0];s.openGalaxy();s.warpPlanet(p.id);s.updateGalaxy(.05);
 for(const e of s.enemies.filter(e=>e.kind==='planetBase').slice(0,2))s.damageEnemy(e,1e6);s.updateGalaxy(.05);
 const mid=s.enemies.find(e=>e.commander);assert.equal(mid.commander.rank,'warden');s.updateGalaxy(.05);assert.equal(s.enemies.filter(e=>e.commander).length,1);
 const pos={...mid.position};s.player.position=pos;s.warpCooldown=0;s.openGalaxy();assert.equal(s.warpPlanet('home'),false);s.closeGalaxy();
 s.damageEnemy(mid,1e6);const restored=new Simulation(s.meta);assert.ok(restored.meta.conquest[p.id].includes('warden'));
 for(const e of s.enemies.filter(e=>e.kind==='planetBase'&&e.hp>0))s.damageEnemy(e,1e6);s.updateGalaxy(.05);const lord=s.enemies.find(e=>e.hp>0&&e.commander);assert.equal(lord.commander.rank,'crown');assert.equal(occupied(s.meta.conquest,p),false);
 s.damageEnemy(lord,1e6);assert.ok(occupied(s.meta.conquest,p));assert.equal(s.meta.bank,110);s.damageEnemy(lord,1e6);assert.equal(s.meta.bank,110);
});
test('legacy occupied worlds are retained, new base-only progress is not silently occupied',()=>{
 const p=PLANETS[0],conquest={[p.id]:[0,1,2]};assert.ok(occupied(new Simulation({conquest}).meta.conquest,p));assert.equal(occupied(new Simulation({conquest,conquestVersion:2}).meta.conquest,p),false);
 assert.deepEqual(cleanConquest({[p.id]:['warden','warden','crown','junk',99]})[p.id],['warden','crown']);
});
test('commander warns before real XYZ attack, enrages and freezes in map; frontier has final boss',()=>{
 const s=new Simulation();s.start('galaxy');const e=s.spawn('boss',{x:20,y:12,z:20},false,true);e.commander=commanderDefinition(PLANETS[0],'warden');e.name=e.commander.name;e.cooldown=0;
 s.updateCommander(e,.05);assert.ok(e.warning>0);assert.equal(s.shots.length,0);s.updateCommander(e,2);assert.ok(s.shots.some(x=>!x.friendly)||s.hazards.length);
 e.hp=e.maxHp*.4;s.updateCommander(e,.05);assert.ok(e.enraged);const age=e.age;s.openGalaxy();s.step(.05,{});assert.equal(e.age,age);
 assert.ok(commanderDefinition(PLANETS[95],'crown').final);
});
