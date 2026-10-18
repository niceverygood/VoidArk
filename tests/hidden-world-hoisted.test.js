import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {markHiddenMatrixBranch,propagateVisibleMatrices as baseline,propagateVisibleMatricesHoisted as hoisted} from '../src/hidden-world-matrices.js';
import {AssetInstanceBatch} from '../src/asset-instance-batch.js';

function fixture(){
 const scene=new THREE.Scene(),parent=new THREE.Group(),live=new THREE.Group(),hidden=new THREE.Group(),leaf=new THREE.Group(),manual=new THREE.Group();
 scene.add(parent);parent.add(live,hidden,manual);live.add(leaf);hidden.add(new THREE.Group());
 scene.rotation.set(.13,.27,-.31);parent.position.set(3,-2,5);parent.rotation.set(-.23,.87,.45);parent.scale.set(-2,.7,3);
 live.position.set(-4,8,1);live.scale.set(.6,2,1.5);leaf.rotation.set(.9,-.2,.4);hidden.visible=false;hidden.userData.hiddenMatrixBranch=true;
 manual.matrixAutoUpdate=false;manual.matrixWorldAutoUpdate=false;manual.matrixWorld.makeTranslation(33,-21,7);manual.add(new THREE.Group());
 return {scene,parent,live,hidden,leaf,manual};
}
const words=values=>new Uint32Array(new Float64Array(values).buffer);
function nodes(root){const result=[];root.traverse(o=>result.push(o));return result;}
function same(a,b){const left=nodes(a),right=nodes(b);assert.equal(left.length,right.length);for(let i=0;i<left.length;i++){
 assert.deepEqual(words(left[i].matrixWorld.elements),words(right[i].matrixWorld.elements),`world ${i}`);assert.deepEqual(words(left[i].matrix.elements),words(right[i].matrix.elements),`local ${i}`);
 for(const key of ['matrixWorldNeedsUpdate','matrixAutoUpdate','matrixWorldAutoUpdate'])assert.equal(left[i][key],right[i][key],`${key} ${i}`);
 }}
function run(a,b,key='scene'){assert.deepEqual(hoisted(a[key],{}),baseline(b[key],{}));same(a[key],b[key]);}

const ORIGINAL_WALKER="function propagateVisibleMatrices(root,stats={}) {\r\n stats.visited=stats.deferred=stats.custom=0;\r\n function visit(o,force){\r\n  stats.visited++;\r\n  if(o.updateMatrixWorld!==nativeUpdate){stats.custom++;o.updateMatrixWorld(force);return;}\r\n  if(!o.visible&&o.userData.hiddenMatrixBranch){\r\n   // Force all descendants to catch up if the branch becomes visible again.\r\n   o.matrixWorldNeedsUpdate=true;stats.deferred++;return;\r\n  }\r\n  // Native propagation is retained for explicit coordinate queries.\r\n  if(o.matrixAutoUpdate)o.updateMatrix();\r\n  if(o.matrixWorldNeedsUpdate||force){\r\n   if(o.matrixWorldAutoUpdate){if(o.parent===null)o.matrixWorld.copy(o.matrix);else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld,o.matrix);}\r\n   o.matrixWorldNeedsUpdate=false;force=true;\r\n  }\r\n  for(const child of o.children)visit(child,force);\r\n }\r\n visit(root,false);return stats;\r\n}";

test('original walker stays byte-for-byte unchanged and hoisted preserves exact shear/negative scale/manual flags',()=>{
 assert.equal(baseline.toString(),ORIGINAL_WALKER);
 const a=fixture(),b=fixture();run(a,b);
 for(const f of [a,b]){f.parent.matrixAutoUpdate=false;f.parent.matrix.set(1,.2,-.4,4,.3,-2,.1,-3,-.1,.4,3,2,0,0,0,1);f.parent.matrixWorldNeedsUpdate=true;f.live.matrixWorldAutoUpdate=false;f.live.matrixWorldNeedsUpdate=true;f.leaf.matrixAutoUpdate=false;f.leaf.matrix.makeRotationZ(.76);f.leaf.matrixWorldNeedsUpdate=true;}
 run(a,b);
});

test('hidden branch defers all descendants even force; visible recovery, reparent/null and explicit world queries stay native',()=>{
 const a=fixture(),b=fixture();run(a,b);const old=words(a.hidden.children[0].matrixWorld.elements);
 for(let i=0;i<3;i++){for(const f of [a,b]){f.parent.position.x=20+i;f.hidden.position.z=-40;f.hidden.children[0].position.y=50;}run(a,b);assert.deepEqual(words(a.hidden.children[0].matrixWorld.elements),old);}
 for(const f of [a,b])f.hidden.visible=true;run(a,b);
 for(const f of [a,b]){f.scene.add(f.live);f.live.matrixWorldNeedsUpdate=true;}run(a,b);
 for(const f of [a,b]){f.live.removeFromParent();f.live.position.set(7,-9,13);}run(a,b,'live');
 for(const f of [a,b]){f.hidden.visible=false;f.parent.position.set(19,3,8);}
 assert.deepEqual(words(a.hidden.children[0].getWorldPosition(new THREE.Vector3()).toArray()),words(b.hidden.children[0].getWorldPosition(new THREE.Vector3()).toArray()));
});

