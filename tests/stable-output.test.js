import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createStableOutput} from '../src/stable-output.js';
test('scene-point adjustment is restored after rendering fails and borrowed materials are never disposed',()=>{
 const scene=new THREE.Scene(),material=new THREE.PointsMaterial({size:3});scene.add(new THREE.Points(new THREE.BufferGeometry(),material));let disposals=0;material.addEventListener('dispose',()=>disposals++);
 const previous={},renderer={getRenderTarget:()=>previous,setRenderTarget:t=>assert.equal(t,previous)};
 const composer={copyPass:{renderToScreen:false},render(){assert.ok(Math.abs(material.size-2.1)<1e-12);throw Error('render interrupted');}},output={};
 const surface=createStableOutput(renderer,composer,output,scene);surface.configure(true,896,504,.7);
 assert.throws(()=>surface.render(),/render interrupted/);assert.equal(material.size,3);assert.equal(composer.copyPass.renderToScreen,false);
 surface.reset();surface.configure(false,896,504);assert.equal(composer.renderToScreen,true);assert.equal(output.enabled,true);assert.equal(surface.diagnostics().nominalRGBABytes,0);
 surface.dispose();assert.equal(disposals,0);
});
