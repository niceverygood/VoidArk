import test from 'node:test';import assert from 'node:assert/strict';import {AssetPool} from '../src/asset-pool.js';
const flush=()=>new Promise(r=>setImmediate(r));
test('concurrent instances share one load; active assets survive idle eviction and release is idempotent',async()=>{
 const loads=[],disposed=[],pool=new AssetPool(async id=>{loads.push(id);return {id};},r=>disposed.push(r.id),{idleLimit:1});
 const a=pool.acquire('ship'),b=pool.acquire('ship');assert.equal(await a.ready,await b.ready);assert.deepEqual(loads,['ship']);a.release();a.release();assert.equal(pool.diagnostics().instances,1);
 for(const id of ['rock','station']){const h=pool.acquire(id);await h.ready;h.release();}assert.deepEqual(disposed,['rock']);assert.equal(pool.entries.has('ship'),true);b.release();assert.equal(pool.diagnostics().instances,0);assert.equal(pool.entries.size,1);
});
test('loading is bounded, a destroyed instance cannot retain a late asset, and failure can retry',async()=>{
 let pending=[],disposed=[],calls=0;const pool=new AssetPool(id=>new Promise((resolve,reject)=>{calls++;pending.push({id,resolve,reject});}),r=>disposed.push(r),{concurrency:1,idleLimit:0});
 const a=pool.acquire('gone'),b=pool.acquire('bad');assert.equal(calls,1);a.release();pending.shift().resolve('gone');await a.ready;await flush();assert.deepEqual(disposed,['gone']);assert.equal(calls,2);pending.shift().reject(Error('offline'));assert.equal(await b.ready,null);b.release();await flush();const retry=pool.acquire('bad');assert.equal(calls,3);pending.shift().resolve('recovered');assert.equal(await retry.ready,'recovered');retry.release();assert.equal(pool.diagnostics().instances,0);
});
