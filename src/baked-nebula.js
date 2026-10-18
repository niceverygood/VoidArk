import * as THREE from 'three';

const originalTail=`vec3 teal = sectorTeal;
vec3 violet = sectorViolet;
vec3 nebula = mix(teal, violet, temperature);
vec3 color = vec3(0.0015, 0.0025, 0.006);
color += nebula * mass * (0.12 + lanes * 0.75);
color += mix(vec3(0.09, 0.21, 0.22), vec3(0.24, 0.12, 0.32), temperature) * filaments * mass * 0.2;
color *= 0.68 + noise(d * 230.0) * 0.32;
gl_FragColor = vec4(color, 1.0);
#include <colorspace_fragment>`;
const compact=s=>s.replace(/\s+/g,'');

// Keep the authored FBM/noise/bands byte-for-byte; replace only its final color
// assembly with palette-independent scalar coefficients for the same direction.
export function nebulaCoefficientShader(fragmentShader){
  const start=fragmentShader.indexOf('vec3 teal = sectorTeal;'),end=fragmentShader.indexOf('#include <colorspace_fragment>',start);
  if(start<0||end<0)throw new Error('Unsupported authored nebula shader');
  const last=end+'#include <colorspace_fragment>'.length;
  if(compact(fragmentShader.slice(start,last))!==compact(originalTail))throw new Error('Authored nebula color assembly changed');
  return fragmentShader.slice(0,start)+`float grain = 0.68 + noise(d * 230.0) * 0.32;
        gl_FragColor = vec4(mass * (0.12 + lanes * 0.75) * grain,
                            temperature, filaments * mass * 0.2 * grain, grain);`+fragmentShader.slice(last);
}

