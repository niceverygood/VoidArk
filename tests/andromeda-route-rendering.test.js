import test from 'node:test';
import assert from 'node:assert/strict';
import {startAndromedaRouteRendering} from '../src/andromeda-route-rendering.js';

function fixture({parallel=true}={}) {
 const canvas=new EventTarget();canvas.dataset={};canvas.setAttribute=()=>{};
 const frames=new Map(),timers=new Map(),calls=[],materials=[{},{}],readyMaterials=new Set();let id=0,drawFails=false;
 const renderer={domElement:canvas,extensions:{get(){calls.push('extension');return parallel?{}:null;}},
  compile(){calls.push('compile');return new Set(materials);},properties:{get(material){calls.push('properties');return {currentProgram:{isReady(){calls.push('poll');return readyMaterials.has(material);}}};}}};
 const work={renderer,scene:{},camera:{},prepare(){calls.push('prepare');},draw(){if(drawFails)throw Error('draw');calls.push('draw');},release(){calls.push('release');}};
 const close=startAndromedaRouteRendering(work,{requestFrame(fn){frames.set(++id,fn);return id;},cancelFrame(id){frames.delete(id);},schedule(fn,ms){assert.equal(ms,10);timers.set(++id,fn);return id;},cancel(id){timers.delete(id);}});
 const run=queue=>{const [id,fn]=queue.entries().next().value;queue.delete(id);fn();};
 return {canvas,renderer,work,calls,frames,timers,close,frame:()=>run(frames),poll:()=>run(timers),ready:(index=null)=>{for(const material of index===null?materials:[materials[index]])readyMaterials.add(material);},failDraw:()=>drawFails=true};
}

test('picker close cancels its compiler polls and prevents late drawing or use of released programs',()=>{
 const early=fixture();early.close();early.close();assert.deepEqual(early.calls,['release']);assert.equal(early.frames.size,0);
 const f=fixture();f.frame();assert.ok(f.calls.includes('compile'));assert.ok(!f.calls.includes('draw'));const late=f.timers.values().next().value;
 f.close();f.ready();const calls=[...f.calls];late();f.close();assert.deepEqual(f.calls,calls);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.equal(f.calls.filter(x=>x==='release').length,1);
});

test('the first route draw waits for every program, then closing stops its animation without changing scene ownership',()=>{
 const f=fixture();f.frame();f.ready(0);f.poll();assert.equal(f.frames.size,0);assert.ok(!f.calls.includes('draw'));f.ready(1);f.poll();assert.ok(!f.calls.includes('draw'));f.frame();assert.equal(f.canvas.dataset.routeState,'ready');assert.equal(f.calls.filter(x=>x==='draw').length,1);f.frame();assert.equal(f.calls.filter(x=>x==='compile').length,1);
 const late=f.frames.values().next().value;f.close();late();assert.equal(f.calls.filter(x=>x==='draw').length,2);assert.equal(f.frames.size,0);
});

test('context loss cancels pending readiness, restoration recompiles the live view, and closed views cannot restart',()=>{
 const f=fixture();f.frame();const loss=new Event('webglcontextlost',{cancelable:true});f.canvas.dispatchEvent(loss);assert.equal(loss.defaultPrevented,true);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.equal(f.canvas.dataset.routeState,'context-lost');assert.ok(!f.calls.includes('release'));
 f.canvas.dispatchEvent(new Event('webglcontextrestored'));f.ready();f.frame();f.frame();assert.equal(f.calls.filter(x=>x==='compile').length,2);assert.equal(f.calls.filter(x=>x==='draw').length,1);
 f.close();f.canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(f.frames.size,0);assert.equal(f.calls.filter(x=>x==='release').length,1);
});

test('unsupported parallel compilation keeps the normal draw path; compile, readiness and draw failures release once',()=>{
 const unsupported=fixture({parallel:false});unsupported.frame();unsupported.frame();assert.ok(unsupported.calls.includes('draw'));assert.ok(!unsupported.calls.includes('compile'));assert.ok(!unsupported.calls.includes('poll'));unsupported.close();
 for(const stage of ['compile','poll','draw']){const f=fixture();if(stage==='compile')f.renderer.compile=()=>{throw Error('compile');};else if(stage==='poll')f.renderer.properties.get=()=>{throw Error('poll');};else {f.ready();f.failDraw();}
  f.frame();if(f.frames.size)f.frame();assert.equal(f.canvas.dataset.routeState,'failed');assert.equal(f.calls.filter(x=>x==='release').length,1);assert.equal(f.frames.size+f.timers.size,0);f.close();}
});
