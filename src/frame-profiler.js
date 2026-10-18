const CAPTURE_KEYS=["frame","cpu","simulation","camera","visuals","feedbackAudio","batch","batchWorld","batchSearch","batchBuffers","batchInstances","batchEvents","render","launchCamera","hudSnapshot","hud","radar","hudDOM"];
// Fixed histograms: 0.1ms bins through 100ms, then 2% logarithmic bins.
export class TimingAggregate {
 constructor(){this.bins=new Float64Array(2048);this.count=0;this.sum=0;this.max=0;}
 add(value){const v=Math.max(0,Number(value)||0);this.count++;this.sum+=v;this.max=Math.max(this.max,v);const index=v<100?Math.floor(v*10):1000+Math.floor(Math.log(v/100)/Math.log(1.02));this.bins[Math.min(2047,index)]++;}
 percentile(q){let n=0,target=Math.floor(this.count*q)+1;for(let i=0;i<this.bins.length;i++){n+=this.bins[i];if(n>=target)return Math.min(this.max,i<1000?(i+1)/10:100*Math.pow(1.02,i-999));}return this.max;}
 result(){return this.count?{mean:this.sum/this.count,p95:this.percentile(.95),p99:this.percentile(.99),max:this.max}:null;}
}
export class FrameProfiler {
 constructor(gl){this.gl=gl;this.ext=typeof location!=='undefined'&&new URLSearchParams(location.search).get('qa')==='1'&&new URLSearchParams(location.search).get('gpuProfile')!=='0'?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;this.gpuFrame=0;this.pending=[];this.gpuMs=null;this.samples=[];this.summaryDirty=true;this.summary={};}
 get last(){if(this.summaryDirty){const latest=this.samples.at(-1);this.summary=latest?{gpu:this.gpuMs,...Object.fromEntries(Object.keys(latest).map(k=>[k,+(this.samples.reduce((v,s)=>v+(s[k]||0),0)/this.samples.length).toFixed(2)]))}:{};this.summaryDirty=false;}return this.summary;}
 contextReset(){this.summaryDirty=true;this.pending=[];this.query=null;this.gpuMs=null;this.gpuFrame=0;this.ext=typeof location!=='undefined'&&new URLSearchParams(location.search).get('qa')==='1'&&new URLSearchParams(location.search).get('gpuProfile')!=='0'?this.gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;}
 setGPUProfiling(enabled){if(this.query){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.gl.deleteQuery(this.query);this.query=null;}for(const q of this.pending)this.gl.deleteQuery(q);this.pending=[];this.gpuMs=null;this.gpuFrame=0;this.ext=enabled&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('qa')==='1'?this.gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;this.summaryDirty=true;}
 start(gameTime,phase,level){this.startAt=performance.now();this.at=this.startAt;this.current={};if(this.capture){this.gameTimeBefore=gameTime;this.phaseBefore=phase;this.levelBefore=level;}}
 mark(name){const now=performance.now();this.current[name]=now-this.at;this.at=now;}
 beginGPU(){const g=this.gl,e=this.ext;if(!e)return;for(let i=this.pending.length-1;i>=0;i--){const q=this.pending[i];if(g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE)){if(!g.getParameter(e.GPU_DISJOINT_EXT)){this.gpuMs=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;if(this.capture)this.capture.gpu.add(this.gpuMs);}g.deleteQuery(q);this.pending.splice(i,1);}}if(++this.gpuFrame%15===0&&this.pending.length<4){this.query=g.createQuery();g.beginQuery(e.TIME_ELAPSED_EXT,this.query);}}
 endGPU(){if(this.query){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push(this.query);this.query=null;}}
 end(rawMs,gameTime,phase,level){
  this.current.cpu=performance.now()-this.startAt;this.current.frame=rawMs;this.samples.push(this.current);if(this.samples.length>60)this.samples.shift();this.summaryDirty=true;
  if(!this.capture)return;
  const c=this.capture;c.count++;for(const key of CAPTURE_KEYS)c.times[key].add(this.current[key]||0);
  if(rawMs>33.34)c.over33++;if(rawMs>50)c.over50++;if(rawMs>100)c.over100++;
  if(this.current.launchRendered){c.launchRenders++;c.launch.add(this.current.launchCamera||0);}
  const stall=rawMs>100||this.current.cpu>100;
  const cpu=c.worst.length<12||this.current.cpu>c.worst.at(-1).cpu;
  const world=c.worstWorld.length<12||(this.current.batchWorld||0)>(c.worstWorld.at(-1).batchWorld||0);
  // Detail belongs to the retained frame, not a later rolling/timer sample.
  // Do not allocate a throwaway copy for every ordinary captured frame.
  if(!stall&&!cpu&&!world)return;
  c.detailCopies++;
  const detail={...this.current,startedAt:this.startAt,finishedAt:performance.now(),gameTimeBefore:this.gameTimeBefore,gameTimeAfter:gameTime,phaseBefore:this.phaseBefore,phaseAfter:phase,levelBefore:this.levelBefore,levelAfter:level};
  if(stall){c.stallCount++;if(c.stalls.length===64)c.stalls.shift();c.stalls.push(detail);}
  if(cpu){c.worst.push(detail);c.worst.sort((a,b)=>b.cpu-a.cpu);c.worst.length=Math.min(12,c.worst.length);}
  if(world){c.worstWorld.push(detail);c.worstWorld.sort((a,b)=>(b.batchWorld||0)-(a.batchWorld||0));c.worstWorld.length=Math.min(12,c.worstWorld.length);}
 }
 beginCapture(){this.capture={started:performance.now(),count:0,over33:0,over50:0,over100:0,launchRenders:0,stallCount:0,stalls:[],worst:[],worstWorld:[],detailCopies:0,times:Object.fromEntries(CAPTURE_KEYS.map(k=>[k,new TimingAggregate()])),launch:new TimingAggregate(),gpu:new TimingAggregate()};}
 captureResult(){const c=this.capture;if(!c)return null;return {wallSeconds:(performance.now()-c.started)/1000,frames:c.count,fps:c.count*1000/c.times.frame.sum,over33:c.over33,over50:c.over50,over100:c.over100,times:Object.fromEntries(CAPTURE_KEYS.map(k=>[k,c.times[k].result()])),launchRenders:c.launchRenders,launchRenderCPU:c.launch.result(),stalls:c.stalls.map(f=>({...f})),stallCount:c.stallCount,worstCPU:c.worst.map(f=>({...f})),worstBatchWorld:c.worstWorld.map(f=>({...f})),gpuSupported:!!this.ext,gpu:c.gpu.result(),gpuSamples:c.gpu.count,measurement:{mode:'bounded-histogram',percentileError:'upper bound: <0.1ms below 100ms; <2% above 100ms',histogramBytes:(CAPTURE_KEYS.length+2)*2048*8,detailLimit:88,detailCopies:c.detailCopies,frameContext:'synchronous start/end game time, phase and level when supplied'}};}
 endCapture(){const result=this.captureResult();this.capture=null;return result;}
}






