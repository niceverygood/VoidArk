// Strict QA-only context options. Ordinary game and preview constructors keep their defaults.
export function qaRenderContext(canvas,search='',options={}){
 const params=new URLSearchParams(search);if(params.get('qa')!=='1'||params.get('qaLowLatency')!=='1')return null;
 return canvas.getContext('webgl2',{antialias:params.get('qaNoAA')==='1'?false:(options.antialias??true),alpha:options.alpha??false,depth:options.depth??true,stencil:options.stencil??false,premultipliedAlpha:options.premultipliedAlpha??true,preserveDrawingBuffer:params.get('qaPreserve')==='1'?true:(options.preserveDrawingBuffer??false),powerPreference:options.powerPreference??'high-performance',desynchronized:true});
}
export function qaRendererOptions(options={},search=typeof location==='undefined'?'':location.search){
 const params=new URLSearchParams(search);if(params.get('qa')!=='1')return options;
 const aa=params.get('qaCanvasAA');if(aa==='on'||aa==='off')options={...options,antialias:aa==='on'};
 if(params.get('qaLowLatency')!=='1')return options;
 const canvas=options.canvas||document.createElement('canvas');return {...options,canvas,context:qaRenderContext(canvas,search,{...options,antialias:options.antialias??false})};
}
