import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,cleanMeta,dist} from '../src/sim.js';import {PLANETS,occupied} from '../src/galaxy.js';import {GALAXIES} from '../src/galaxies.js';import {TerritoryWar} from '../src/territory-war.js';
test('gates enforce graph, modal, cooldown and boss combat; transfer actual XYZ and retain ship progression',()=>{
 const s=new Simulation({tree:{lance:1},bank:13});s.start('galaxy');const home=PLANETS[0],remote=PLANETS.find(p=>p.galaxy==='andromeda'&&p.index===0);
 assert.equal(s.warpGalaxy('andromeda'),false);s.openGalaxy();assert.equal(s.warpGalaxy('origin'),false);assert.equal(s.warpPlanet(remote.id),false);
 const b=s.spawn('boss',s.player.position);b.commander={rank:'warden'};assert.equal(s.warpGalaxy('andromeda'),false);s.enemies=[];
 s.shots.push({});s.pickups.push({});const hp=s.player.hp;assert.ok(s.warpGalaxy('andromeda'));assert.equal(s.galaxyId,'andromeda');assert.ok(dist(s.player.position,remote.position)<200);assert.ok(s.player.position.x>120000);assert.equal(s.meta.bank,213);assert.equal(s.meta.tree.lance,1);assert.equal(s.player.hp,hp);assert.equal(s.shots.length,0);assert.equal(s.pickups.length,0);
 s.openGalaxy();assert.equal(s.warpGalaxy('milky'),false);assert.equal(s.warpPlanet(home.id),false);s.warpCooldown=0;assert.ok(s.warpGalaxy('milky'));s.openGalaxy();s.warpCooldown=0;assert.ok(s.warpGalaxy('andromeda'));assert.equal(s.meta.bank,213);
 s.updateGalaxy(.01);assert.equal(s.enemies.filter(e=>e.kind==='planetBase').length,remote.baseCount);assert.ok(s.enemies.filter(e=>e.planetId).every(e=>e.planetId===remote.id));
 s.openGalaxy();s.warpCooldown=0;assert.ok(s.warpPlanet('home'));assert.equal(s.galaxyId,'milky');assert.deepEqual(s.player.position,{x:0,y:0,z:0});
});
test('all galaxies are reachable, tiered, independently saved and first discovery stays once across sorties',()=>{
 for(const g of GALAXIES){const p=PLANETS.filter(p=>p.galaxy===g.id);assert.equal(p.length,96);assert.equal(p[0].level,1+g.tier*8);assert.ok(g.links.every(id=>GALAXIES.some(q=>q.id===id&&q.links.includes(g.id))));}
 const s=new Simulation();s.start('galaxy');for(const id of ['andromeda','abyss','origin','verdant']){s.openGalaxy();s.warpCooldown=0;assert.ok(s.warpGalaxy(id));}assert.equal(s.meta.bank,1400);
 const p=PLANETS.find(p=>p.galaxy==='origin');s.meta.conquest??={};s.meta.conquest[p.id]=[0,1,2,'warden','crown'];const saved=new Simulation(JSON.parse(JSON.stringify(s.meta)));assert.ok(occupied(saved.meta.conquest,p));assert.equal(occupied(saved.meta.conquest,PLANETS[0]),false);assert.equal(saved.meta.discoveries.length,5);saved.start('galaxy');saved.openGalaxy();saved.warpGalaxy('andromeda');assert.equal(saved.meta.bank,1400);
 assert.deepEqual(cleanMeta({discoveries:['origin','origin','bad',null]}).discoveries,['milky','origin']);
});
test('invasion fleets require a same-galaxy source with attacker ownership',()=>{
 const w=new TerritoryWar(),source=PLANETS[0],target=PLANETS.find(p=>p.galaxy==='andromeda');w.owners[source.id]='player';assert.equal(w.raid(source.id,target.id,'player'),false);assert.equal(w.raid(source.id,PLANETS[1].id,'faction-2'),false);assert.ok(w.raid(source.id,PLANETS[1].id,'player'));
});