test('custom root/child delegates before hidden predicate and sees exact force and live child mutation order',()=>{
 for(const customRoot of [false,true]){
  const a=fixture(),b=fixture(),events=[[],[]];
  for(const [i,f] of [a,b].entries()){
   const target=customRoot?f.scene:f.live;target.visible=false;target.userData.hiddenMatrixBranch=true;
   target.updateMatrixWorld=function(force){events[i].push(['custom',force]);const extra=new THREE.Group();extra.position.z=77;this.add(extra);if(!customRoot)this.parent.remove(f.hidden);THREE.Object3D.prototype.updateMatrixWorld.call(this,force);};
  }
  run(a,b);assert.deepEqual(events[0],events[1]);assert.deepEqual(events[0],[['custom',!customRoot]]);
 }
});

test('literal getter/property and stats accessor sequence matches original including method second lookup',()=>{
 const make=()=>{
  const f=fixture(),log=[];let customCalls=0;
  function watch(o,key,name){let value=o[key];Object.defineProperty(o,key,{configurable:true,get(){log.push(`${name}.${key}:get`);return value;},set(v){log.push(`${name}.${key}:set:${String(v)}`);value=v;}});}
  for(const [name,o] of Object.entries(f))for(const key of ['updateMatrixWorld','visible','matrixAutoUpdate','matrixWorldNeedsUpdate','matrixWorldAutoUpdate','parent','children'])watch(o,key,name);
  f.live.updateMatrixWorld=function(force){customCalls++;log.push(`custom:${force}`);};
  const values={},stats={};for(const key of ['visited','deferred','custom'])Object.defineProperty(stats,key,{get(){log.push(`stats.${key}:get`);return values[key];},set(v){log.push(`stats.${key}:set:${v}`);values[key]=v;}});
  log.length=0;return {f,log,stats,values,get customCalls(){return customCalls;}};
 };
 const a=make(),b=make();hoisted(a.f.scene,a.stats);baseline(b.f.scene,b.stats);assert.deepEqual(a.log,b.log);assert.deepEqual(a.values,b.values);assert.equal(a.customCalls,b.customCalls);
});

test('custom method is reread with its receiver; custom/visible short circuits never touch hidden userData',()=>{
 const make=()=>{const scene=new THREE.Scene(),custom=new THREE.Group(),visible=new THREE.Group(),log=[];scene.add(custom,visible);let reads=0;
  Object.defineProperty(custom,'updateMatrixWorld',{get(){log.push(`method:${++reads}`);if(reads===1)return function firstLookup(){};return function(force){assert.equal(this,custom);log.push(`delegate:${force}`);};}});
  Object.defineProperty(custom,'visible',{get(){throw new Error('custom visible read');}});
  for(const node of [custom,visible])Object.defineProperty(node,'userData',{get(){throw new Error('hidden userData read');}});
  return {scene,log};};
 const a=make(),b=make();assert.deepEqual(hoisted(a.scene,{}),baseline(b.scene,{}));assert.deepEqual(a.log,b.log);assert.deepEqual(a.log,['method:1','method:2','delegate:true']);same(a.scene,b.scene);
});

test('native live for-of preserves custom iterator yields, close and exact thrown error',()=>{
 const error=new Error('same object'),a=fixture(),b=fixture(),logs=[[],[]],sa={},sb={};
 for(const [i,f] of [a,b].entries()){
  const original=f.parent.children;
  original[Symbol.iterator]=function(){let index=0;logs[i].push('open');return {next(){logs[i].push(`next:${index}`);return index<original.length?{value:original[index++],done:false}:{done:true};},return(){logs[i].push('close');return {done:true};}};};
  f.manual.updateMatrixWorld=function(force){logs[i].push(`throw:${force}`);throw error;};
 }
 assert.throws(()=>hoisted(a.scene,sa),e=>e===error);assert.throws(()=>baseline(b.scene,sb),e=>e===error);assert.deepEqual(logs[0],logs[1]);assert.equal(logs[0].at(-1),'close');assert.deepEqual(sa,sb);same(a.scene,b.scene);
});