const samplingFragment=`
precision highp float;
uniform samplerCube nebulaCoefficients;
uniform vec3 sectorTeal;
uniform vec3 sectorViolet;
varying vec3 vDirection;
void main(){
  vec4 field = textureCube(nebulaCoefficients, normalize(vDirection));
  vec3 color = vec3(0.0015, 0.0025, 0.006) * field.a;
  color += mix(sectorTeal, sectorViolet, field.g) * field.r;
  color += mix(vec3(0.09, 0.21, 0.22), vec3(0.24, 0.12, 0.32), field.g) * field.b;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export function findNebulaDome(scene){
  let found=null;
  scene.traverse(o=>{if(!found&&o.isMesh&&o.material?.isShaderMaterial&&o.material.uniforms?.sectorTeal&&o.material.uniforms?.sectorViolet&&o.material.fragmentShader.includes('fbm(d * 7.2'))found=o;});
  return found;
}

// Bake the authored direction field once; keep palette changes live. The native
// shader stays available during preparation, unsupported targets and recovery.
export function createBakedNebula(renderer,dome,{resolution=1024}={}){
  const source=dome?.material;
  let supported=!!dome?.isMesh&&!!source?.isShaderMaterial&&!!source.uniforms?.sectorTeal&&!!source.uniforms?.sectorViolet;
  let coefficientFragment='',failure=null;
  try{if(!supported)throw new Error('Nebula dome not found');coefficientFragment=nebulaCoefficientShader(source.fragmentShader);}catch(error){supported=false;failure=error.message;}
  const size=Math.max(16,Math.min(renderer.capabilities?.maxCubemapSize||4096,Math.floor(resolution)));
  const target=new THREE.WebGLCubeRenderTarget(size,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,generateMipmaps:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  target.texture.name='nebula-coefficients';target.texture.colorSpace=THREE.NoColorSpace;
  const bakeMaterial=supported?source.clone():new THREE.ShaderMaterial();
  bakeMaterial.fragmentShader=coefficientFragment; // No colorspace/tone mapping of scalar coefficients.
  const bakeScene=new THREE.Scene(),bakeMesh=supported?new THREE.Mesh(dome.geometry,bakeMaterial):null;
  if(bakeMesh){bakeMesh.frustumCulled=false;bakeScene.add(bakeMesh);}
  const cubeCamera=new THREE.CubeCamera(.1,100000,target);bakeScene.add(cubeCamera);
  const material=new THREE.ShaderMaterial({
    uniforms:{nebulaCoefficients:{value:target.texture},sectorTeal:source?.uniforms?.sectorTeal||{value:new THREE.Color()},sectorViolet:source?.uniforms?.sectorViolet||{value:new THREE.Color()}},
    vertexShader:source?.vertexShader||'',fragmentShader:samplingFragment,
    side:source?.side??THREE.BackSide,depthWrite:false,depthTest:false,fog:false,toneMapped:false,
  });
  let ready=false,wanted=false,disposed=false,released=false,lost=false,pending=null,preparing=0,revision=0;
  const stats={resolution:size,faces:6,nominalRGBA16FBytes:6*size*size*8,bakes:0,bakeCpuMs:0,compileCpuMs:0,ready:false,enabled:false,failure};
  function native(){if(dome?.material===material)dome.material=source;stats.enabled=false;}
  function apply(){stats.ready=ready&&!lost&&!disposed;if(wanted&&stats.ready){dome.material=material;stats.enabled=true;}else native();return stats.enabled;}
  function update(){if(disposed||lost||!ready){native();return false;}return apply();}
  function setEnabled(value){wanted=!!value;return apply();}
  function contextReset(){revision++;ready=false;stats.ready=false;stats.failure=null;native();target.dispose();}
  const onLost=()=>{lost=true;revision++;ready=false;stats.ready=false;native();};
  const onRestored=()=>{lost=false;contextReset();};
  const canvas=renderer.domElement;canvas?.addEventListener?.('webglcontextlost',onLost);canvas?.addEventListener?.('webglcontextrestored',onRestored);
  function release(){if(released)return;released=true;target.dispose();material.dispose();bakeMaterial.dispose();bakeScene.remove(bakeMesh,cubeCamera);}
  function saveRendererState(){return {target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),clearColor:renderer.getClearColor(new THREE.Color()),clearAlpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,xr:renderer.xr.enabled};}
  function restoreRendererState(state){renderer.setRenderTarget(state.target,state.face,state.mip);renderer.setViewport(state.viewport);renderer.setScissor(state.scissor);renderer.setScissorTest(state.scissorTest);renderer.setClearColor(state.clearColor,state.clearAlpha);renderer.autoClear=state.autoClear;renderer.xr.enabled=state.xr;}
  function prepare(){
    if(disposed||lost||!supported)return Promise.resolve(false);
    if(ready)return Promise.resolve(true);
    if(pending?.generation===revision)return pending.promise;
    if(!renderer.extensions?.has?.('EXT_color_buffer_float')){stats.failure='Half-float render target unsupported';native();return Promise.resolve(false);}
    const generation=revision;
    // Publish the task before any renderer call: synchronous setup failure must
    // not overwrite its own finally cleanup with an already-settled Promise.
    let resolveTask,rejectTask;
    const task={generation,promise:new Promise((resolve,reject)=>{resolveTask=resolve;rejectTask=reject;})};
    pending=task;preparing++;
    (async()=>{
      try{
        const started=performance.now(),compileState=saveRendererState();let compilation;
        // compileAsync initializes the program synchronously before yielding.
        // Prime the actual cube-target output variant, then restore immediately.
        try{renderer.initRenderTarget(target);renderer.setRenderTarget(target,0,0);compilation=renderer.compileAsync(bakeScene,cubeCamera.children[0]);}finally{restoreRendererState(compileState);}
        await compilation;
        if(disposed||lost||generation!==revision)return false;
        stats.compileCpuMs=performance.now()-started;
        const state=saveRendererState();
        const bakeStarted=performance.now();
        try{
          renderer.autoClear=true;renderer.xr.enabled=false;renderer.setScissorTest(false);renderer.setClearColor(0x000000,1);
          renderer.initRenderTarget(target);renderer.setRenderTarget(target,0,0);
          const gl=renderer.getContext();if(gl.isContextLost?.())throw new Error('WebGL context lost');
          if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete half-float cube framebuffer');
          cubeCamera.update(renderer,bakeScene);
        }finally{
          restoreRendererState(state);
        }
        stats.bakeCpuMs=performance.now()-bakeStarted;
        if(disposed||lost||generation!==revision)return false;
        ready=true;stats.bakes++;stats.failure=null;apply();return true;
      }catch(error){if(!disposed&&!lost&&generation===revision){ready=false;stats.ready=false;stats.failure=error.message;native();}return false;}
      finally{if(pending===task)pending=null;preparing--;if(disposed&&!preparing)release();}
    })().then(resolveTask,rejectTask);
    return task.promise;
  }
  return {target,material,sourceMaterial:source,prepare,update,setEnabled,contextReset,diagnostics:()=>({...stats,preparing:preparing>0,lost,disposed}),dispose(){if(disposed)return;disposed=true;wanted=false;ready=false;native();canvas?.removeEventListener?.('webglcontextlost',onLost);canvas?.removeEventListener?.('webglcontextrestored',onRestored);if(!preparing)release();}};
}
