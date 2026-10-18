import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceMayBeInside} from '../src/distance-candidates.js';
import {Simulation,v} from '../src/sim.js';
import {hotpathBattle,body} from './fixtures/sim-hotpath-scenarios.js';

test('distance rejection retains axial/diagonal tangency, overflow and squared subnormal candidates for native decision',()=>{
 const cases=[];
 for(const r of [1e-200,2.5e-162,1e-154,.01,1,2,90,1e150,1e200,Infinity,NaN,0,-1])for(const f of [1-Number.EPSILON*8,1-Number.EPSILON,1,1+Number.EPSILON,1+Number.EPSILON*8]){
  cases.push([r*f,0,0,r],[r*f/Math.sqrt(3),r*f/Math.sqrt(3),r*f/Math.sqrt(3),r]);
 }
 cases.push([1.6e-162,1.6e-162,0,2.5e-162],[NaN,0,0,100],[Infinity,0,0,Infinity]);
 for(const [x,y,z,r] of cases)if(Math.hypot(x,y,z)<r)assert.equal(distanceMayBeInside(x,y,z,r),true,JSON.stringify([x,y,z,r]));
 assert.equal(distanceMayBeInside(400,200,-300,90),false);assert.equal(distanceMayBeInside(2,0,0,'3'),true);
});

test('actual nearest preserves order, dead/excluded targets and rounded near-ties across finite and non-finite ranges',()=>{
 const sim=hotpathBattle(Simulation),positions=[[10,0,0],[-10,0,0],[Math.SQRT2,Math.SQRT2,0],[2,Number.EPSILON,0],[1.6e-162,1.6e-162,0],[1e200,1e200,0],[Infinity,0,0],[NaN,0,0]];
 positions.forEach(point=>body(sim,...point));body(sim,0,0,0,0);
 const native=(position,range,exclude)=>{let nearest=null,best=range;for(const e of sim.enemies){if(e.hp<=0||exclude?.has(e.id))continue;const d=Math.hypot(position.x-e.position.x,position.y-e.position.y,position.z-e.position.z);if(d<best){nearest=e;best=d;}}return nearest;};
 for(const origin of [v(),v(1,2,3),v(1e200,0,0)])for(const range of [0,-1,NaN,Infinity,1e-200,2.5e-162,2,10,11,1e200,'11'])for(const excluded of [null,new Set(),new Set([sim.enemies[0].id,sim.enemies[4].id])])assert.equal(sim.nearest(origin,range,excluded),native(origin,range,excluded));
 sim.enemies=[sim.enemies[0],sim.enemies[1]];assert.equal(sim.nearest(v(),11),sim.enemies[0]);assert.equal(sim.nearest(v(),10),null);
});