test('custom sibling removal/add/reparent and nested propagation retain original native for-of result',()=>{
 const a=fixture(),b=fixture(),logs=[[],[]];
 for(const [i,f] of [a,b].entries()){
  f.live.updateMatrixWorld=function(force){logs[i].push(force);f.parent.remove(f.hidden);const added=new THREE.Group();added.position.x=39;f.parent.add(added);f.scene.add(f.manual);THREE.Object3D.prototype.updateMatrixWorld.call(this,force);};
  f.manual.updateMatrixWorld=function(force){logs[i].push(['nested',force]);(i===0?hoisted:baseline)(f.hidden,{});THREE.Object3D.prototype.updateMatrixWorld.call(this,force);};
 }
 run(a,b);assert.deepEqual(logs[0],logs[1]);same(a.hidden,b.hidden);
});

test('hidden setter/getter exceptions preserve partial state and unwind every ancestor iterator',()=>{
 for(const type of ['method','hiddenSetter','local']){
  const a=fixture(),b=fixture(),error=new Error(type),sa={},sb={};
  for(const f of [a,b]){
   if(type==='method')Object.defineProperty(f.live,'updateMatrixWorld',{get(){throw error;}});
   if(type==='hiddenSetter')Object.defineProperty(f.hidden,'matrixWorldNeedsUpdate',{get(){return false;},set(){throw error;}});
   if(type==='local')f.live.updateMatrix=function(){throw error;};
  }
  assert.throws(()=>hoisted(a.scene,sa),e=>e===error);assert.throws(()=>baseline(b.scene,sb),e=>e===error);assert.deepEqual(sa,sb);same(a.scene,b.scene);
 }
});

test('source resources, layers, object identity and RNG ownership are unchanged; same stats object returned',()=>{
 const a=fixture(),b=fixture(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();let disposals=0;geometry.addEventListener('dispose',()=>disposals++);material.addEventListener('dispose',()=>disposals++);
 a.live.add(new THREE.Mesh(geometry,material));b.live.add(new THREE.Mesh(geometry,material));a.live.layers.set(4);b.live.layers.set(4);
 const originalRandom=Math.random;let randomCalls=0;Math.random=()=>{randomCalls++;return .5;};
 try{const stats={};assert.equal(hoisted(a.scene,stats),stats);baseline(b.scene,{});same(a.scene,b.scene);assert.equal(a.live.children[1].geometry,geometry);assert.equal(b.live.children[1].material,material);assert.equal(a.live.layers.mask,b.live.layers.mask);assert.equal(disposals,0);assert.equal(randomCalls,0);}finally{Math.random=originalRandom;}
});

test('AssetInstanceBatch defaults to hoisted propagation and retains original toggle, hidden queries and late-mount recovery',()=>{
 const a=fixture(),b=fixture(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();let disposals=0;
 geometry.addEventListener('dispose',()=>disposals++);material.addEventListener('dispose',()=>disposals++);
 for(const f of [a,b]){
  for(let i=0;i<3;i++){const mesh=new THREE.Mesh(geometry,material);mesh.userData.meshy=true;mesh.position.x=i;f.live.add(mesh);}
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.meshy=true;f.hidden.add(mesh);markHiddenMatrixBranch(f.hidden);f.batch=new AssetInstanceBatch(f.scene);
 }
 try{
  assert.equal(a.batch.hoistHiddenWorldGuards,true);b.batch.hoistHiddenWorldGuards=false;a.batch.update(0);b.batch.update(0);same(a.scene,b.scene);assert.deepEqual(a.batch.hiddenMatrices,b.batch.hiddenMatrices);assert.equal(a.batch.stats.instances,3);
  for(const f of [a,b])f.parent.position.x=44;
  assert.deepEqual(words(a.hidden.children[1].getWorldPosition(new THREE.Vector3()).toArray()),words(b.hidden.children[1].getWorldPosition(new THREE.Vector3()).toArray()));
  for(const f of [a,b]){f.hidden.visible=true;f.parent.rotation.z=.89;}a.batch.update(10);b.batch.update(10);same(a.scene,b.scene);assert.equal(a.batch.stats.instances,4);assert.deepEqual(a.batch.hiddenMatrices,b.batch.hiddenMatrices);
  a.batch.hoistHiddenWorldGuards=false;b.batch.hoistHiddenWorldGuards=true;
  for(const f of [a,b]){f.hidden.visible=false;f.hidden.add(new THREE.Bone());f.parent.position.y=-17;assert.equal(f.hidden.userData.hiddenMatrixBranch,undefined);}
  a.batch.update(20);b.batch.update(20);same(a.scene,b.scene);assert.deepEqual(a.batch.hiddenMatrices,b.batch.hiddenMatrices);assert.equal(a.batch.stats.matrixDeferred,0);assert.equal(a.batch.audit().valid,true);assert.equal(b.batch.audit().valid,true);
 }finally{a.batch.dispose();b.batch.dispose();}
 assert.equal(disposals,0);for(const f of [a,b])for(const node of nodes(f.scene))if(node.isMesh)assert.equal(node.layers.mask,1);geometry.dispose();material.dispose();
});
