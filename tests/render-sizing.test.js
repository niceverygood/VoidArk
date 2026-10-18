import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderSizing} from '../src/render-sizing.js';
function fixture(){
 const log=[],canvas={style:{}},camera={aspect:1280/720,updateProjectionMatrix(){log.push('projection');}};
 const renderer={domElement:canvas,getSize:t=>t.set(1280,720),getPixelRatio:()=>1,setDrawingBufferSize(w,h,r){log.push(['canvas',w,h,r]);canvas.width=Math.floor(w*r);canvas.height=Math.floor(h*r);}};
 const composer={setPixelRatio:r=>log.push(['ratio',r]),setSize:(w,h)=>log.push(['size',w,h])};
 return {log,canvas,camera,apply:createRenderSizing(renderer,composer,camera).apply};
}
test('unchanged frame dimensions never reset the drawing canvas; scale changes keep logical CSS and projection',()=>{
 const f=fixture();assert.equal(f.apply(1280,720,1),false);assert.deepEqual(f.log,[]);
 f.apply(1280,720,.9);assert.equal(f.canvas.width,1152);assert.equal(f.canvas.height,648);
 assert.deepEqual(f.canvas.style,{width:'1280px',height:'720px'});assert.equal(f.camera.aspect,1280/720);
 assert.equal(f.log.filter(r=>r==='projection').length,0);assert.equal(f.log.filter(r=>Array.isArray(r)&&r[0]==='canvas').length,1);
 const count=f.log.length;assert.equal(f.apply(1280,720,.9),false);assert.equal(f.log.length,count);
});
test('window resize with a changed DPR updates physical pixels and aspect; context restoration forces an unchanged size',()=>{
 const f=fixture();f.apply(800,600,1.5);assert.equal(f.canvas.width,1200);assert.equal(f.canvas.height,900);assert.equal(f.camera.aspect,4/3);
 assert.ok(f.log.some(r=>Array.isArray(r)&&r[0]==='size'&&r[1]===800&&r[2]===600));
 f.log.length=0;assert.equal(f.apply(800,600,1.5),false);assert.equal(f.apply(800,600,1.5,{force:true}),true);
 assert.deepEqual(f.log,[['canvas',800,600,1.5],['ratio',1.5],'projection']);
});
test('high-quality scene scale changes leave the native output canvas untouched',()=>{
 const f=fixture();f.apply(1280,720,.9,{outputRatio:1});
 assert.equal(f.log.filter(r=>Array.isArray(r)&&r[0]==='canvas').length,0);
 assert.deepEqual(f.log,[['ratio',.9]]);
 f.apply(1280,720,.8,{outputRatio:1});assert.equal(f.log.filter(r=>Array.isArray(r)&&r[0]==='canvas').length,0);
 f.apply(1280,720,.8,{outputRatio:.8});assert.equal(f.canvas.width,1024);assert.equal(f.canvas.height,576);
});
