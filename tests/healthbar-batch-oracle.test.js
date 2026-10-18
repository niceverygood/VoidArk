import test from 'node:test';
import assert from 'node:assert/strict';
import {compareHealthBarBatchRendering} from '../src/healthbar-batch-oracle.js';

function fixture({enabled=true,previousCamera={id:'primary'},throwStage=null}={}){
 const scene={},camera={id:'secondary'},trace=[],planes=[{visible:true,layers:{mask:5}},{visible:false,layers:{mask:1}}];
 const originalMasks=planes.map(plane=>plane.layers.mask),resource={disposed:false,color:'source-color'};
 const batch={enabled:false,camera:previousCamera,setEnabled(value){this.enabled=value;planes.forEach((plane,i)=>plane.layers.mask=value?originalMasks[i]&~1:originalMasks[i]);trace.push(['enabled',value]);},update(selected,options){this.camera=selected;trace.push(['update',selected,options.worldMatricesFresh]);}};
 batch.setEnabled(enabled);trace.length=0;const initial=planes.map(plane=>({visible:plane.visible,mask:plane.layers.mask}));
 const native=[10,20,30,255,50,60,70,255],instanced=[11,20,39,255,50,60,70,254];
 let reads=0;
 const gl={RGBA:6408,UNSIGNED_BYTE:5121,readPixels(x,y,width,height,format,type,target){trace.push(['read',batch.enabled]);assert.deepEqual([x,y,width,height,format,type],[0,0,2,1,6408,5121]);reads++;if(throwStage==='read')throw Error('healthbar read failure');target.set(batch.enabled?instanced:native);}};
 const renderer={domElement:{width:2,height:1},getContext:()=>gl,info:{render:{calls:17,triangles:31},reset(){trace.push(['reset']);this.render.calls=this.render.triangles=0;}}};
 const refresh=()=>trace.push(['refresh']);
 const render=(selectedScene,selectedCamera)=>{
  trace.push(['render',batch.enabled]);assert.equal(selectedScene,scene);assert.equal(selectedCamera,camera);assert.equal(batch.camera,camera);
  assert.deepEqual(planes.map(plane=>plane.layers.mask),originalMasks.map(mask=>batch.enabled?mask&~1:mask));assert.deepEqual(planes.map(plane=>plane.visible),[true,false]);
  if(throwStage==='render'&&batch.enabled)throw Error('healthbar render failure');renderer.info.render.calls=batch.enabled?2:4;renderer.info.render.triangles=8;
 };
 return {scene,camera,batch,renderer,render,refresh,trace,planes,initial,resource,get reads(){return reads;},restored(){assert.equal(batch.enabled,enabled);assert.equal(batch.camera,previousCamera);assert.deepEqual(planes.map(plane=>({visible:plane.visible,mask:plane.layers.mask})),initial);assert.deepEqual(resource,{disposed:false,color:'source-color'});}};
}

test('same-frame native/batched captures use matching camera/order and report RGBA differences',()=>{
 const f=fixture(),refreshCameras=[],refresh=f.refresh;f.refresh=selected=>{refreshCameras.push(selected);refresh();};const result=compareHealthBarBatchRendering(f);f.restored();
 assert.deepEqual(result,{width:2,height:1,before:{calls:4,triangles:8},after:{calls:2,triangles:8},rmsRGBA:Math.sqrt(83/8),maxChannelDifference:9,changedChannels:3,pixelsOver8:1});
 assert.deepEqual(f.trace,[['enabled',false],['refresh'],['update',f.camera,true],['reset'],['render',false],['read',false],['enabled',true],['refresh'],['update',f.camera,true],['reset'],['render',true],['read',true],['enabled',true],['refresh'],['update',f.batch.camera,true]]);
 assert.deepEqual(refreshCameras,[f.camera,f.camera,f.batch.camera]);
});

test('render failure restores native mode, null camera, source layers and visibility',()=>{
 const f=fixture({enabled:false,previousCamera:null,throwStage:'render'});assert.throws(()=>compareHealthBarBatchRendering(f),/healthbar render failure/);f.restored();assert.equal(f.reads,1);assert.deepEqual(f.trace.slice(-3),[['enabled',false],['refresh'],['update',null,true]]);
});

test('readback failure restores the prior selected batch without advancing or releasing source state',()=>{
 const previousCamera={id:'held-main'},f=fixture({previousCamera,throwStage:'read'});assert.throws(()=>compareHealthBarBatchRendering(f),/healthbar read failure/);f.restored();assert.equal(f.reads,1);assert.deepEqual(f.trace.slice(-3),[['enabled',true],['refresh'],['update',previousCamera,true]]);
});

test('restoration still resets the camera if optional refresh fails, and absent refresh requests world updates',()=>{
 const f=fixture({enabled:false,previousCamera:null});let refreshes=0;f.refresh=()=>{if(++refreshes===3)throw Error('restore refresh failure');};assert.throws(()=>compareHealthBarBatchRendering(f),/restore refresh failure/);f.restored();
 const plain=fixture();delete plain.refresh;compareHealthBarBatchRendering(plain);plain.restored();assert(plain.trace.filter(row=>row[0]==='update').every(row=>row[2]===false));
});
