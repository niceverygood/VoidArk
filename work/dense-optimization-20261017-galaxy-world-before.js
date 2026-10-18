import {qaRendererOptions} from './qa-render-context.js';
import {civilizationForOwner} from './civilizations.js';
import {mountAsset} from './asset-library.js';
import {planetMaterial,atmosphereMaterial} from './planet-surfaces.js';
import {GALAXIES,galaxyDefinition} from './galaxies.js';
import {FACTIONS} from './universe.js';
import * as THREE from 'three';
import {PLANETS,occupied} from './galaxy.js';

function mapLabel(text,color='#d8faff'){
 const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='rgba(3,16,25,.88)';ctx.fillRect(0,0,512,80);ctx.font='bold 29px sans-serif';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,52);const texture=new THREE.CanvasTexture(c),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.scale.set(40,6.25,1);sprite.renderOrder=5;return sprite;
}

export function renderGalaxyNetwork(canvas,current,discoveries){
  const renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,alpha:true,antialias:true}));renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(900,230,false);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,900/230,1,1000);camera.position.set(130,210,240);camera.lookAt(105,0,60);
  const locations=new Map(GALAXIES.map(g=>[g.id,new THREE.Vector3(g.offset.x/1000,0,g.offset.z/1000)])),clouds=[];
  for(const g of GALAXIES){
    const points=[];for(let i=0;i<240;i++){const r=Math.sqrt(i/240)*28,a=i*2.39996+r*.1;points.push(Math.cos(a)*r,Math.sin(i)*2,Math.sin(a)*r);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const cloud=new THREE.Points(geometry,new THREE.PointsMaterial({color:g.color,size:g.id===current?2.7:1.8,transparent:true,opacity:discoveries.includes(g.id)?1:.35,depthWrite:false}));cloud.position.copy(locations.get(g.id));scene.add(cloud);clouds.push(cloud);const label=mapLabel(g.name+(g.id===current?" · 현재":""));label.position.copy(cloud.position).add(new THREE.Vector3(0,18,0));label.scale.set(48,7.5,1);scene.add(label);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(33,.5,6,48),new THREE.MeshBasicMaterial({color:g.id===current?0xffffff:g.color,transparent:true,opacity:g.id===current?1:.3}));ring.rotation.x=Math.PI/2;ring.position.copy(cloud.position);scene.add(ring);
    for(const id of g.links)if(g.id<id){const line=new THREE.BufferGeometry().setFromPoints([locations.get(g.id),locations.get(id)]);scene.add(new THREE.Line(line,new THREE.LineBasicMaterial({color:g.id===current||id===current?0xa4eaff:0x42617a})));}
  }
  let frame=0,disposed=false;const draw=()=>{if(disposed)return;for(const c of clouds)c.rotation.y=performance.now()*.00006;renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
  return ()=>{disposed=true;cancelAnimationFrame(frame);const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});for(const r of resources)r.dispose();renderer.dispose();renderer.forceContextLoss();};
}

