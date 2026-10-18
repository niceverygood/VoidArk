import {qaRendererOptions} from './qa-render-context.js';
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ProjectileVisuals,PROJECTILE_LOOKS} from './projectile-visuals.js';
import {assetDiagnostics} from './asset-library.js';
import {Effects} from './effects.js';
import {createSpaceReflections} from './space-reflections.js';
import './combat-preview.css';

const specs=[['ark','아크 추적 미사일','아이보리 장갑 / 청록 추진 / 자동 유도'],['hostile','크림슨 유도탄','적군 전용 / 검은 장갑 / 붉은 추적 궤적'],['swarm','군집 폭우 미사일','소형 은빛 탄체 / 황금 추진 / 다중 발사'],['siege','공성 중장갑 어뢰','대형 관통 탄두 / 쌍발 추진 / 보스 중화기'],['ion','이온 레일탄','청록 결정 코어 / 금속 레일 / 고속 직선 탄도'],['plasma','적 플라스마탄','붉은 결정 코어 / 청동 장갑 / 고열 탄도']];
const canvas=document.querySelector('canvas'),renderer=new THREE.WebGLRenderer(qaRendererOptions({canvas,antialias:true}));renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.8;
const scene=new THREE.Scene();scene.background=new THREE.Color('#050e17');const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,200);camera.position.set(8,4,16);camera.lookAt(1,0,0);const reflections=createSpaceReflections(renderer);scene.environment=reflections.texture;scene.environmentIntensity=.8;
scene.add(new THREE.HemisphereLight('#c2eaff','#17263a',1.6));const light=new THREE.DirectionalLight('#e3f6ff',3.2);light.position.set(-3,8,10);scene.add(light);const rim=new THREE.DirectionalLight('#ff9d6b',2);rim.position.set(4,-2,-4);scene.add(rim);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.55,.5,1));composer.addPass(new OutputPass());
const effectRoot=new THREE.Group();effectRoot.position.x=2;effectRoot.scale.setScalar(.4);scene.add(effectRoot);const fxPoint=p=>({x:(p.x-2)/.4,y:p.y/.4,z:p.z/.4});const visuals=new ProjectileVisuals(scene),effects=new Effects(effectRoot);let selected='ark',display,rotation=.3,tilt=-.3,zoom=16,drag,last=performance.now(),time=0,id=0,fireUntil=0,nextFire=0;const live=[];
function shot(kind){return {id:id++,type:kind==='ark'||kind==='swarm'?'missile':kind==='hostile'?'enemyMissile':kind==='siege'?'boss':'cannon',friendly:['ark','swarm','ion'].includes(kind),visualVariant:kind==='swarm'?'barrage':undefined,position:{x:0,y:0,z:0},direction:{x:0,y:1,z:0}};}
function select(kind){selected=kind;if(display){display.removeFromParent();display.userData.dispose?.();}display=visuals.create(shot(kind));display.scale.setScalar(3.6);display.rotation.z=-Math.PI/2;display.position.set(2,0,0);scene.add(display);const s=specs.find(s=>s[0]===kind);document.querySelector('#weapon-name').textContent=s[1];document.querySelector('#weapon-detail').textContent=s[2];for(const b of document.querySelectorAll('[data-kind]'))b.classList.toggle('selected',b.dataset.kind===kind);}
document.querySelector('#weapons').innerHTML=specs.map(([kind,name],i)=>`<button data-kind="${kind}" style="--tint:${PROJECTILE_LOOKS[kind].color}"><span>0${i+1}</span>${name}<b>↗</b></button>`).join('');document.querySelector('#weapons').onclick=e=>{const b=e.target.closest('button');if(b)select(b.dataset.kind);};
document.querySelector('#skills').innerHTML=[['pulse','전자기 펄스'],['barrage','유도탄 폭우'],['overcharge','코어 과충전'],['nova','신성 폭발'],['stasis','시간 구속'],['repair','나노 수복'],['lance','성간 관통 창'],['countermeasure','유도탄 교란'],['sentry','호위대 출격']].map(([id,name])=>`<button data-skill="${id}">${name}</button>`).join('');document.querySelector('#skills').onclick=e=>{const b=e.target.closest('button');if(b){effects.skill(b.dataset.skill,{x:0,y:0,z:0},Math.PI/2,0);if(b.dataset.skill==='barrage'){select('swarm');fireUntil=time+2;}}};
document.querySelector('#launch').onclick=()=>{fireUntil=time+2;};
canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag){rotation+=(e.clientX-drag[0])*.007;tilt+=(e.clientY-drag[1])*.007;drag=[e.clientX,e.clientY];}};canvas.onpointerup=()=>drag=null;canvas.onwheel=e=>{e.preventDefault();zoom=Math.max(10,Math.min(28,zoom+e.deltaY*.01));};
const starGeometry=new THREE.BufferGeometry(),stars=new Float32Array(900);for(let i=0;i<stars.length;i++)stars[i]=(Math.random()-.5)*100;starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#78a7c4',size:.06})));
const grid=new THREE.GridHelper(60,30,'#124456','#102834');grid.position.y=-4;scene.add(grid);select('ark');
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.04,(now-last)/1000);last=now;time+=dt;display.rotation.set(tilt,rotation,-Math.PI/2);for(const mat of display.userData.glowMaterials)mat.uniforms.time.value=time;camera.position.set(8,4,zoom);camera.lookAt(1,0,0);
 if(time<fireUntil&&time>nextFire){nextFire=time+.16;const s=shot(selected);s.position={x:1,y:-1,z:2};s.direction={x:1,y:.15,z:-.4};const model=visuals.create(s);scene.add(model);live.push({s,model,age:0});effects.muzzle(fxPoint(s.position),s.direction,s.type);}
 for(let i=live.length-1;i>=0;i--){const p=live[i];p.age+=dt;p.s.position.x+=dt*12;p.s.position.y+=dt*1.8;p.s.position.z-=dt*4.8;visuals.update(p.model,p.s,dt,time);if(p.age>.85){effects.explosion(fxPoint(p.s.position),2,PROJECTILE_LOOKS[selected].color);p.model.removeFromParent();p.model.userData.dispose?.();live.splice(i,1);}}
 visuals.tick(dt);effects.update(dt,time,camera,innerHeight);composer.render();document.querySelector('#asset-status').textContent=display.userData.ready?'MESHY 3D · PBR 모델 적용 완료':`모델 준비 중 · ${assetDiagnostics().loading} 로딩`;
}requestAnimationFrame(frame);
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});

