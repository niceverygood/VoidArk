import {SOUND_MIX,seamlessLoop} from './audio-mix.js';
/** Sample-based, gesture-unlocked space combat audio. No API credentials at runtime. */
export const AUDIO_ASSETS=Object.freeze(Object.fromEntries(['engine','engineBoost','cannon','missile','enemyMissile','explosion','hit','damage','shield','laser','chain','boost','pulse','barrage','overcharge','nova','stasis','repair','lance','countermeasure','sentry','alert','warp','dock','departure','upgrade','boss','victory','defeat','pickup','click'].map(id=>[id,'/audio/elevenlabs/'+(['enemyMissile','alert'].includes(id)?'hostile-v6/':['missile','barrage'].includes(id)?'feedback-v5/':['hit','explosion'].includes(id)?'feedback-v3/':'physical-v2/')+id+'.mp3'])));
const aliases={levelup:'upgrade'};
const cooldowns={cannon:.10,missile:.15,explosion:.12,hit:.09,damage:.25,shield:.2,laser:.8,boost:.9,chain:.18,alert:3.5,boss:4,pickup:.4};
const priority=new Set(['damage','alert','boss','pulse','barrage','overcharge','nova','stasis','repair','lance','countermeasure','sentry','victory','defeat','upgrade']);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
export class AudioSystem {
 constructor(){this.enabled=true;this.context=null;this.intensity=0;this.phase='menu';this._disposed=false;this._voices=new Set();this._loops=new Map();this._buffers=new Map();this._last={};this._counts={};this._errors=[];this._maxVoices=20;this._duckUntil=0;this._unlockPromise=null;this.motion={speed:0,boost:false,stage:0};}
 async unlock(){
  if(this._disposed)return false;
  if(this._unlockPromise)return this._unlockPromise;
  this._unlockPromise=this._unlock().finally(()=>{this._unlockPromise=null;});return this._unlockPromise;
 }
 async _unlock(){try{
  if(!this.context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return false;this.context=new C({latencyHint:'interactive'});this._buildGraph();this.ready=this._load();}
  if(!this.enabled)return false;
  await this.context.resume();
  if(!this.enabled||this._disposed){if(this.context.state==='running')await this.context.suspend();return false;}
  return this.context.state==='running';
 }catch{return false;}}
 _buildGraph(){const c=this.context;this._master=c.createGain();this._master.gain.value=.66;this._limiter=c.createDynamicsCompressor();Object.assign(this._limiter.threshold,{value:-6});this._limiter.knee.value=12;this._limiter.ratio.value=3;this._limiter.attack.value=.003;this._limiter.release.value=.25;this._master.connect(this._limiter);this._limiter.connect(c.destination);}
 async _load(){
  const queue=Object.entries(AUDIO_ASSETS);let index=0;
  await Promise.all(Array.from({length:4},async()=>{while(index<queue.length){const [id,url]=queue[index++];try{
   const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);let buffer=await this.context.decodeAudioData(await r.arrayBuffer());
   if(['engine','engineBoost'].includes(id)){const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>seamlessLoop(buffer.getChannelData(i),buffer.sampleRate));const loop=this.context.createBuffer(channels.length,channels[0].length,buffer.sampleRate);channels.forEach((data,i)=>loop.getChannelData(i).set(data));buffer=loop;}
   if(this._disposed)return;
   // Remove excessive leading silence so weapon transients follow the visual shot.
   let peak=0,first=buffer.length;
   for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<data.length;i++){const a=Math.abs(data[i]);peak=Math.max(peak,a);if(a>.012)first=Math.min(first,i);}}
   this._buffers.set(id,{buffer,offset:['engine','engineBoost'].includes(id)?0:Math.max(0,first/buffer.sampleRate-.008),level:peak>.001?Math.min(1.15,.72/peak):1});
  }catch{this._errors.push(id);}}}));return this._buffers.size;
 }
 setEnabled(value){this.enabled=!!value;if(!this.context||this._disposed)return;this._clearVoices();const now=this.context.currentTime;this._master.gain.setTargetAtTime(this.enabled?.66:0,now,.03);if(this.enabled)this.unlock();else Promise.resolve(this.context.suspend()).catch(()=>{});}
 setIntensity(value){this.intensity=clamp(value,0,1);}
 setMotion(speed,boost=false,stage=0){this.motion={speed:clamp(speed,0,150),boost:!!boost,stage:clamp(stage,0,5)};}
 _loop(id){if(this._loops.has(id))return this._loops.get(id);const asset=this._buffers.get(id);if(!asset)return null;const c=this.context,source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=id==='engine'?420:850;source.buffer=asset.buffer;source.loop=true;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(this._master);source.start();const loop={source,gain,filter,asset};this._loops.set(id,loop);return loop;}
 update(_time,phase='playing'){
  const c=this.context;if(!c||this._disposed||!this.enabled||c.state!=='running')return;
  if(this.phase!==phase&&!['playing','boss'].includes(phase))for(const voice of [...this._voices])if(!['dock','upgrade','victory','defeat'].includes(voice.type))this._removeVoice(voice);this.phase=phase;
  const active=['playing','boss'].includes(phase),speed=this.motion.speed,boost=active&&this.motion.boost;
  for(const id of ['engine','engineBoost']){const loop=this._loop(id);if(!loop)continue;const now=c.currentTime;
   const volume=!active?0:id==='engine'?Math.min(speed/35,1)*.045*(boost?.6:1):boost?.065:0;
   loop.gain.gain.setTargetAtTime(volume*loop.asset.level*(now<this._duckUntil?.45:1),now,.12);
   loop.source.playbackRate.setTargetAtTime((id==='engine'?.94:1)+Math.min(speed/150,.12)-this.motion.stage*.025,now,.22);
  }
  for(const voice of this._voices)if(voice.endAt<c.currentTime)this._removeVoice(voice);
 }
 play(type,position=0,intensity=1,options={}){
  type=aliases[type]||type;const c=this.context,asset=this._buffers.get(type);
  if(!c||this._disposed||!this.enabled||c.state!=='running'||!asset||type.startsWith('engine'))return false;
  const now=c.currentTime,important=priority.has(type),distant=!!options.distant,key=type+(distant?':enemy':''),limit=distant?1:important?1:type==='explosion'?3:2;
  if(now-(this._last[key]??-Infinity)<(distant?.35:cooldowns[type]||.25)||[...this._voices].filter(v=>v.key===key).length>=limit)return false;
  if(this._voices.size>=this._maxVoices){const expendable=[...this._voices].find(v=>!v.important);if(!important||!expendable)return false;this._removeVoice(expendable);}
  const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=asset.buffer;
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=type==='enemyMissile'?1600:type==='alert'?1500:type==='missile'?2600:type==='cannon'?3200:type==='laser'?1800:type==='boost'?1600:18000;filter.Q.value=.5;
  source.playbackRate.value=['cannon','hit','explosion','missile'].includes(type)?.96+Math.random()*.08:1;
  const mix=SOUND_MIX[type]||{gain:.58,tail:3.5,fade:.2},duration=Math.min(asset.buffer.duration-asset.offset,mix.tail)/source.playbackRate.value;
  const volume=clamp(intensity,.03,1.5)*mix.gain*asset.level;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.004);gain.gain.setValueAtTime(volume,now+Math.max(.005,duration-mix.fade));gain.gain.linearRampToValueAtTime(0,now+duration);pan.pan.value=clamp(position,-.75,.75);
  if(important&&!['upgrade','alert'].includes(type))this._duckUntil=Math.max(this._duckUntil,now+Math.min(duration,1.2));
  source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this._master);
  const voice={source,filter,gain,pan,type,key,important,endAt:now+duration+.05};
  source.onended=()=>this._removeVoice(voice);this._voices.add(voice);this._last[key]=now;this._counts[type]=(this._counts[type]||0)+1;source.start(now,asset.offset,duration*source.playbackRate.value);return true;
 }
 _removeVoice(v){if(!this._voices.delete(v))return;v.source.onended=null;try{v.source.stop();}catch{}for(const node of [v.source,v.filter,v.gain,v.pan])node.disconnect();}
 _clearVoices(){for(const v of [...this._voices])this._removeVoice(v);this._last={};}
 diagnostics(){return {provider:'ElevenLabs',revision:'hostile-v6-low-rocket-double-warning',loaded:this._buffers.size,total:Object.keys(AUDIO_ASSETS).length,failed:[...this._errors],voices:this._voices.size,loops:this._loops.size,loopMix:Object.fromEntries([...this._loops].map(([id,loop])=>[id,{gain:loop.gain.gain.value,lowpass:loop.filter.frequency.value}])),activeVoices:[...this._voices].map(v=>({type:v.type,lowpass:v.filter.frequency.value})),played:{...this._counts},motion:{...this.motion},phase:this.phase,state:this.context?.state||'locked'};}
 dispose(){if(this._disposed)return;this._disposed=true;this._clearVoices();for(const {source,gain,filter} of this._loops.values()){try{source.stop();}catch{}source.disconnect();gain.disconnect();filter.disconnect();}this._loops.clear();this._buffers.clear();this._master?.disconnect();this._limiter?.disconnect();if(this.context)Promise.resolve(this.context.close()).catch(()=>{});}
}





