import fs from 'node:fs';import * as THREE from 'three';import {performance} from 'node:perf_hooks';
import {ProjectileVisuals as Native} from '../src/projectile-visuals.js';
import {ProjectileVisuals as Candidate} from './projectile-glow-project/src/projectile-visuals.js';
const assets=()=>({ready:Promise.resolve([]),release(){}});
function stats(values){const a=values.toSorted((x,y)=>x-y);return {mean:values.reduce((s,x)=>s+x,0)/values.length,p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)};}
function run(Type,shared,rate){
 const v=new Type(new THREE.Scene(),{acquireAssets:assets,shareGlowMaterials:shared}),live=[],frames=[];let id=0,accum=0,creates=0,disposed=0,peak=0;
 const start=performance.now();
 for(let frame=0;frame<600;frame++){
  const at=performance.now();accum+=rate/60;
  while(accum>=1){accum--;const k=id++%6,shot={id,type:k===0||k===2?'missile':k===1?'enemyMissile':k===3?'boss':'cannon',visualVariant:k===2?'barrage':null,friendly:k!==5,position:{x:0,y:0,z:0},direction:{x:.4,y:.2,z:-1}};live.push({root:v.create(shot),shot,birth:frame});creates++;}
  peak=Math.max(peak,live.length);
  for(let i=live.length-1;i>=0;i--){const x=live[i];if(frame-x.birth>=60){x.root.userData.dispose();live.splice(i,1);disposed++;continue;}x.shot.position.x+=.1;x.shot.position.z-=.2;v.update(x.root,x.shot,1/60,frame/60,false);}
  frames.push(performance.now()-at);
 }
 for(const x of live){x.root.userData.dispose();disposed++;}
 const totalMs=performance.now()-start,pool=v.glowPool?.diagnostics();v.dispose();
 if(creates!==disposed||pool&&(pool.entries||pool.refs||pool.created!==pool.released))throw Error('Resource lifetime mismatch');
 return {totalMs,frames:stats(frames),creates,disposed,peak,materialCreates:pool?.created??creates*2,pool};
}
const rows=[];for(const rate of [12,60,240]){
 run(Native,false,rate);run(Candidate,true,rate);const pairs=[];
 for(let i=0;i<8;i++){let before,after;if(i%2){after=run(Candidate,true,rate);before=run(Native,false,rate);}else{before=run(Native,false,rate);after=run(Candidate,true,rate);}pairs.push({order:i%2?'BA':'AB',before,after});}
 const avg=(which,key)=>pairs.reduce((s,p)=>s+p[which][key],0)/pairs.length;
 rows.push({ratePerLogicalSecond:rate,logicalFrames:600,lifeFrames:60,meanTotalMs:{before:avg('before','totalMs'),after:avg('after','totalMs')},pairs});
}
const result={at:new Date().toISOString(),scope:'Actual native/candidate ProjectileVisuals.create/update(active=false)/root disposal. Explicit memory shots and empty asset adapter; Node window undefined disables GLB mounts. No Simulation, storage, browser, GPU, wake tick, real frame scheduling or Steam FPS. Eight alternating-order pairs; host/GC jitter retained, not attributed.',rows};
fs.writeFileSync('qa/projectile-glow-factory-cpu.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({rate:r.ratePerLogicalSecond,mean:r.meanTotalMs,peak:r.pairs[0].before.peak,created:r.pairs[0].before.creates,materialCreates:[r.pairs[0].before.materialCreates,r.pairs[0].after.materialCreates],pairMeanCPU:r.pairs.map(p=>[p.before.frames.mean,p.after.frames.mean]),pairMaxCPU:r.pairs.map(p=>[p.before.frames.max,p.after.frames.max])})),null,2));
