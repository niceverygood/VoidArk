import test from 'node:test';
import assert from 'node:assert/strict';
import {arriveEnemy,moveEnemy} from '../src/enemy-motion.js';
const ship=()=>({position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},heading:0,speed:20,fleetRole:'guard'});
test('escort arrival settles without repeated directional oscillation',()=>{
 const s=ship(),target={x:30,y:12,z:-20};let reversals=0,last=0;
 for(let i=0;i<600;i++){arriveEnemy(s,target,1/60);const sign=Math.sign(s.velocity.x);if(last&&sign!==last&&Math.abs(s.velocity.x)>.1)reversals++;if(Math.abs(s.velocity.x)>.1)last=sign;}
 assert.ok(Math.hypot(s.position.x-30,s.position.y-12,s.position.z+20)<.1);
 assert.ok(reversals<=1);
});
test('target reversal preserves momentum and limits frame-to-frame heading change',()=>{
 const s=ship();s.velocity.x=20;s.heading=-Math.PI/2;
 moveEnemy(s,{x:-1,y:0,z:0},20,1/60);
 assert.ok(s.velocity.x>0);assert.ok(Math.abs(s.heading+Math.PI/2)<=2.8/60);
});
test('arrival remains consistent across frame rates',()=>{
 const run=hz=>{const s=ship();for(let i=0;i<hz*8;i++)arriveEnemy(s,{x:40,y:15,z:-30},1/hz);return s.position;};
 const a=run(30),b=run(120);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.1);
});
