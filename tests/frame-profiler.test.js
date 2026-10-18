import test from 'node:test';import assert from 'node:assert/strict';import {FrameProfiler} from '../src/frame-profiler.js';
test('GPU diagnostic disable closes and deletes in-flight queries; ordinary pages cannot enable queries',()=>{const prev=globalThis.location;globalThis.location={search:'?qa=1&gpuProfile=0'};const events=[],ext={TIME_ELAPSED_EXT:7},gl={getExtension:()=>ext,endQuery:t=>events.push(['end',t]),deleteQuery:q=>events.push(['delete',q])};try{const p=new FrameProfiler(gl);assert.equal(p.ext,null);p.setGPUProfiling(true);p.query=10;p.pending=[11,12];p.setGPUProfiling(false);assert.deepEqual(events,[['end',7],['delete',10],['delete',11],['delete',12]]);assert.equal(p.ext,null);assert.equal(p.pending.length,0);assert.equal(p.query,null);globalThis.location={search:''};p.setGPUProfiling(true);assert.equal(p.ext,null);}finally{if(prev===undefined)delete globalThis.location;else globalThis.location=prev;}});
import {TimingAggregate} from '../src/frame-profiler.js';
test('bounded capture preserves every frame total and limits long-stall detail',()=>{const p=new FrameProfiler({getExtension:()=>null});p.beginCapture();for(let i=0;i<60000;i++){p.start();p.end(i<59900?16:200);}const r=p.endCapture();assert.equal(r.frames,60000);assert.equal(r.over100,100);assert.equal(r.stallCount,100);assert.equal(r.stalls.length,64);assert.ok(r.worstCPU.length<=12);assert.equal(r.times.frame.max,200);assert.ok(Math.abs(r.fps-60000000/(59900*16+100*200))<1e-9);assert.equal(r.measurement.histogramBytes,327680);assert.ok(r.times.frame.p95>=16&&r.times.frame.p95<=16.1);});
test('histogram percentile upper bounds cover exact short and long samples',()=>{const a=new TimingAggregate(),v=Array.from({length:1000},(_,i)=>i*.73);for(const n of v)a.add(n);const r=a.result();for(const [q,k] of [[.95,'p95'],[.99,'p99']]){const exact=v[Math.floor(v.length*q)];assert.ok(r[k]>=exact);assert.ok(r[k]<=exact*1.02);}assert.equal(a.bins.length,2048);});

test('world-only outlier retains its own synchronous context independently of CPU leaders',()=>{
 const original=globalThis.performance;let clock=0;globalThis.performance={now:()=>clock};
 try{
  const p=new FrameProfiler({getExtension:()=>null});p.beginCapture();
  for(let i=0;i<1000;i++){
   p.start(i*.016,'playing',i===500?6:5);
   clock+=i===500?20:2;p.mark('batchWorld');
   clock+=i<12?40:4;
   p.end(16,i*.016+.016,i===500?'upgrade':'playing',i===500?7:5);
  }
  const r=p.captureResult(),world=r.worstBatchWorld[0];
  assert.equal(world.batchWorld,20);assert.equal(world.gameTimeBefore,8);assert.equal(world.gameTimeAfter,8.016);
  assert.equal(world.phaseBefore,'playing');assert.equal(world.phaseAfter,'upgrade');assert.equal(world.levelBefore,6);assert.equal(world.levelAfter,7);
  assert.ok(r.worstCPU.every(f=>f.cpu===42));assert.equal(r.worstBatchWorld.length,12);
  assert.equal(r.frames,1000);assert.equal(r.times.batchWorld.mean,2.018);assert.equal(r.over100,0);
  assert.equal(r.measurement.detailCopies,13);assert.equal(r.measurement.detailLimit,88);
  world.gameTimeBefore=-1;assert.equal(p.captureResult().worstBatchWorld[0].gameTimeBefore,8);
 }finally{globalThis.performance=original;}
});

test('stalls retain immutable frame context while details remain bounded and summaries stay numerical',()=>{
 const original=globalThis.performance;let clock=0;globalThis.performance={now:()=>clock};
 try{
  const p=new FrameProfiler({getExtension:()=>null});p.beginCapture();
  for(let i=0;i<100;i++){p.start(i,'playing',1);clock++;p.end(120,i+1,'playing',1);}
  const r=p.endCapture();assert.equal(r.stallCount,100);assert.equal(r.stalls.length,64);
  assert.equal(r.stalls[0].gameTimeBefore,36);assert.equal(r.stalls.at(-1).gameTimeAfter,100);
  assert.equal(r.measurement.detailCopies,100);assert.equal(r.times.cpu.mean,1);
  assert.equal(p.last.gameTimeBefore,undefined);assert.equal(p.last.phaseBefore,undefined);
  assert.equal(r.worstCPU.length,12);assert.equal(r.worstBatchWorld.length,12);
 }finally{globalThis.performance=original;}
});
