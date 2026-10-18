import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createStableOutput} from '../src/stable-output.js';

function setup(){
 const scene=new THREE.Scene(),points=new THREE.PointsMaterial({size:3});scene.add(new THREE.Points(new THREE.BufferGeometry(),points));
 const prior={},calls=[],renderer={getRenderTarget:()=>prior,setRenderTarget:t=>calls.push(['restore',t])};
 const composer={readBuffer:{texture:{}},copyPass:{renderToScreen:false,render(...args){calls.push(['copy',this.renderToScreen,...args]);}},render(){calls.push(['scene',points.size]);}};
 const output={renderToScreen:false,render(...args){calls.push(['output',this.renderToScreen,...args]);}};
 return {points,calls,prior,renderer,composer,output,surface:createStableOutput(renderer,composer,output,scene)};
}
test('matching output resolution keeps the complete scene/output shader and skips only the redundant copy',()=>{
 const f=setup();f.surface.configure(true,1280,720,1);f.surface.render();
 assert.deepEqual(f.calls.map(c=>c[0]),['scene','output','restore']);
 assert.equal(f.calls[1][1],true);assert.equal(f.calls[1][3],null);assert.equal(f.calls[1][4],f.composer.readBuffer);
 assert.equal(f.calls[2][1],f.prior);assert.equal(f.points.size,3);assert.equal(f.output.renderToScreen,false);assert.equal(f.composer.copyPass.renderToScreen,false);
 f.surface.setNativeDirect(false);f.calls.length=0;f.surface.render();assert.deepEqual(f.calls.map(c=>c[0]),['scene','output','copy','restore']);f.surface.dispose();
});
test('reduced resolution still tone maps before upscale, including resolution recovery and interrupted output',()=>{
 const f=setup();f.surface.configure(true,896,504,.7);f.surface.render();assert.deepEqual(f.calls.map(c=>c[0]),['scene','output','copy','restore']);
 assert.ok(Math.abs(f.calls[0][1]-2.1)<1e-12);assert.equal(f.calls[1][1],false);assert.equal(f.calls[1][3],f.surface.target);
 assert.equal(f.calls[2][1],true);assert.equal(f.calls[2][4],f.surface.target);assert.equal(f.points.size,3);
 f.surface.configure(true,1280,720,1);f.output.render=function(){throw Error('output lost');};f.calls.length=0;
 assert.throws(()=>f.surface.render(),/output lost/);assert.equal(f.calls.at(-1)[1],f.prior);assert.equal(f.points.size,3);assert.equal(f.output.renderToScreen,false);assert.equal(f.composer.copyPass.renderToScreen,false);f.surface.dispose();
});
