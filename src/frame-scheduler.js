// rAF is preferred. Some visible WebGL windows receive one rAF per second
// while ordinary timers remain responsive. Recover the game clock without
// stacking render loops or doing background combat updates.
export function createFrameScheduler(render,{
 now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),
 setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),visible=()=>!document.hidden,
 period=1000/60,stallMs=150,recoveryFrames=3,scheduleBeforeWork=true,pollMs=4,
}={}){
 let running=false,raf=null,timer=null,mode='raf',lastPulse=0,lastRender=-Infinity,lastRaf=null,good=0,slow=0;
 const stats={rafCallbacks:0,timerFrames:0,callbackFrames:0,recoveries:0,fallbacks:0,lastGapMs:0};
 function draw(source){const t=now();const minimum=source==='timer'&&pollMs<period?period*.9:period*.45;if(!visible()||t-lastRender<minimum)return;stats.lastGapMs=Number.isFinite(lastRender)?t-lastRender:0;lastRender=t;stats.callbackFrames++;if(source==='timer')stats.timerFrames++;render(t);}
 function scheduleTimer(ms){if(timer!==null)clearTimer(timer);timer=setTimer(watch,ms);}
 function watch(){timer=null;if(!running)return;
  if(!visible()){lastPulse=now();good=0;scheduleTimer(stallMs);return;}
  if(mode==='raf'&&now()-lastPulse>=stallMs){mode='timer';stats.fallbacks++;}
  if(mode==='timer'){
   // Queue before CPU work. Short polling avoids turning a nominal 16.7ms
   // timeout into two coarse timer ticks. draw() caps rendering; a poll is
   // not an extra GPU submission, and hidden pages use the slow watchdog.
   if(scheduleBeforeWork)scheduleTimer(pollMs);
   try{draw('timer');}finally{if(running&&!scheduleBeforeWork)scheduleTimer(Math.max(0,period-(now()-lastRender)));}
  }
  else scheduleTimer(Math.max(1,stallMs-(now()-lastPulse)));
 }
 function pulse(){raf=null;if(!running)return;const t=now(),gap=lastRaf===null?Infinity:t-lastRaf;lastRaf=t;lastPulse=t;stats.rafCallbacks++;
  // A steady 50–100ms callback stream never trips the 150ms watchdog.
  // Require several slow callbacks so a single hitch keeps normal rAF pacing.
  if(mode==='raf'){slow=visible()&&Number.isFinite(gap)&&gap>Math.min(stallMs*.5,period*2.5)?slow+1:0;if(slow>=recoveryFrames){mode='timer';slow=good=0;stats.fallbacks++;scheduleTimer(pollMs);}}
  // A callback arriving every 50–70ms is still throttled. Switching back at
  // that rate discards the faster fallback and produces repeated slow bursts.
  if(mode==='timer'){good=gap<=Math.min(stallMs*.5,period*1.5)?good+1:0;if(good>=recoveryFrames){mode='raf';good=0;stats.recoveries++;scheduleTimer(stallMs);}}
  raf=requestFrame(pulse);if(mode==='raf')draw('raf');
 }
 return {start(){if(running)return;running=true;lastPulse=now();lastRaf=null;lastRender=-Infinity;mode='raf';good=slow=0;raf=requestFrame(pulse);scheduleTimer(stallMs);},
 stop(){running=false;if(raf!==null)cancelFrame(raf);if(timer!==null)clearTimer(timer);raf=timer=null;},
 setPacing(before){scheduleBeforeWork=!!before;},
 setPollMs(ms){pollMs=Math.max(4,Math.min(period,Number(ms)||period));},
 diagnostics(){return {...stats,mode,running,scheduleBeforeWork,pollMs,visible:visible(),sinceRafMs:now()-lastPulse};}};
}

