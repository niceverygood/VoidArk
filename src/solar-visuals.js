import {qaRendererOptions} from './qa-render-context.js';
import {mountAsset} from './asset-library.js';
import * as THREE from 'three';
import {SOLAR_STAGES} from './solar-campaign.js';
import {ANDROMEDA_STAGES,ANDROMEDA_SYSTEMS} from './andromeda-campaign.js';
import {startAndromedaRouteRendering} from './andromeda-route-rendering.js';
export function planet(stage,size) {
 const root=new THREE.Group(),geo=new THREE.SphereGeometry(size,48,32);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const c=canvas.getContext('2d');c.fillStyle='#'+stage.color.toString(16).padStart(6,'0');c.fillRect(0,0,512,256);
 for(let i=0;i<180;i++){const x=(i*137.5)%512,y=(i*71.7)%256;
  c.fillStyle=i%2?'#ffffff22':'#00000028';
  if(stage.biome==='gas'||['jupiter','saturn','uranus','neptune'].includes(stage.id)){c.fillRect(0,y,512,2+i%8);}else{c.beginPath();c.ellipse(x,y,2+i%13,2+i%8,0,0,7);c.fill();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.ShaderMaterial({uniforms:{surface:{value:texture}},vertexShader:'varying vec2 texUV;varying vec3 worldNormal;void main(){texUV=uv;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D surface;varying vec2 texUV;varying vec3 worldNormal;void main(){float light=.16+.7*max(0.0,dot(normalize(worldNormal),normalize(vec3(-.4,.7,.5))));gl_FragColor=vec4(texture2D(surface,texUV).rgb*light,1.0);\n#include <colorspace_fragment>\n}'});
 root.add(new THREE.Mesh(geo,mat));
 if(stage.id==='saturn'){const ring=new THREE.Mesh(new THREE.RingGeometry(size*1.35,size*2.05,96),new THREE.MeshStandardMaterial({color:0xcbb997,transparent:true,opacity:.6,side:THREE.DoubleSide}));ring.rotation.x=-1.18;root.add(ring);}
 const native=[...root.children],resources=new Set([texture]);for(const o of native){if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);}root.userData.dispose=()=>{for(const r of resources)r.dispose();};if(['mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'].includes(stage.id))mountAsset(root,'solar-'+stage.id,{size:size*2,hide:native});return root;
}
export function createSolarBattlefield(scene) {
 const root=new THREE.Group();scene.add(root);let current=-1,body=null;
 const geo=new THREE.EdgesGeometry(new THREE.BoxGeometry(1200,480,1200)),mat=new THREE.LineBasicMaterial({color:0x69dfd1,transparent:true,opacity:.15});
 const boundary=new THREE.LineSegments(geo,mat);root.add(boundary);
 return {update(snapshot,time,visible){root.visible=!!snapshot&&visible;if(!root.visible)return;
  if(current!==snapshot.index){if(body){root.remove(body);body.userData.dispose();}body=planet(snapshot,100+snapshot.index*4);body.position.set(0,-115,-265);root.add(body);current=snapshot.index;boundary.scale.set(snapshot.extent.x/600,snapshot.extent.y/240,snapshot.extent.z/600);}
  body.rotation.y=time*.025;mat.opacity=snapshot.edge<75?.5:.07;mat.color.set(snapshot.boundary?.outside?0xff6655:0x66dddd);
 },dispose(){body?.userData.dispose();geo.dispose();mat.dispose();scene.remove(root);}};
}
export function renderSolarRoute(canvas,cleared) {
 const renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,antialias:true,alpha:true})),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,1000);
 scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.PointLight(0xffd8a0,1000);scene.add(light);
 const sun=new THREE.Mesh(new THREE.SphereGeometry(4,32,24),new THREE.MeshBasicMaterial({color:0xffd071}));scene.add(sun);
 function label(body,text){const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#d4ebe9';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText(text,128,42);const texture=new THREE.CanvasTexture(c),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(14,3.5,1);sprite.position.y=4.5;body.add(sprite);const dispose=body.userData.dispose;body.userData.dispose=()=>{dispose();texture.dispose();};}
 const worlds=[];for(const s of SOLAR_STAGES){const angle=s.index*.78,range=15+s.index*6,body=planet(s,1.6+s.index*.12);body.position.set(Math.cos(angle)*range,(s.index%3-1)*3,Math.sin(angle)*range);scene.add(body);label(body,s.name);worlds.push(body);
  const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:100},(_,i)=>new THREE.Vector3(Math.cos(i/100*Math.PI*2)*range,0,Math.sin(i/100*Math.PI*2)*range))),new THREE.LineBasicMaterial({color:s.index<cleared?0x70d6bb:0x354d65}));scene.add(ring);
 }
 const earth=planet({id:'earth',color:0x428fae},2);earth.position.set(-18,0,7);scene.add(earth);label(earth,'지구 · 본거지');worlds.push(earth);
 camera.position.set(0,85,95);camera.lookAt(0,0,0);let frame;
 function draw(){const w=canvas.clientWidth||600,h=canvas.clientHeight||260;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();for(const body of worlds)body.rotation.y+=.003;renderer.render(scene,camera);frame=requestAnimationFrame(draw);}draw();
 return ()=>{cancelAnimationFrame(frame);for(const b of worlds)b.userData.dispose();scene.traverse(o=>{if(!worlds.some(b=>b===o||b.children.includes(o))){o.geometry?.dispose();o.material?.dispose();}});renderer.dispose();renderer.forceContextLoss();};
}
export function renderAndromedaRoute(canvas,cleared) {
 const renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,antialias:true,alpha:true})),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,500);
 scene.add(new THREE.HemisphereLight(0xc4dfff,0x29203a,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(0,70,50);scene.add(light);
 const worlds=[],textures=[];
 function label(parent,text,color='#e8e3ff',y=5,size=13){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 38px sans-serif';ctx.fillText(text,256,60);const tex=new THREE.CanvasTexture(c);textures.push(tex);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false}));sprite.scale.set(size,size/5.3,1);sprite.position.y=y;parent.add(sprite);}
 ANDROMEDA_SYSTEMS.forEach((system,i)=>{
  const root=new THREE.Group();root.position.set((i-1)*45,0,i===1?-25:15);scene.add(root);
  const star=new THREE.Mesh(new THREE.SphereGeometry(2.7,24,20),new THREE.MeshBasicMaterial({color:system.color}));root.add(star);label(star,system.name,'#'+system.color.toString(16),17,32);
  for(let j=0;j<3;j++){const stage=ANDROMEDA_STAGES[i*3+j],angle=j*2.1+.5,range=9+j*5,body=planet(stage,1.7+j*.3);body.position.set(Math.cos(angle)*range,(j-1)*2,Math.sin(angle)*range);root.add(body);label(body,stage.name,stage.localIndex<cleared?'#8effce':'#e8e3ff',4.5,18);worlds.push(body);
   const orbit=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:96},(_,k)=>new THREE.Vector3(Math.cos(k/96*6.283)*range,(j-1)*2,Math.sin(k/96*6.283)*range))),new THREE.LineBasicMaterial({color:stage.localIndex<cleared?0x75d6bb:system.color,transparent:true,opacity:.35}));root.add(orbit);
  }
 });
 const points=[];for(let i=0;i<700;i++){const a=i*.061,rad=4+(i%130)*.65;points.push(Math.cos(a+rad*.035)*rad,Math.sin(i*7.3)*3-8,Math.sin(a+rad*.035)*rad);}
 scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),new THREE.PointsMaterial({color:0xa3a9fa,size:.4,transparent:true,opacity:.4})));
 camera.position.set(0,70,85);camera.lookAt(0,0,0);
 function resize(){const w=canvas.clientWidth||800,h=canvas.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 function draw(){resize();worlds.forEach(b=>b.rotation.y+=.003);renderer.render(scene,camera);}
 return startAndromedaRouteRendering({renderer,scene,camera,prepare:resize,draw,release(){worlds.forEach(b=>b.userData.dispose());const geo=new Set(),mat=new Set();scene.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)mat.add(o.material);});geo.forEach(g=>g.dispose());mat.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();}});
}

