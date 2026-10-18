import * as THREE from 'three';
import {acquirePreviewRenderer} from './preview-renderer.js';
import {createPlayer,createFleetShip,animateShip} from './models.js';
import {createShipSupport} from './base.js';
import {hullAsset,assetDiagnostics} from './asset-library.js';
import {createPreviewTexturePreparation} from './preview-textures.js';

// Use the gameplay model, including learned modules; no separate illustration.
export function renderShipPreview(canvas,meta,configuration=null){
  let disposed=false,release=null,launch=0;const started=performance.now();
  const status=document.createElement('small');status.className='preview-status';status.setAttribute('role','status');status.textContent='3D 함선 준비 중 · 장비 선택과 출격은 바로 가능합니다';canvas.after(status);canvas.dataset.previewStatus='loading';
  const stats={setupMs:0,readyMs:null,renders:0};canvas.dataset.previewMetrics=JSON.stringify(stats);
  launch=requestAnimationFrame(()=>{launch=requestAnimationFrame(()=>initialize());});
  function initialize(){if(disposed||!canvas.isConnected)return;const setup=performance.now();
  const lease=acquirePreviewRenderer(),renderer=lease.renderer,context=canvas.getContext('2d');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,1000);
  scene.add(new THREE.HemisphereLight(0xbadfff,0x20273a,2));
  for(const [color,intensity,pos] of [[0xffffff,3,[-10,20,12]],[0x59dfff,2,[12,5,-10]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);scene.add(light);}
  const ship=configuration?createFleetShip(configuration):createPlayer(meta.previewStage??(meta.spaceBase?.capital?2:0),meta.campaignShip?.gear||{cannon:1},meta.tree,meta.base,meta.ship,{...meta.research,solar:meta.campaign?.systemOwned?meta.spaceBase:null});if(!configuration)createShipSupport(ship,meta.base,meta.previewStage??0);scene.add(ship);
  const bounds=new THREE.Box3().setFromObject(ship),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  ship.position.sub(center);const span=Math.max(size.x,size.y,size.z),distance=span*1.65;
  let raf=0,lastFrame=-Infinity;const start=performance.now(),texturePreparation=createPreviewTexturePreparation(renderer,scene);stats.setupMs=performance.now()-setup;canvas.dataset.previewMetrics=JSON.stringify(stats);
  function frame(now){if(disposed)return;raf=requestAnimationFrame(frame);if(document.hidden||canvas.closest('.modal-root')?.inert||renderer.getContext().isContextLost())return;const rect=canvas.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)return;
   try{const preparation=texturePreparation.step();stats.textureCount=preparation.textures;stats.textureUploads=(stats.textureUploads||0)+preparation.uploaded;stats.textureSliceMaxMs=Math.max(stats.textureSliceMaxMs||0,preparation.ms);if(!preparation.ready){canvas.dataset.previewMetrics=JSON.stringify(stats);return;}}
   catch{cancelAnimationFrame(raf);canvas.dataset.previewStatus='unavailable';status.textContent='미리보기 준비에 실패했습니다 · 장비 선택과 출격은 가능합니다';return;}
   if(now-lastFrame<50)return;lastFrame=now;const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();camera.position.set(distance*.55,distance*.62,distance*.72);camera.lookAt(0,0,0);ship.rotation.y=(performance.now()-start)*.00012;animateShip(ship,(performance.now()-start)/1000,{thrust:.2,dt:0});renderer.render(scene,camera);const buffer=renderer.domElement;if(canvas.width!==buffer.width||canvas.height!==buffer.height){canvas.width=buffer.width;canvas.height=buffer.height;}context.drawImage(buffer,0,0);stats.renders++;if(stats.readyMs===null){const id=configuration?null:hullAsset(meta.ship||'ark',meta.previewStage??(meta.spaceBase?.capital?2:0));if(configuration||ship.getObjectByName('meshy:'+id)){stats.readyMs=performance.now()-started;canvas.dataset.previewStatus='ready';status.textContent='현재 장비가 적용된 실제 3D 함선 · 출격 준비 가능';}else if(assetDiagnostics().failedIds.includes(id)){canvas.dataset.previewStatus='unavailable';status.textContent='함선 미리보기를 불러오지 못했습니다 · 장비와 출격은 정상 이용 가능합니다';}}canvas.dataset.previewMetrics=JSON.stringify(stats);}
  let compiling=true,releasePending=false,released=false;
  release=()=>{cancelAnimationFrame(raf);texturePreparation.dispose();if(compiling){releasePending=true;return;}if(released)return;released=true;ship.userData.dispose?.();lease.release();};
  // Parallel shader compilation keeps the next UI paint out of this work.
  renderer.compileAsync(scene,camera).then(()=>{if(!disposed)raf=requestAnimationFrame(frame);}).catch(()=>{if(!disposed){status.textContent='미리보기 준비에 실패했습니다 · 장비 선택과 출격은 가능합니다';canvas.dataset.previewStatus='unavailable';}}).finally(()=>{compiling=false;if(releasePending)release();});
  }
  return ()=>{if(disposed)return;disposed=true;cancelAnimationFrame(launch);release?.();status.remove();};
}
