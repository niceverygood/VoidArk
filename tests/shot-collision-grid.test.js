import test from 'node:test';
import assert from 'node:assert/strict';
import {ShotCollisionGrid} from '../src/shot-collision-grid.js';
import {Simulation,rng,v} from '../src/sim.js';
import {hotpathBattle,body} from './fixtures/sim-hotpath-scenarios.js';

function sweptHit(enemy,from,to,radius) {
  const x=to.x-from.x,y=to.y-from.y,z=to.z-from.z,length=x*x+y*y+z*z;
  const t=length?Math.max(0,Math.min(1,((enemy.position.x-from.x)*x+(enemy.position.y-from.y)*y+(enemy.position.z-from.z)*z)/length)):0;
  return enemy.hp>0&&Math.hypot(from.x+x*t-enemy.position.x,from.y+y*t-enemy.position.y,from.z+z*t-enemy.position.z)<radius+enemy.radius;
}
test('3D grid conservatively contains every swept sphere hit across negative cells and distant galaxy coordinates',()=>{
  const random=rng(92840),grid=new ShotCollisionGrid();
  for(const offset of [0,120000,-120000]) {
    const enemies=Array.from({length:120},(_,id)=>({id,hp:id%19?100:0,radius:.2+random()*10,position:v(offset+(random()-.5)*220,(random()-.5)*180,offset+(random()-.5)*220)}));
    grid.prepare(enemies);
    for(let i=0;i<300;i++) {
      const from=v(offset+(random()-.5)*240,(random()-.5)*200,offset+(random()-.5)*240),to=v(from.x+(random()-.5)*60,from.y+(random()-.5)*60,from.z+(random()-.5)*60),radius=random()*3;
      const candidates=[...grid.query(from,to,radius)],order=candidates.map(e=>enemies.indexOf(e));
      assert.deepEqual(order,[...order].sort((a,b)=>a-b));assert.equal(new Set(order).size,order.length);
      for(const e of enemies)if(sweptHit(e,from,to,radius))assert.ok(candidates.includes(e),`missing ${offset}/${i}/${e.id}`);
    }
  }
});

test('large bosses, cell-face tangency and zero-travel queries remain conservative',()=>{
  const enemies=Array.from({length:50},(_,id)=>({id,hp:100,radius:1,position:v(100+id*4,40,100)}));
  enemies[0]={id:0,hp:100,radius:80,position:v(0,0,0)};enemies[1]={id:1,hp:100,radius:1,position:v(16+2-Number.EPSILON*8,0,0)};
  const grid=new ShotCollisionGrid().prepare(enemies),from=v(16,0,0),candidates=grid.query(from,from,1);
  assert.ok(candidates.includes(enemies[0]));assert.ok(candidates.includes(enemies[1]));
  assert.equal(grid.query(v(-10000),v(10000),1),enemies,'long sweeps return the original array');
  assert.equal(grid.query(v(1e300),v(1e300),1),enemies,'unsafe integer cell coordinates cannot hang');
});

test('dense overlap preserves original order and released grids keep no entity references',()=>{
  const enemies=Array.from({length:120},(_,id)=>({id,hp:100,radius:2,position:v(id*.01,0,0)})),grid=new ShotCollisionGrid();
  grid.prepare(enemies);assert.equal(grid.query(v(),v(1,0,0),1),enemies);
  const buckets=grid.buckets.length;grid.release();assert.equal(grid.enemies,null);assert.equal(grid.candidates.length,0);assert.equal(grid.cells.size,0);
  grid.prepare(enemies);grid.stamp=0xffffffff;assert.deepEqual(grid.query(v(),v(1,0,0),1),enemies);assert.equal(grid.buckets.length,buckets);grid.release();
});

test('actual indexed projectile producer preserves equal-time piercing and missile blast order in a large scene',()=>{
  const sim=hotpathBattle(Simulation),far=body(sim,8),near=body(sim,2),tie=body(sim,2);
  for(let i=0;i<69;i++)body(sim,70+i,60,70,1000);
  sim.upgrades.cannonPierce=2;const shot=sim.shot(v(),null,20,'cannon',true,v(1));shot.velocity=v(200);shot.radius=.1;
  for(let i=0;i<20;i++){const filler=sim.shot(v(0,-40,-40),null,1,'cannon',true,v(0,0,-1));filler.velocity=v(0,0,-1);}
  sim.updateShots(.05);const hits=sim.drainEvents().filter(e=>e.type==='hit');
  assert.deepEqual(hits.map(e=>e.enemyId),[near.id,tie.id,far.id]);assert.deepEqual(hits.map(e=>e.damage),[20,17,14.45]);
  const primary=body(sim,10,0,10,10),overlap=body(sim,11,0,10,10),splash=body(sim,16.999,0,10,100),tangent=body(sim,17,0,10,100);
  const missile=sim.shot(v(10,0,10),primary,20,'missile',true,v());missile.radius=1;missile.velocity=v();
  sim.updateShots(0);const blasts=sim.drainEvents().filter(e=>e.type==='hit');
  assert.deepEqual(blasts.map(e=>e.enemyId),[primary.id,overlap.id,splash.id]);assert.equal(tangent.hp,100);assert.equal(sim.kills,2);
});
