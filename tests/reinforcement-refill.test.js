import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,v,dist} from '../src/sim.js';
import {fleetDestination} from '../src/enemy-formation.js';
const setup=()=>{const s=new Simulation();s.start('galaxy');s.player.position=v(90000,0,90000);s.enemies=[];return s;};
test('three escorted attack groups fill deep space and losses trigger replacements without independent mobs',()=>{
 const s=setup();for(let i=0;i<400;i++)s.updateGalaxy(.05);
 const leaders=s.enemies.filter(e=>e.fleetRole==='flagship');assert.equal(leaders.length,3);assert.ok(s.enemies.length>=30&&s.enemies.length<=32);
 for(const e of s.enemies)if(e.fleetRole!=='flagship')assert.ok(leaders.some(l=>l.id===e.leaderId));
 s.enemies=s.enemies.filter(e=>e.fleetRole==='flagship');const before=s.enemies.length;s.spawnTimer=0;s.updateGalaxy(.05);assert.ok(s.enemies.length>before);
});
test('retreating groups do not block fresh carrier approaches',()=>{
 const s=setup();for(let i=0;i<400;i++)s.updateGalaxy(.05);
 for(const e of s.enemies)if(e.fleetRole==='flagship')e.fleetPlan='retreat';
 s.spawnTimer=0;s.updateGalaxy(.05);assert.ok(s.enemies.some(e=>e.fleetRole==='flagship'&&e.fleetPlan==='approach'));
 assert.ok(s.enemies.length<=64);
});
test('normal carriers fight at visible ranges while advanced players receive a fourth escorted group',()=>{
 const s=setup();s.level=8;for(let i=0;i<400;i++)s.updateGalaxy(.05);
 assert.equal(s.enemies.filter(e=>e.fleetRole==='flagship').length,4);assert.ok(s.enemies.length<=36);
 const l=s.enemies.find(e=>e.fleetRole==='flagship');l.captain={...l.captain,tactic:'blockade'};l.fleetPlan='engage';l.age=0;
 assert.ok(dist(fleetDestination(l,l,s.player),s.player.position)<50);
});