export function createGalaxySky(scene){
  const root=new THREE.Group(),geometry=new THREE.BufferGeometry(),positions=[],colors=[];const color=new THREE.Color();
  for(let i=0;i<1100;i++){const a=i*2.39996,r=260+(i%97)*7,t=(i%4)*Math.PI/2+a*.05;positions.push(Math.cos(a+t)*r,100+Math.sin(i*.31)*200,Math.sin(a+t)*r);color.setHSL(.55+(i%5)*.03,.65,.4+(i%7)*.07);colors.push(color.r,color.g,color.b);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const material=new THREE.PointsMaterial({size:3.5,vertexColors:true,transparent:true,opacity:.75,depthWrite:false,fog:false,blending:THREE.AdditiveBlending});root.add(new THREE.Points(geometry,material));scene.add(root);
  return {update(position,id,time,visible){root.visible=visible;root.position.set(position.x,position.y,position.z);material.color.set(galaxyDefinition(id).color);root.rotation.y=time*.006+galaxyDefinition(id).tier*.6;}};
}
export function createGalaxyWorld(scene){
  const root=new THREE.Group();scene.add(root);const sphere=new THREE.SphereGeometry(1,32,20),ring=new THREE.TorusGeometry(1,.025,6,48),markers=[];
  for(const p of PLANETS){
    const body=new THREE.Group(),surface=new THREE.Mesh(sphere,planetMaterial(p.index));body.add(surface);body.position.set(p.position.x,p.position.y-p.radius-42,p.position.z);body.scale.setScalar(p.radius);root.add(body);const worldType=['ocean','desert','ice','volcanic','ocean',null][p.index%6];if(worldType)mountAsset(body,`planet-${worldType}`,{size:2,hide:[surface]});
    const atmosphere=new THREE.Mesh(sphere,atmosphereMaterial(p.color));atmosphere.position.copy(body.position);atmosphere.scale.setScalar(p.radius*1.035);root.add(atmosphere);
    const orbit=new THREE.Mesh(ring,new THREE.MeshBasicMaterial({color:0xe77d75,transparent:true,opacity:.4}));orbit.position.set(p.position.x,p.position.y,p.position.z);orbit.scale.setScalar(p.radius+45);orbit.rotation.x=Math.PI/2;root.add(orbit);markers.push({p,body,atmosphere,orbit});
  }
  const gates=GALAXIES.map(g=>{const gate=new THREE.Group();gate.position.set(g.offset.x+480,35,g.offset.z+110);const material=new THREE.MeshBasicMaterial({color:g.color,toneMapped:false});for(let i=0;i<2;i++){const rim=new THREE.Mesh(new THREE.TorusGeometry(24+i*3,.65,8,64),material);rim.rotation.y=i*.4;gate.add(rim);}mountAsset(gate,'star-gate',{size:58});scene.add(gate);return {gate,g};});
  return {update(time,state,visible,galaxyId='milky'){root.visible=visible;for(const {gate,g} of gates){gate.visible=visible&&g.id===galaxyId;gate.rotation.z=time*.08;}for(const {p,body,atmosphere,orbit} of markers){body.visible=atmosphere.visible=orbit.visible=p.galaxy===galaxyId;body.rotation.y=time*.015;orbit.material.color.set(occupied(state,p)?0x7affb7:0xff7777);}},root};
}
export function createPlanetFortress(nation='y'){
  const root=new THREE.Group(),hull=new THREE.MeshStandardMaterial({color:0x773e46,metalness:.6,roughness:.4}),glow=new THREE.MeshBasicMaterial({color:0xff7352});
  const add=(g,m,x,y,z)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
  add(new THREE.CylinderGeometry(7,9,3,6),hull,0,-1,0);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,x=Math.cos(a)*5,z=Math.sin(a)*5;add(new THREE.BoxGeometry(3,6,3),hull,x,2,z);add(new THREE.SphereGeometry(.5,8,6),glow,x,5.5,z);}
  add(new THREE.OctahedronGeometry(2.7),glow,0,3,0);
  root.userData.dispose=()=>{const set=new Set([hull,glow]);root.traverse(o=>{if(o.isMesh&&!o.userData.meshy)set.add(o.geometry);});for(const item of set)item.dispose();};mountAsset(root,`nation-${nation}-fortress`,{size:17,hide:root.children.filter(o=>o.isMesh&&o.material===hull)});return root;
}
export function renderGalaxyMap(canvas,state,position,regionId,war,actor='player',live=false,galaxyId='milky',targetId=null,onSelect=null,focus=true){
  const renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,alpha:true,antialias:true}));renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(680,420,false);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,680/420,1,2000);camera.position.set(140,230,230);camera.lookAt(0,0,0);
  const grid=new THREE.GridHelper(320,16,0x335f75,0x193343);scene.add(grid);
  const all=PLANETS.filter(p=>p.galaxy===galaxyId),target=all.find(p=>p.id===targetId)||all[0],local=focus?all.filter(p=>Math.hypot(p.position.x-target.position.x,p.position.z-target.position.z)<3200):all;
  const offset=focus?{x:target.position.x,z:target.position.z}:{x:all[0].position.x-480,z:all[0].position.z};const extent=Math.max(focus?900:1000,...local.map(p=>Math.hypot(p.position.x-offset.x,p.position.z-offset.z)))*1.15,mapScale=extent/140;
  const geometry=new THREE.SphereGeometry(1,12,8),selectable=[];
  for(const p of local){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:war?.owners[p.id]===actor?0x7affb7:war?.owners[p.id]?.startsWith('pilot-')?0xff6b8c:war?civilizationForOwner(war.owners[p.id])?.color||FACTIONS[Number(war.owners[p.id]?.split('-')[1])]?.color||p.color:occupied(state,p)?0x7affb7:p.color,transparent:true,opacity:p.region===regionId?1:.22}));mesh.position.set((p.position.x-offset.x)/mapScale,p.position.y/25,(p.position.z-offset.z)/mapScale);mesh.scale.setScalar(p.region===regionId?2.7:1.5);scene.add(mesh);mesh.userData.planetId=p.id;selectable.push(mesh);
   if(p.region===regionId||p.id===targetId){const label=mapLabel((p.id===targetId?'◆ ':'')+p.name+' · LV.'+p.level,p.id===targetId?'#ffe69a':'#d8faff');label.position.copy(mesh.position).add(new THREE.Vector3(0,11+(p.index%3)*8,0));label.scale.set(focus?65:42,focus?10:6.6,1);scene.add(label);}
   if(p.id===targetId){const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.6,6,32),new THREE.MeshBasicMaterial({color:0xffd46e}));ring.position.copy(mesh.position);ring.rotation.x=Math.PI/2;scene.add(ring);const route=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3((position.x-offset.x)/mapScale,position.y/25,(position.z-offset.z)/mapScale),mesh.position]);scene.add(new THREE.Line(route,new THREE.LineBasicMaterial({color:0xffd46e,depthTest:false})));}
  }
  const click=event=>{if(!onSelect)return;const r=canvas.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(selectable)[0];if(hit)onSelect(hit.object.userData.planetId);};canvas.addEventListener('click',click);
  const fleetMarkers=[],opened=performance.now();
  for(const w of war?.wars||[]){const source=PLANETS.find(p=>p.id===w.source),target=PLANETS.find(p=>p.id===w.target);if(!source||!target||target.galaxy!==galaxyId)continue;const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3((source.position.x-offset.x)/mapScale,source.position.y/25+2,(source.position.z-offset.z)/mapScale),new THREE.Vector3((target.position.x-offset.x)/mapScale,target.position.y/25+2,(target.position.z-offset.z)/mapScale)]);scene.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xff755f})));const marker=new THREE.Mesh(new THREE.OctahedronGeometry(2.8),new THREE.MeshBasicMaterial({color:0xff755f}));const t=1-w.remaining/120;marker.position.set((source.position.x-offset.x+(target.position.x-source.position.x)*t)/mapScale,(source.position.y+(target.position.y-source.position.y)*t)/25+2,(source.position.z-offset.z+(target.position.z-source.position.z)*t)/mapScale);scene.add(marker);fleetMarkers.push({marker,source,target,remaining:w.remaining});}
  const pilot=new THREE.Mesh(new THREE.OctahedronGeometry(3),new THREE.MeshBasicMaterial({color:0xffffff}));pilot.position.set((position.x-offset.x)/mapScale,position.y/25,(position.z-offset.z)/mapScale);scene.add(pilot);const label=mapLabel('내 위치','#ffffff');label.position.copy(pilot.position).add(new THREE.Vector3(0,5,0));label.scale.set(focus?40:25,focus?6.25:4,1);scene.add(label);
  let animation=0,disposed=false;const animate=()=>{if(disposed)return;for(const f of fleetMarkers){const t=Math.min(1,Math.max(0,1-(f.remaining-(live?(performance.now()-opened)/1000:0))/120));f.marker.position.set((f.source.position.x-offset.x+(f.target.position.x-f.source.position.x)*t)/mapScale,(f.source.position.y+(f.target.position.y-f.source.position.y)*t)/25+2,(f.source.position.z-offset.z+(f.target.position.z-f.source.position.z)*t)/mapScale);f.marker.rotation.y=performance.now()*.001;}renderer.render(scene,camera);animation=requestAnimationFrame(animate);};animate();
  return ()=>{disposed=true;canvas.removeEventListener('click',click);cancelAnimationFrame(animation);const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});for(const r of resources)r.dispose();renderer.dispose();renderer.forceContextLoss();};
}

