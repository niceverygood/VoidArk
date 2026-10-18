import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation,v} from '../src/sim.js';
import {hotpathBattle,body} from './fixtures/sim-hotpath-scenarios.js';
import {denseAIBattle,advanceDenseAI,denseAIState} from './fixtures/dense-ai-scenarios.js';

const source=readFileSync(new URL('../work/dense-ai-optimization-20261017-sim-before.js',import.meta.url),'utf8').replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL('../src/'+path.slice(2),import.meta.url).href}'`);
const {Simulation:Before}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('body separation exactly retains tangency, .01 cutoff, sequential corrections and unstable array order',()=>{
 for(const factor of [1-Number.EPSILON*8,1-Number.EPSILON,1,1+Number.EPSILON,1+Number.EPSILON*8])for(const size of [.01,2]){
  const sims=[Before,Simulation].map(S=>{const s=hotpathBattle(S);s.player.position=v(10000,100,10000);const p=size*factor/Math.sqrt(3);body(s,0);body(s,p,p,p);for(let i=0;i<4;i++)body(s,i*.12,.3-i*.05,-.2+i*.07);s.enemies.forEach(e=>{e.speed=0;e.cooldown=100;e.radius=size===.01?.02:1;});s.enemies.reverse();s.drainEvents();return s;});
  for(let frame=0;frame<8;frame++){sims.forEach(s=>s.updateEnemies(.01));assert.deepEqual(denseAIState(sims[1]),denseAIState(sims[0]));}
  assert.equal(sims[1].random(),sims[0].random());
 }
});

test('actual 72/120 enemy + 20 ally + 10 fleet battle preserves every frame, weapons/events and RNG',()=>{
 for(const count of [72,120])for(const layout of ['spread','crowded'])for(const fleets of [false,true]){
  const before=denseAIBattle(Before,count,layout,fleets),after=denseAIBattle(Simulation,count,layout,fleets);
  for(const sim of [before,after]){sim.enemies[6].hp=30;sim.enemies[7].hp=0;if(fleets){sim.enemies[0].hp=0;sim.enemies[1].hp=sim.enemies[1].maxHp*.25;}}
  for(let frame=0;frame<90;frame++){advanceDenseAI(before,frame,true);advanceDenseAI(after,frame,true);assert.deepEqual(denseAIState(after),denseAIState(before),`${count}/${layout}/${fleets}/${frame}`);before.drainEvents();after.drainEvents();}
  assert.equal(after.random(),before.random());assert.equal(after.cosmicRandom(),before.cosmicRandom());
 }
});
