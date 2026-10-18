import test from 'node:test';
import assert from 'node:assert/strict';
import {seamlessLoop,SOUND_MIX} from '../src/audio-mix.js';
test('loop crossfade removes discontinuity without a silent gap or excess amplitude',()=>{
 const data=Float32Array.from({length:1000},(_,i)=>i/999*1.6-.8);
 const loop=seamlessLoop(data,1000);
 assert.ok(Math.abs(loop[0]-loop.at(-1))<.005);
 assert.ok(loop.every(x=>Number.isFinite(x)&&Math.abs(x)<=.8));
 assert.equal(loop.length,750);
});
test('fast combat transients retain a short audible attack and bounded tails',()=>{
 assert.ok(SOUND_MIX.cannon.tail<.6);assert.ok(SOUND_MIX.hit.tail<.5);
 for(const mix of Object.values(SOUND_MIX))assert.ok(mix.fade>0&&mix.fade<mix.tail&&mix.gain>0&&mix.gain<=1);
});
