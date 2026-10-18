import test from 'node:test';
import assert from 'node:assert/strict';
import {qaRendererOptions} from '../src/qa-render-context.js';
test('canvas multisampling can be isolated in QA without enabling other context experiments',()=>{
 const canvas={},options={canvas,antialias:false,alpha:false,powerPreference:'high-performance'};
 assert.equal(qaRendererOptions(options,'?qaCanvasAA=on'),options);
 assert.equal(qaRendererOptions(options,'?qa=1'),options);
 const on=qaRendererOptions(options,'?qa=1&qaCanvasAA=on');assert.equal(on.canvas,canvas);assert.equal(on.antialias,true);assert.equal(on.alpha,false);assert.equal(on.context,undefined);assert.equal(options.antialias,false);
 assert.equal(qaRendererOptions({...options,antialias:true},'?qa=1&qaCanvasAA=off').antialias,false);
});
