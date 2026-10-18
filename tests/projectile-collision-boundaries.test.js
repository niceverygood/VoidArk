import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,v} from '../src/sim.js';

function battle(){const s=new Simulation();s.start();s.enemies=[];s.shots=[];s.fleet=[];s.drainEvents();return s;}

test('swept shots exclude exact tangency, dead targets and prior hits, including zero travel',()=>{
 const s=battle(),tangent=s.spawn('swarm',v(5,2,0)),dead=s.spawn('swarm',v(2,0,0)),prior=s.spawn('swarm',v(3,0,0));
 for(const e of s.enemies){e.radius=1;e.hp=1000;}dead.hp=0;
 const shot=s.shot(v(),null,20,'cannon',true,v(1,0,0));shot.radius=1;shot.velocity=v(200,0,0);shot.hitIds.add(prior.id);
 s.updateShots(.05);assert.equal(tangent.hp,1000);assert.equal(prior.hp,1000);assert.equal(dead.hp,0);assert.ok(s.shots.includes(shot));
 const stationary=s.shot(v(5,0,0),null,20,'cannon',true,v());stationary.radius=1;stationary.velocity=v();
 s.updateShots(.05);assert.equal(tangent.hp,1000,'stationary exact tangent also misses');
 tangent.position.y=1.999;s.updateShots(.05);assert.ok(tangent.hp<1000);assert.ok(!s.shots.includes(stationary));
 const hit=s.drainEvents().find(e=>e.type==='hit');assert.deepEqual(hit.position,v(5,0,0));
});

test('hostile swept shots keep fleet interception order and skip disabled ships before player damage',()=>{
 const s=battle();s.player.position=v(10,0,0);s.player.shield=0;
 const disabled={slot:0,role:'frigate',hp:0,maxHp:100,radius:1,position:v(1,0,0)},far={slot:1,role:'frigate',hp:100,maxHp:100,radius:1,position:v(8,0,0)},near={slot:2,role:'frigate',hp:100,maxHp:100,radius:1,position:v(2,0,0)};
 s.fleet=[disabled,far,near];const shot=s.shot(v(),null,20,'enemy',false,v(1,0,0));shot.velocity=v(200,0,0);shot.radius=1;
 const hp=s.player.hp;s.updateShots(.05);assert.ok(far.hp<100);assert.equal(near.hp,100);assert.equal(disabled.hp,0);assert.equal(s.player.hp,hp);assert.ok(!s.shots.includes(shot));
});
