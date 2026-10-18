// Three 0.180 compileAsync polls material.currentProgram every 10 ms but cannot
// cancel those polls. This route owns its renderer, so stop polling before
// releasing materials or losing the context when the picker closes.
export function startAndromedaRouteRendering({renderer,scene,camera,prepare,draw,release}, {
 requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,
 schedule=setTimeout,cancel=clearTimeout,
}={}) {
 const canvas=renderer.domElement;
 let closed=false,lost=false,frame=null,timer=null,materials=null,lastState='';
 const state=value=>{if(value===lastState)return;lastState=value;canvas.dataset.routeState=value;canvas.setAttribute('aria-busy',String(value==='compiling'||value==='pending'));};
 function stopJobs(){if(frame!==null)cancelFrame(frame);if(timer!==null)cancel(timer);frame=timer=null;materials=null;}
 function close(){if(closed)return;closed=true;stopJobs();canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);release();}
 function fail(){state('failed');close();}
 function renderFrame(){frame=null;if(closed||lost)return;try{draw();state('ready');frame=requestFrame(renderFrame);}catch{fail();}}
 function checkReady(){timer=null;if(closed||lost)return;try{
  for(const material of materials){const program=renderer.properties.get(material).currentProgram;if(!program)throw Error('Missing route program');if(program.isReady())materials.delete(material);}
  if(materials.size){timer=schedule(checkReady,10);return;}
  materials=null;frame=requestFrame(renderFrame);
 }catch{fail();}}
 function begin(){frame=null;if(closed||lost)return;try{
  prepare();
  if(renderer.extensions.get('KHR_parallel_shader_compile')){state('compiling');materials=renderer.compile(scene,camera);checkReady();}
  else frame=requestFrame(renderFrame);
 }catch{fail();}}
 function onLost(event){event.preventDefault();if(closed)return;lost=true;stopJobs();state('context-lost');}
 function onRestored(){if(closed)return;lost=false;state('pending');frame=requestFrame(begin);}
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
 state('pending');frame=requestFrame(begin);
 return close;
}
