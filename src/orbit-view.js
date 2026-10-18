const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const wheelPixels=(delta,mode=0)=>Number.isFinite(delta)?delta*(mode===1?16:mode===2?600:1):0;
export class OrbitView {
 constructor(){this.reset();}
 reset(heading=0){this.yaw=heading+.4;this.pitch=.75;this.distance=44;this.manual=false;this.drag=null;}
 begin(id,x,y,button=0){if(this.drag||![0,2].includes(button))return false;this.drag={id,x,y};return true;}
 move(id,x,y){if(this.drag?.id!==id)return false;this.yaw-=(x-this.drag.x)*.005;this.pitch=clamp(this.pitch+(y-this.drag.y)*.004,-1.35,1.35);this.manual=true;this.drag={id,x,y};return true;}
 end(id){if(id===undefined||this.drag?.id===id)this.drag=null;}
 zoom(delta){if(!Number.isFinite(delta)||delta===0)return;this.distance=clamp(this.distance*Math.exp(clamp(delta,-480,480)*.0015),18,150);this.manual=true;}
}
export function bindOrbitView(canvas,view,active){
 const stop=()=>{const id=view.drag?.id;view.end();canvas.classList.remove('orbit-dragging');if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);};
 canvas.addEventListener('pointerdown',e=>{if(!active()||!view.begin(e.pointerId,e.clientX,e.clientY,e.button))return;e.preventDefault();canvas.setPointerCapture(e.pointerId);canvas.classList.add('orbit-dragging');});
 canvas.addEventListener('pointermove',e=>{if(!active()){stop();return;}view.move(e.pointerId,e.clientX,e.clientY);});
 canvas.addEventListener('pointerup',e=>{if(view.drag?.id===e.pointerId)stop();});
 canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);window.addEventListener('blur',stop);
 window.addEventListener('wheel',e=>{if(!active()||e.ctrlKey||e.metaKey||e.target.closest?.('select,input,textarea'))return;const delta=wheelPixels(e.deltaY,e.deltaMode);if(!delta)return;e.preventDefault();view.zoom(delta);},{passive:false,capture:true});
 return stop;
}
