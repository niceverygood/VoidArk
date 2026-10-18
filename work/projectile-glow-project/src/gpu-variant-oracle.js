// QA-only paired, paused-scene GPU measurements. No synchronous readback and
// no time advancement. Never used by the normal game frame loop.
export async function compareGPUVariants({renderer,variants,draw,refresh,restore,repeats=8}){
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 if(!ext)return {supported:false,rows:[]};
 const rows=variants.map(v=>({label:v.label,gpuMs:[],cpuMs:[],calls:[],triangles:[],disjoint:0}));
 let query=null;
 const wait=()=>new Promise(resolve=>setTimeout(resolve,8));
 async function render(variant,row,record){
  variant.set();refresh();renderer.info.reset();query=gl.createQuery();
  const start=performance.now();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
  try{draw();}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);}
  const cpu=performance.now()-start,calls=renderer.info.render.calls,triangles=renderer.info.render.triangles,deadline=performance.now()+5000;
  while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){
   if(performance.now()>deadline)throw Error('GPU timing did not finish');await wait();
  }
  const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT),gpu=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
  gl.deleteQuery(query);query=null;
  if(record){if(disjoint)row.disjoint++;else{row.gpuMs.push(gpu);row.cpuMs.push(cpu);row.calls.push(calls);row.triangles.push(triangles);}}
 }
 try{
  for(let i=0;i<2;i++)for(let n=0;n<variants.length;n++)await render(variants[n],rows[n],false);
  for(let i=0;i<repeats;i++)for(const n of i%2?[...variants.keys()].reverse():[...variants.keys()])await render(variants[n],rows[n],true);
  return {supported:true,repeats,rows};
 }finally{if(query)gl.deleteQuery(query);restore();refresh();}
}
