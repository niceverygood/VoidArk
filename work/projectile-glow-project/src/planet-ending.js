import {qaRendererOptions} from './qa-render-context.js';
import * as THREE from 'three';
import {createFrameScheduler} from './frame-scheduler.js';
import {createEndingPlayback,createEndingPreparation,deferEndingContextLoss} from './ending-playback.js';
import {planet} from './solar-visuals.js';
import {CAMPAIGN_STAGES} from './solar-campaign.js';
import {createPlayer,createPlanetEnemy} from './models.js';
import {createBossDestructionShot,BOSS_DESTRUCTION_SECONDS} from './boss-destruction-shot.js';
import {acquireWarmupAssets,hullAsset} from './asset-library.js';
export function createLandingGuide(scene){
 const marker=new THREE.Group();scene.add(marker);const mat=new THREE.MeshBasicMaterial({color:0x7ffff0,transparent:true,opacity:.85,depthTest:false});const ring=new THREE.Mesh(new THREE.TorusGeometry(9,.35,8,48),mat);ring.rotation.x=Math.PI/2;marker.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,35,8),mat);beam.position.y=17;marker.add(beam);const label=document.createElement('div');label.className='planet-landing-guide';label.hidden=true;document.body.append(label);const p=new THREE.Vector3();return {update(s,player,camera,time){const active=s?.phase==='landing'&&s.landing;marker.visible=!!active;label.hidden=!active;if(!active)return;marker.position.set(s.landing.x,s.landing.y,s.landing.z);ring.scale.setScalar(1+Math.sin(time*3)*.08);p.copy(marker.position).project(camera);const front=p.z<1;const x=front?p.x:(p.x>0?-2:2),y=front?p.y:0;label.style.left=Math.max(28,Math.min(innerWidth-250,(x*.5+.5)*innerWidth))+'px';label.style.top=Math.max(90,Math.min(innerHeight-110,(-y*.5+.5)*innerHeight))+'px';label.textContent='◇ '+s.name+' 표면 착륙 · '+Math.ceil(s.landing.distance)+'m · '+(front?'Q/E 고도 조절':'뒤쪽 · 카메라 회전');},dispose(){marker.removeFromParent();ring.geometry.dispose();beam.geometry.dispose();mat.dispose();label.remove();}};
}
const nextPreparationTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const endingModelKey=meta=>JSON.stringify([meta.tree,meta.base,meta.ship,meta.research]);
export function preparePlanetEnding(index,meta){
 const stage=CAMPAIGN_STAGES[index],key=endingModelKey(meta),canvas=document.createElement('canvas');
 canvas.setAttribute('aria-label','행성 점령 엔딩 영상');
 let renderer,scene,camera,world,starsGeo,starsMat,assets,destruction,contextLoss,prepared=false;const ships=[];
 const preparation=createEndingPreparation(async cancelled=>{
  renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,antialias:true}));
  renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight,false);renderer.toneMapping=THREE.ACESFilmicToneMapping;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,1500);
  scene.background=new THREE.Color(0x020711);scene.add(new THREE.HemisphereLight(0xc8edff,0x101b31,2));
  const sun=new THREE.DirectionalLight(0xffe5bd,3);sun.position.set(-80,100,120);scene.add(sun);
  await nextPreparationTask();if(cancelled())return false;
  world=planet(stage,40);scene.add(world);
  assets=acquireWarmupAssets([...Array.from({length:3},(_,i)=>hullAsset(meta.ship,i)),'module-engine','module-reactor','enemy-'+stage.id+'-capital',...(['mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'].includes(stage.id)?['solar-'+stage.id]:[])]);
  await assets.ready;if(cancelled())return false;
  for(let i=0;i<3;i++){
   await nextPreparationTask();if(cancelled())return false;
   const ship=createPlayer(i,{},meta.tree,meta.base,meta.ship,meta.research,'');ship.scale.setScalar(2);ship.visible=false;scene.add(ship);ships.push(ship);
  }
  const boss=createPlanetEnemy({planetTheme:stage.id,kind:'boss',fleetRole:'flagship',campaignBoss:'crown',radius:12});await boss.userData.assetReady;if(cancelled()){boss.userData.dispose?.();return false;}destruction=createBossDestructionShot(boss);scene.add(destruction.group);if(!await destruction.prepare(cancelled))return false;
  const positions=new Float32Array(900);for(let i=0;i<positions.length;i++)positions[i]=Math.sin(i*137.51)*600;
  starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  starsMat=new THREE.PointsMaterial({color:0x9dccff,size:1});scene.add(new THREE.Points(starsGeo,starsMat));
  camera.position.set(0,30,110);camera.lookAt(0,8,0);
  for(const ship of ships){
   await nextPreparationTask();if(cancelled())return false;
   ship.visible=true;await renderer.compileAsync(scene,camera);if(cancelled())return false;
   // Detached canvas: finish first-use uniform, shader-log and texture work here.
   renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);
   try{renderer.render(scene,camera);}finally{renderer.setScissorTest(false);ship.visible=false;}
  }
  prepared=true;return true;
 },()=>{destruction?.dispose();world?.userData.dispose();for(const ship of ships)ship.userData.dispose?.();assets?.release();starsGeo?.dispose();starsMat?.dispose();renderer?.dispose();contextLoss=deferEndingContextLoss(renderer);});
 return {canvas,ready:preparation.ready,dispose:preparation.dispose,diagnostics:()=>({...preparation.diagnostics(),prepared,contextLoss:contextLoss?{...contextLoss}:null,contexts:renderer&&(!preparation.diagnostics().released||contextLoss?.pending||contextLoss?.error)?1:0,models:ships.length,memory:renderer&&!preparation.diagnostics().released?{...renderer.info.memory}:null}),
  matches:(result,current)=>result.campaign.index===index&&endingModelKey(current)===key,
  attach(screen,result){screen.querySelector('canvas').replaceWith(canvas);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const ship=ships[Math.max(0,Math.min(2,Math.floor(Number(result.stage)||0)))];ship.visible=true;return {renderer,scene,camera,world,ship,destruction};}};
}
export function playPlanetEnding(result,meta,onComplete,prepared){
 const stage=CAMPAIGN_STAGES[result.campaign.index],screen=document.createElement('section');
 screen.className='planet-ending';
 screen.innerHTML='<canvas aria-label="행성 점령 엔딩 영상"></canvas><div class="ending-letterbox"></div><div class="ending-copy"><small>PLANET LIBERATED / STAGE '+String((stage.localIndex??stage.index)+1).padStart(2,'0')+'</small><h2>'+stage.name+' · 새로운 여명</h2><p>'+stage.title+'</p><b>행성 방어망 무력화 · 아크 선단 점령 완료</b><p data-ending-loading role="status">점령 영상 준비 중…</p></div><button>엔딩 건너뛰기</button>';
 document.body.append(screen);
 if(!prepared?.matches(result,meta)){prepared?.dispose();prepared=preparePlanetEnding(result.campaign.index,meta);}
 let renderer,scene,camera,world,ship,destruction;
 const finish=createEndingPlayback({
  prepare:async()=>{if(!await prepared.ready)throw new Error('Ending preparation closed');({renderer,scene,camera,world,ship,destruction}=prepared.attach(screen,result));screen.querySelector('[data-ending-loading]')?.remove();},
  durationMs:14000,
  createClock:frame=>createFrameScheduler(frame),
  render:t=>{
   const closeup=t<BOSS_DESTRUCTION_SECONDS;const shot=destruction.update(t,camera);screen.dataset.shot=shot.phase;world.visible=!closeup;ship.visible=!closeup;screen.querySelector('.ending-copy').style.opacity=closeup?'0':'1';if(closeup){renderer.render(scene,camera);return;}
   const u=Math.min(1,(t-BOSS_DESTRUCTION_SECONDS)/9);
   camera.position.set(Math.sin(u*.8)*105,30+u*25,110-u*35);camera.lookAt(0,8,0);
   world.rotation.y=t*.03;ship.position.set(-28+u*35,27,45-u*23);ship.rotation.y=-.4;
   screen.style.setProperty('--ending-progress',u);renderer.render(scene,camera);
  },
  release:()=>prepared.dispose(),
  onComplete:()=>{screen.remove();onComplete();},
 });
 screen.querySelector('button').onclick=finish;
 return finish;
}
