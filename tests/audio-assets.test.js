import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AudioSystem,AUDIO_ASSETS} from '../src/audio.js';
const param=()=>({value:0,setTargetAtTime(n){this.value=n;},setValueAtTime(n){this.value=n;},linearRampToValueAtTime(n){this.value=n;}});
const node=()=>({gain:param(),pan:param(),frequency:param(),Q:param(),playbackRate:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){},start(){},stop(){}});
class Context{
 constructor(){this.state='suspended';this.currentTime=0;this.destination=node();}
 createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/sampleRate,length,sampleRate,numberOfChannels:channels,getChannelData:i=>data[i]};}createBiquadFilter(){return node();}createGain(){return node();}createDynamicsCompressor(){return node();}createBufferSource(){return node();}createStereoPanner(){return node();}
 async decodeAudioData(){return {duration:2,length:100,sampleRate:100,numberOfChannels:1,getChannelData:()=>Float32Array.from({length:100},()=>.5)};}
 async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
}
test('all routed combat assets exist and generation records contain no runtime credentials',()=>{
 for(const url of Object.values(AUDIO_ASSETS)){const data=fs.readFileSync('public'+url);assert.ok(data.length>8000);assert.ok(data[0]===255||data.subarray(0,3).toString()==='ID3');}
 const manifest=JSON.parse(fs.readFileSync('public/audio/elevenlabs/physical-v2/generation.json'));assert.equal(manifest.assets.length,30);assert.ok(!JSON.stringify(manifest).includes('sk_'));assert.equal(manifest.assets.filter(a=>a.loop).length,2);
});
test('sample loading, skill routing, voice limits, pause, mute and dispose preserve audio lifecycle',async()=>{
 const previousContext=globalThis.AudioContext,previousFetch=globalThis.fetch;globalThis.AudioContext=Context;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(10)});
 try{
 const a=new AudioSystem();assert.equal(a.play('missile'),false);await a.unlock();await a.ready;assert.equal(a.diagnostics().loaded,31);
 assert.notEqual(AUDIO_ASSETS.enemyMissile,AUDIO_ASSETS.missile);assert.equal(a.play('enemyMissile',0,.2,{distant:true}),true);assert.equal(a.play('enemyMissile',0,.2,{distant:true}),false);assert.equal(a.play('alert'),true);a.context.currentTime+=3;a.update(0,'playing');assert.equal(a.play('cannon',0,.2,{distant:true}),true);assert.equal(a.play('cannon',0,1),true);assert.equal(a.play('cannon',0,.2,{distant:true}),false);
 a.setMotion(0,false,0);a.update(0,'playing');assert.equal(a.diagnostics().loopMix.engine.gain,0);assert.equal(a.diagnostics().loopMix.engineBoost.gain,0);assert.equal(a.play('laser'),true);assert.ok(a.diagnostics().activeVoices.some(v=>v.type==='laser'&&v.lowpass<2000));a.context.currentTime+=.3;assert.equal(a.play('laser'),false);a.context.currentTime+=3;a.update(0,'playing');
 a.setMotion(30,true,2);a.update(0,'playing');assert.equal(a._loops.size,2);assert.ok(a._loops.get('engineBoost').gain.gain.value>0);
 for(let i=0;i<100;i++){a.context.currentTime+=.2;a.play('missile');}assert.ok(a._voices.size<=4);
 for(const id of ['pulse','barrage','overcharge','nova','stasis','repair','lance','countermeasure','sentry']){a.context.currentTime+=3;assert.equal(a.play(id),true);}
 a.update(0,'paused');assert.equal(a._voices.size,0);assert.equal(a._loops.get('engine').gain.gain.value,0);
 a.setEnabled(false);assert.equal(a.play('missile'),false);a.dispose();a.dispose();assert.equal(a._loops.size,0);assert.equal(a._buffers.size,0);assert.equal(a.context.state,'closed');
 }finally{globalThis.AudioContext=previousContext;globalThis.fetch=previousFetch;}
});
test('failed downloads remain visible in diagnostics and never play legacy oscillator effects',async()=>{
 const previousContext=globalThis.AudioContext,previousFetch=globalThis.fetch;globalThis.AudioContext=Context;globalThis.fetch=async()=>({ok:false,status:404});
 try{const a=new AudioSystem();await a.unlock();await a.ready;assert.equal(a.diagnostics().failed.length,31);assert.equal(a.play('missile'),false);a.dispose();}finally{globalThis.AudioContext=previousContext;globalThis.fetch=previousFetch;}
});


