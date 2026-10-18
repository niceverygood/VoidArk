import * as THREE from 'three';
const pool=new Map();
function createTexture(faction,color){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;const c=canvas.getContext('2d');
 c.fillStyle='#07121be8';c.beginPath();c.roundRect(2,5,252,70,12);c.fill();c.strokeStyle='#'+color.toString(16).padStart(6,'0');c.lineWidth=4;c.stroke();c.fillStyle=c.strokeStyle;c.beginPath();
 if(faction==='boss'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?10:23,x=27+Math.cos(a)*r,y=40+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}}else if(faction==='ally'){c.moveTo(27,18);c.lineTo(48,40);c.lineTo(27,62);c.lineTo(6,40);}else{c.moveTo(27,62);c.lineTo(7,20);c.lineTo(47,20);}c.closePath();c.fill();
 c.font='bold 31px sans-serif';c.fillText(faction==='boss'?'보스':faction==='ally'?'아군':'적군',67,51);
 if(faction!=='boss'){const compact=document.createElement('canvas');compact.width=80;compact.height=80;const ctx=compact.getContext('2d');ctx.fillStyle='#031019';ctx.beginPath();ctx.arc(40,40,35,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#'+color.toString(16).padStart(6,'0');ctx.lineWidth=3;ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();if(faction==='ally'){ctx.moveTo(40,13);ctx.lineTo(66,40);ctx.lineTo(40,67);ctx.lineTo(14,40);}else{ctx.moveTo(40,64);ctx.lineTo(15,19);ctx.lineTo(65,19);}ctx.closePath();ctx.fill();canvas.width=80;canvas.height=80;canvas.getContext('2d').drawImage(compact,0,0);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function acquireFactionMarker(faction,color){
 const key=faction+':'+color;let entry=pool.get(key);if(!entry){entry={texture:createTexture(faction,color),references:0};pool.set(key,entry);}entry.references++;let released=false;
 return {texture:entry.texture,release(){if(released)return;released=true;if(--entry.references===0){entry.texture.dispose();pool.delete(key);}}};
}
