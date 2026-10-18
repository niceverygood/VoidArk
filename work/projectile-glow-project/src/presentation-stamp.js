import * as THREE from 'three';
// Opt-in QA: a counter rendered into the actual WebGL backbuffer, rather than
// a DOM counter that could update while the game image stays stale.
export function createPresentationStamp(renderer,search=location.search){
 const p=new URLSearchParams(search);if(p.get('qa')!=='1'||p.get('qaPresentProbe')!=='1')return null;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);
 const material=new THREE.MeshBasicMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,.25),material);quad.position.set(0,-.84,-1);scene.add(quad);
 let frames=0,last=0;
 return {draw(now){frames++;last=now;ctx.fillStyle=frames%2?'#162338':'#382316';ctx.fillRect(0,0,512,64);ctx.fillStyle='white';ctx.font='bold 28px monospace';ctx.fillText(`GL ${frames} / ${Math.round(now)}ms`,12,42);texture.needsUpdate=true;const clear=renderer.autoClear;renderer.autoClear=false;try{renderer.render(scene,camera);}finally{renderer.autoClear=clear;}},diagnostics(){return {frames,last};}};
}
