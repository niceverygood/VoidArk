import test from 'node:test';
import assert from 'node:assert/strict';
import {createEndingPlayback,createEndingPreparation,deferEndingContextLoss} from '../src/ending-playback.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(prepare){
 let time=0,queued,frame;const calls={prepare:0,start:0,stop:0,release:0,complete:0,render:[]};
 const close=createEndingPlayback({prepare:()=>{calls.prepare++;return prepare();},
  now:()=>time,queue:fn=>{queued=fn;return 1;},cancelQueue:()=>{queued=null;},
  createClock:fn=>{frame=fn;return {start(){calls.start++;},stop(){calls.stop++;}};},
  render:t=>calls.render.push(t),release:()=>calls.release++,onComplete:()=>calls.complete++});
 return {calls,close,run:()=>queued?.(),tick:t=>{time=t;frame?.();}};
}

test('ending duration starts after preparation and closes the clock and resources once',async()=>{
 let ready;const f=fixture(()=>new Promise(resolve=>{ready=resolve;}));
 f.run();await flush();f.tick(5000);assert.equal(f.calls.start,0);
 ready();await flush();f.tick(13999);assert.deepEqual(f.calls.render,[8.999]);
 assert.equal(f.calls.complete,0);f.tick(14000);f.close();f.tick(15000);
 assert.deepEqual(f.calls,{prepare:1,start:1,stop:1,release:1,complete:1,render:[8.999,9]});
});

test('skipping before or during preparation prevents playback and safely releases once',async()=>{
 const early=fixture(()=>Promise.resolve());early.close();early.run();await flush();
 assert.equal(early.calls.prepare,0);assert.equal(early.calls.release,1);assert.equal(early.calls.complete,1);
 let ready;const pending=fixture(()=>new Promise(resolve=>{ready=resolve;}));
 pending.run();await flush();pending.close();pending.close();
 assert.equal(pending.calls.release,0);assert.equal(pending.calls.complete,1);
 ready();await flush();assert.equal(pending.calls.start,0);assert.equal(pending.calls.release,1);
});

test('failed preparation still returns to the result and releases resources',async()=>{
 const f=fixture(()=>{throw new Error('shader preparation failed');});f.run();await flush();f.close();
 assert.equal(f.calls.start,0);assert.equal(f.calls.release,1);assert.equal(f.calls.complete,1);
});

test('an ending preparation cancelled before allocation never creates a context',async()=>{
 let run,created=0,released=0;const p=createEndingPreparation(()=>created++,()=>released++,{queue:fn=>(run=fn,1),cancelQueue:()=>run=null});
 p.dispose();p.dispose();assert.equal(await p.ready,false);run?.();await flush();assert.equal(created,0);assert.equal(released,1);
});

test('ending preparation retains owned resources until a pending shader poll settles',async()=>{
 let done,run,released=0,lateDraws=0;const p=createEndingPreparation(async cancelled=>{await new Promise(r=>done=r);if(cancelled())return false;lateDraws++;},()=>released++,{queue:fn=>(run=fn,1)});
 run();await flush();p.dispose();p.dispose();assert.equal(released,0);done();assert.equal(await p.ready,false);await flush();assert.equal(released,1);assert.equal(lateDraws,0);
});

test('successful preparation can transfer ownership and partial failure releases once',async()=>{
 let run,released=0;const p=createEndingPreparation(()=>true,()=>released++,{queue:fn=>(run=fn,1)});run();assert.equal(await p.ready,true);await flush();assert.equal(released,0);p.dispose();p.dispose();assert.equal(released,1);
 const failed=createEndingPreparation(()=>{throw Error('partial allocation');},()=>released++,{queue:fn=>(run=fn,1)});run();assert.equal(await failed.ready,false);await flush();failed.dispose();assert.equal(released,2);
});

test('native context loss stays deferred until pending preparation releases the retired renderer',async()=>{
 let run,done,lossState,disposed=0,lost=0,lateDraws=0;const lossTasks=[];
 const renderer={dispose(){disposed++;},forceContextLoss(){lost++;}};
 const p=createEndingPreparation(async cancelled=>{await new Promise(resolve=>done=resolve);if(!cancelled())lateDraws++;},()=>{renderer.dispose();lossState=deferEndingContextLoss(renderer,{queue:fn=>lossTasks.push(fn)});},{queue:fn=>(run=fn,1)});
 run();await flush();p.dispose();p.dispose();assert.equal(disposed,0);assert.equal(lost,0);assert.equal(lossTasks.length,0);
 done();assert.equal(await p.ready,false);await flush();p.dispose();assert.equal(lateDraws,0);assert.equal(disposed,1);assert.equal(lost,0);assert.equal(lossTasks.length,1);assert.deepEqual(lossState,{pending:true,requested:false,error:null});
 lossTasks[0]();lossTasks[0]();assert.equal(disposed,1);assert.equal(lost,1);assert.deepEqual(lossState,{pending:false,requested:true,error:null});
});

test('context loss scheduling failure falls back once and native failure remains observable',()=>{
 let calls=0;const renderer={forceContextLoss(){calls++;}};
 const immediate=deferEndingContextLoss(renderer,{queue:()=>{throw Error('queue unavailable');}});assert.equal(calls,1);assert.deepEqual(immediate,{pending:false,requested:true,error:null});
 let queued;const failed=deferEndingContextLoss({forceContextLoss(){throw Error('controlled native failure');}},{queue:fn=>queued=fn});assert.equal(failed.error,null);queued();queued();assert.deepEqual(failed,{pending:false,requested:false,error:'controlled native failure'});
 assert.deepEqual(deferEndingContextLoss(null),{pending:false,requested:false,error:null});
});
