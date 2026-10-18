import test from 'node:test';import assert from 'node:assert/strict';import {selectDamageLabels} from '../src/damage-label-layout.js';
test('dense damage labels prioritize kills and critical hits without altering accumulators',()=>{
 const labels=[{x:100,y:100,width:70,height:18,damage:20},{x:100,y:100,width:70,height:18,critical:true,damage:40},{x:100,y:100,width:70,height:33,killed:true,damage:60}],before=structuredClone(labels);
 const result=selectDamageLabels(labels,500,500);assert.equal(result.length,1);assert.equal(result[0].damage,60);assert.deepEqual(labels,before);
});
test('distinct labels remain at their original targets with a bounded paint count and no overlapping boxes',()=>{
 const labels=Array.from({length:32},(_,i)=>({x:30+i*90,y:100,width:60,height:18})),result=selectDamageLabels(labels,4000,400);assert.equal(result.length,16);assert.deepEqual(result.map(x=>x.x),labels.slice(0,16).map(x=>x.x));
 for(let i=0;i<result.length;i++)for(let j=0;j<i;j++)assert.ok(result[i].box.left>=result[j].box.right);
 assert.equal(selectDamageLabels([{x:NaN,y:1,width:10,height:10},{x:-200,y:10,width:10,height:10}],500,500).length,0);
});
