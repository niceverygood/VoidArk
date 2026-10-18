import {qaRendererOptions} from './qa-render-context.js';
import {mountAsset} from './asset-library.js';
import {BASE_FACILITIES,cleanBase} from './base-tech.js';
import * as THREE from 'three';
import {cleanSpaceBase,SOLAR_CAPITALS} from './space-bases.js';
// Dedicated owned geometry; never dispose the shared gameplay hull assets.
export function installSolarModules(root,input,shipId) {
 const b=cleanSpaceBase(input),capital=SOLAR_CAPITALS.find(d=>d.id===b.capital&&d.ship===shipId);
 if(!b.sunBuilt||!capital)return;
 const group=new THREE.Group(),geometries=[],materials=[];
 const hull=new THREE.MeshStandardMaterial({color:0xe5d4a5,metalness:.8,roughness:.28}),dark=new THREE.MeshStandardMaterial({color:0x172735,metalness:.85,roughness:.4}),glow=new THREE.MeshBasicMaterial({color:capital.id==='aurora'?0x9acfff:0xffbc58});materials.push(hull,dark,glow);
 const add=(geo,mat,x,y,z)=>{geometries.push(geo);const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);group.add(o);return o;};
 const f=b.facilities;
 for(const side of [-1,1]){
  add(new THREE.BoxGeometry(1.2,.8,8),hull,side*4.2,0,1);
  add(new THREE.BoxGeometry(.8,.2,7),dark,side*4.2,.5,1);
  for(let i=0;i<1+f.forge;i++){add(new THREE.BoxGeometry(.65,.55,1.1),hull,side*3.4,.8,-3+i*1.8);const barrel=add(new THREE.CylinderGeometry(.09,.14,1.8,8),dark,side*3.4,1,-3.9+i*1.8);barrel.rotation.x=Math.PI/2;}
  for(let i=0;i<1+f.logistics;i++){const nozzle=add(new THREE.CylinderGeometry(.2,.38,.65,12),dark,side*(2+i*.65),-.2,5);nozzle.rotation.x=Math.PI/2;const flame=add(new THREE.ConeGeometry(.24,1.8,12),glow,side*(2+i*.65),-.2,6);flame.rotation.x=Math.PI/2;}
 }
 for(let i=0;i<f.shield;i++){const ring=add(new THREE.TorusGeometry(2.2+i*.45,.06,6,60),glow,0,.8,-1);ring.rotation.x=.5+i*.6;}
 add(new THREE.IcosahedronGeometry(.55+f.reactor*.18,1),glow,0,1.2,1.5);
 if(capital.id==='helios')for(const side of [-1,1])add(new THREE.BoxGeometry(2,.18,10),hull,side*4.8,-.4,.6);
 if(capital.id==='prometheus')for(const side of [-1,1]){const gun=add(new THREE.CylinderGeometry(.25,.35,5,12),hull,side*1.6,1.2,-3);gun.rotation.x=Math.PI/2;}
 if(capital.id==='aurora')for(const side of [-1,1]){const ring=add(new THREE.TorusGeometry(2.1,.12,8,64),glow,side*3.5,.6,0);ring.rotation.x=Math.PI/2;}
 const frame=root.userData.visualRoot||root;frame.add(group);frame.scale.multiplyScalar(1.35+b.facilities.shipyard*.12);root.userData.growth.camera*=1.6;
 const dispose=root.userData.dispose;root.userData.dispose=()=>{dispose?.();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};root.userData.solarModules=group;
}
export function renderSpaceBase(canvas,meta,location) {
 let disposed=false,release=null,launch=0;const started=performance.now(),status=document.createElement('small');status.className='preview-status';status.setAttribute('role','status');status.textContent='3D 기지 준비 중 · 시설 선택과 출격은 바로 가능합니다';canvas.after(status);canvas.dataset.previewStatus='loading';
 launch=requestAnimationFrame(()=>{launch=requestAnimationFrame(()=>initialize());});
 function initialize(){if(disposed||!canvas.isConnected)return;
 const b=cleanSpaceBase(meta.spaceBase),sun=location==='sun';
 const renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,antialias:true}));renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x030c18);renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,1000),root=new THREE.Group();scene.add(root);
 scene.add(new THREE.HemisphereLight(0xd1e8ff,0x15202c,2));const light=new THREE.DirectionalLight(sun?0xffd394:0xffffff,3);light.position.set(10,20,15);scene.add(light);
 const metal=new THREE.MeshStandardMaterial({color:sun?0xd7c2a1:0xb1c5ce,metalness:.75,roughness:.32}),dark=new THREE.MeshStandardMaterial({color:0x182b3d,metalness:.7,roughness:.5}),glow=new THREE.MeshBasicMaterial({color:sun?0xffb74f:0x56dfd5});
 const add=(geo,mat,pos,scale)=>{const o=new THREE.Mesh(geo,mat);o.position.set(...pos);if(scale)o.scale.set(...scale);root.add(o);return o;};
 const rank=sun?Object.values(b.facilities).reduce((a,n)=>a+n,0):Object.values(meta.base||{}).reduce((a,n)=>a+n,0),built=!sun||b.sunBuilt;
 if(built){add(new THREE.CylinderGeometry(5,7,3,12),metal,[0,0,0]);const ring=add(new THREE.TorusGeometry(11,.7,8,80),dark,[0,0,0]);ring.rotation.x=Math.PI/2;const rim=add(new THREE.TorusGeometry(11.8,.1,6,80),glow,[0,.2,0]);rim.rotation.x=Math.PI/2;
  for(let i=0;i<4+rank;i++){const a=i*Math.PI*2/(4+rank),r=14+(i%3)*2;add(new THREE.BoxGeometry(3,2+i%3,5),metal,[Math.cos(a)*r,i%2,Math.sin(a)*r]);const arm=add(new THREE.BoxGeometry(1,.5,r),dark,[Math.cos(a)*r/2,0,Math.sin(a)*r/2]);arm.rotation.y=Math.PI/2-a;add(new THREE.BoxGeometry(2,.15,3),glow,[Math.cos(a)*r,2+i%3,Math.sin(a)*r]);}
  for(let i=0;i<2+Math.floor(rank/3);i++)add(new THREE.CylinderGeometry(2.7-i*.15,3.5-i*.2,1.4,8),metal,[0,3+i*1.5,0]);
 }
 root.position.set(24,-7,0);
 const ownedGeometry=[];root.traverse(o=>{if(o.geometry)ownedGeometry.push(o.geometry);});
 const schematic=root.children.filter(o=>o.isMesh);for(const o of schematic)o.visible=false;if(built)mountAsset(root,'orbital-dock',{size:36+Math.min(rank,12)*.5,hide:schematic,onReady:()=>{canvas.dataset.stationAsset='ready';},onUnavailable:()=>{canvas.dataset.stationAsset='unavailable';canvas.dataset.previewStatus='unavailable';status.textContent='기지 미리보기를 불러오지 못했습니다 · 시설 선택과 출격은 가능합니다';}});
 if(built){const facilities=sun?Object.entries(b.facilities):BASE_FACILITIES.map(d=>[d.id,cleanBase(meta.base)[d.id]]);for(const [i,[id,level]] of facilities.entries()){if(!level)continue;const asset=sun?({command:'facility-command',shipyard:'facility-drydock',forge:'facility-arsenal',shield:'facility-shieldLab',reactor:'facility-reactor',logistics:'facility-hangar'})[id]:'facility-'+id;for(let n=0;n<level;n++){const a=i*Math.PI*2/facilities.length+(n-(level-1)/2)*.18,r=15+n*3;mountAsset(root,asset,{size:5+level,position:[Math.cos(a)*r,2+n*.6,Math.sin(a)*r],rotation:[0,-a,0]});}}root.userData.facilityRanks=facilities;}
 const body=new THREE.Mesh(new THREE.SphereGeometry(sun?28:22,40,24),sun?new THREE.MeshBasicMaterial({color:0xe67b28}):new THREE.MeshStandardMaterial({color:0x277fb4,roughness:.9}));body.position.set(-35,8,6);scene.add(body);body.visible=false;const planet=new THREE.Group();planet.position.copy(body.position);scene.add(planet);mountAsset(planet,sun?'planet-volcanic':'solar-earth-clean',{size:sun?56:44,onReady:()=>{canvas.dataset.planetAsset='ready';}});
 if(sun){const halo=new THREE.Mesh(new THREE.SphereGeometry(29,32,20),new THREE.MeshBasicMaterial({color:0xffb33d,transparent:true,opacity:.18,side:THREE.BackSide}));halo.position.copy(body.position);scene.add(halo);}
 // Face the orbital pair from the front: an oblique camera projected the
 // foreground dock over Earth. Fit the horizontal span at narrow widths too.
 let raf,lastFrame=-Infinity;function draw(t){if(disposed)return;raf=requestAnimationFrame(draw);if(document.hidden||canvas.closest('.modal-root')?.inert||t-lastFrame<50)return;lastFrame=t;const rect=canvas.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)return;const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const distance=Math.max(130,116/(2*Math.tan(THREE.MathUtils.degToRad(21))*camera.aspect));camera.position.set(-5,distance*.24,distance);camera.lookAt(-5,2,0);root.rotation.y=t*.00006;renderer.render(scene,camera);if(canvas.dataset.previewStatus!=='ready'&&canvas.dataset.planetAsset==='ready'&&(!built||canvas.dataset.stationAsset==='ready')){canvas.dataset.previewStatus='ready';canvas.dataset.previewReadyMs=String(performance.now()-started);status.textContent='현재 시설이 적용된 실제 3D 기지 · 시설을 선택해 강화하세요';}}renderer.compileAsync(scene,camera).then(()=>{if(!disposed)raf=requestAnimationFrame(draw);}).catch(()=>{if(!disposed){canvas.dataset.previewStatus='unavailable';status.textContent='기지 미리보기를 불러오지 못했습니다 · 시설과 출격은 이용 가능합니다';}});
 release=()=>{cancelAnimationFrame(raf);root.userData.dispose?.();planet.userData.dispose?.();ownedGeometry.forEach(g=>g.dispose());body.geometry.dispose();scene.children.filter(o=>o.isMesh&&o!==body).forEach(o=>o.geometry.dispose());metal.dispose();dark.dispose();glow.dispose();body.material.dispose();scene.children.filter(o=>o.isMesh&&o!==body).forEach(o=>o.material.dispose());renderer.dispose();renderer.forceContextLoss();};
 }
 return ()=>{if(disposed)return;disposed=true;cancelAnimationFrame(launch);release?.();status.remove();};
}

