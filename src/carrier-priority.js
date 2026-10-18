import * as THREE from 'three';
import {planetCarrierIdentity} from './planet-enemies.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function carrierPriority(sim,previousId=null){
  if(sim.mode!=='campaign'||sim.campaign?.index!==3||sim.campaign?.chapter==='andromeda')return null;
  let leader=null,gap=300;
  for(const e of sim.enemies)if(e.hp>0&&e.enemyFleet&&e.fleetRole==='flagship'){
    const d=distance(e.position,sim.player.position);if(d<gap){leader=e;gap=d;}
  }
  if(!leader)return null;
  const members=sim.enemies.filter(e=>e.hp>0&&(e.id===leader.id||e.leaderId===leader.id));
  const supports=members.filter(e=>e.fleetRole==='support'&&members.some(a=>a.id!==e.id&&distance(e.position,a.position)<65));
  const guards=members.filter(e=>e.fleetRole==='guard'&&distance(e.position,leader.position)<22);
  const candidates=supports.length?supports:guards.length?guards:[leader];
  let target=candidates.find(e=>e.id===previousId)||candidates.reduce((a,b)=>distance(a.position,sim.player.position)<distance(b.position,sim.player.position)?a:b);
  const role=target.fleetRole,rate=target.captain?.tactic==='restore'?5:3;
  return {id:target.id,leaderId:leader.id,role,name:role==='support'?'수복함':role==='guard'?'방패 호위':'항모',
    reason:role==='support'?`65m 안 같은 전단을 초당 ${rate} 수복 · 먼저 끊으세요`:role==='guard'?'항모 22m 안에서 받는 피해 25% 감소 · 호위부터 제거':'유효 수복·방패 호위 없음 · 항모 집중 공격',
    count:candidates.length,supports:supports.length,guards:guards.length,leaderName:planetCarrierIdentity(leader)?.name||'적 항모',distance:Math.round(distance(target.position,sim.player.position))};
}

// One DOM marker, no Three mesh/material, particles or extra render pass.
export class CarrierPriorityGuide{
  constructor(mount){
    this.root=document.createElement('div');this.root.className='priority-marker';this.root.hidden=true;
    this.root.innerHTML='<i aria-hidden="true"></i><b></b><small></small>';mount.append(this.root);
    this.label=this.root.querySelector('b');this.detail=this.root.querySelector('small');this.point=new THREE.Vector3();this.view=new THREE.Vector3();this.lastScan=-Infinity;this.data=null;this.scans=0;this.projections=0;
  }
  update(sim,camera,models,width,height,now,active){
    if(!active){this.root.hidden=true;this.data=null;this.lastScan=-Infinity;return null;}
    let target=this.data&&sim.enemies.find(e=>e.id===this.data.id&&e.hp>0);
    if(now-this.lastScan>=200||!target){this.data=carrierPriority(sim,this.data?.id);this.lastScan=now;this.scans++;target=this.data&&sim.enemies.find(e=>e.id===this.data.id&&e.hp>0);}
    if(!target){this.root.hidden=true;return null;}
    this.data.distance=Math.round(distance(target.position,sim.player.position));
    const model=models.get(target.id);let visible=!!model;for(let p=model;p;p=p.parent)if(!p.visible)visible=false;
    this.root.hidden=!visible;if(!visible){this.data.visibility='hidden';return this.data;}
    this.point.set(target.position.x,target.position.y+(target.radius||3)+2,target.position.z);
    this.view.copy(this.point).applyMatrix4(camera.matrixWorldInverse);const behind=this.view.z>=0;this.point.project(camera);this.projections++;
    const inset=Math.min(80,width*.16),x=(this.point.x*.5+.5)*width,y=(-this.point.y*.5+.5)*height;
    const edge=behind||this.point.z< -1||this.point.z>1||x<inset||x>width-inset||y<100||y>height-100;
    let px=x,py=y;if(behind){px=width/2+(this.view.x>=0?1:-1)*width;py=height/2-this.view.y;}
    px=Math.max(inset,Math.min(width-inset,px));py=Math.max(100,Math.min(height-100,py));
    this.root.style.transform=`translate(${Math.round(px)}px,${Math.round(py)}px) translate(-50%,-50%)`;
    this.root.dataset.edge=String(edge);this.root.dataset.role=this.data.role;
    this.data.visibility=behind?'behind':edge?'offscreen':'onscreen';
    const arrow=Math.abs(px-width/2)>Math.abs(py-height/2)?(px<width/2?'← ':'→ '):(py<height/2?'↑ ':'↓ ');
    const label=(edge?arrow:'')+'우선 · '+this.data.name;
    if(this.label.textContent!==label)this.label.textContent=label;
    const detail=this.data.distance+'m'+(behind?' · 후방':edge?' · 화면 밖':'');if(this.detail.textContent!==detail)this.detail.textContent=detail;
    return this.data;
  }
  diagnostics(){return {data:this.data?{...this.data}:null,scans:this.scans,projections:this.projections,domNodes:4,extraDrawCalls:0};}
}
