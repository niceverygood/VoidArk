// Owned renderer/model disposal remains synchronous after shader polling ends.
// Explicit native context loss can block, so issue it in a separate task after
// the completed battle frame. The queued closure owns only this retired renderer.
export function deferEndingContextLoss(renderer,{queue=setTimeout}={}){
 const state={pending:!!renderer,requested:false,error:null};
 if(!renderer)return state;
 const request=()=>{if(!state.pending)return;state.pending=false;try{renderer.forceContextLoss();state.requested=true;}catch(error){state.error=String(error?.message||error);}};
 try{queue(request,0);}catch{request();}
 return state;
}

// Keep shader preparation out of the combat settlement callback. Closing while
// preparation is pending defers GPU disposal until the renderer finishes using it.
export function createEndingPlayback({prepare,render,release,onComplete,
 now=()=>performance.now(),createClock,queue=setTimeout,cancelQueue=clearTimeout,durationMs=9000}){
 let closed=false,preparing=false,released=false,clock=null,timer=null,start=0;
 function releaseOnce(){if(!preparing&&!released){released=true;release();}}
 function finish(){
  if(closed)return;
  closed=true;
  if(timer!==null){cancelQueue(timer);timer=null;}
  clock?.stop();releaseOnce();onComplete();
 }
 function frame(){
  if(closed)return;
  const elapsed=now()-start;
  render(elapsed/1000);
  if(elapsed>=durationMs)finish();
 }
 timer=queue(()=>{
  timer=null;preparing=true;
  Promise.resolve().then(()=>{if(!closed)return prepare();}).then(()=>{
   if(closed)return;
   start=now();clock=createClock(frame);clock.start();
  }).catch(()=>finish()).finally(()=>{preparing=false;if(closed)releaseOnce();});
 },0);
 return finish;
}

// The battle owns this preparation until it hands it to the ending. Cancellation
// must not dispose resources while an asynchronous shader poll still uses them.
export function createEndingPreparation(setup,release,{queue=setTimeout,cancelQueue=clearTimeout}={}){
 let closed=false,pending=false,released=false,timer,settle;
 const ready=new Promise(resolve=>settle=resolve);
 const releaseOnce=()=>{if(!pending&&!released){released=true;release();}};
 timer=queue(()=>{timer=null;pending=true;
  Promise.resolve().then(()=>closed?false:setup(()=>closed)).then(value=>settle(!closed&&value!==false),()=>{closed=true;settle(false);}).finally(()=>{pending=false;if(closed)releaseOnce();});
 },0);
 return {ready,dispose(){if(closed)return;closed=true;if(timer!==null){cancelQueue(timer);timer=null;settle(false);}releaseOnce();},diagnostics(){return {closed,pending,released};}};
}
