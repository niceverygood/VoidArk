import * as THREE from 'three';
import {selectDamageLabels} from './damage-label-layout.js';
import {receivedImpact,receivedImpactText} from './received-impact.js';

// Presentation only: feedback never changes simulation time or damage.
export class CombatFeedback {
  constructor(mount){
    this.root=document.createElement('div');this.root.className='combat-feedback';this.root.setAttribute('aria-hidden','true');
    this.root.innerHTML='<canvas></canvas><div class="combat-vignette"></div><div class="combat-direction"><i></i></div><div class="combat-confirm"><i></i><i></i><i></i><i></i></div><div class="combat-status"></div>';
    mount.append(this.root);this.canvas=this.root.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.vignette=this.root.querySelector('.combat-vignette');this.direction=this.root.querySelector('.combat-direction');this.confirm=this.root.querySelector('.combat-confirm');this.status=this.root.querySelector('.combat-status');
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.numbers=[];this.kick=0;this.energy=0;this.damageLife=0;this.markerLife=0;this.statusLife=0;this.clock=0;this.projected=new THREE.Vector3();
  }
  hit(event){
    const prior=this.numbers.find(n=>n.enemyId===event.enemyId&&n.life>.5);
    if(prior){prior.damage+=event.damage;prior.critical||=event.critical;prior.killed||=event.killed;prior.matchup=event.matchup;}
    else {if(this.numbers.length>=32)this.numbers.shift();this.numbers.push({...event,life:.8,max:.8});}
    this.marker={...event.position};this.markerLife=.18;this.confirm.classList.toggle('critical',!!event.critical);this.confirm.classList.toggle('kill',!!event.killed);
    this.kick=Math.max(this.kick,event.killed?.2:event.critical?.12:.045);this.energy=Math.max(this.energy,event.critical?.13:.035);
  }
  damage(event,player,camera,response=receivedImpact(event,this.reduced)){
    if(!response.active)return response;
    this.receivedCount=(this.receivedCount||0)+1;this.lastReceived=response;
    const hull=event.amount-event.shielded>0;
    // A small follow-up hit must not lengthen a large flash indefinitely.
    if(this.damageLife<=0||response.opacity>=this.damageOpacity){this.damageMax=response.life;this.damageLife=response.life;this.damageOpacity=response.opacity;this.hull=hull;this.vignette.classList.toggle('hull',hull);}
    this.kick=Math.max(this.kick,response.kick);this.energy=Math.max(this.energy,response.energy);
    this.status.textContent=receivedImpactText(response);this.status.classList.toggle('hull',hull);this.statusLife=.8;
    if(event.origin){const dir=new THREE.Vector3(event.origin.x-player.x,event.origin.y-player.y,event.origin.z-player.z).applyQuaternion(camera.quaternion.clone().invert());const angle=Math.atan2(dir.x,dir.y)*180/Math.PI;this.direction.style.transform='translate(-50%,-50%) rotate('+angle+'deg)';this.direction.dataset.active='true';}else this.direction.dataset.active='false';return response;
  }
  explosion(position,size,player){const distance=Math.hypot(position.x-player.x,position.y-player.y,position.z-player.z);const weight=Math.max(0,1-distance/130);this.kick=Math.max(this.kick,Math.min(1,size*.055)*weight);this.energy=Math.max(this.energy,Math.min(.22,size*.012)*weight);}
  update(dt,camera,width,height,active){
    this.root.hidden=!active;this.clock+=dt;this.kick*=Math.exp(-dt*14);this.energy*=Math.exp(-dt*12);this.damageLife=Math.max(0,this.damageLife-dt);this.markerLife=Math.max(0,this.markerLife-dt);this.statusLife=Math.max(0,this.statusLife-dt);
    const damageFade=this.damageLife/(this.damageMax||.55);this.vignette.style.opacity=String(damageFade*(this.damageOpacity||0));this.direction.style.opacity=this.direction.dataset.active==='true'?String(damageFade):'0';this.status.style.opacity=String(Math.min(1,this.statusLife*3));
    if(this.marker&&this.markerLife>0){this.projected.set(this.marker.x,this.marker.y,this.marker.z).project(camera);this.confirm.style.left=(this.projected.x*.5+.5)*width+'px';this.confirm.style.top=(-this.projected.y*.5+.5)*height+'px';this.confirm.style.opacity=this.projected.z<1&&this.projected.z>-1?String(this.markerLife/.18):'0';}else this.confirm.style.opacity='0';
    const ratio=Math.min(devicePixelRatio,1.5);if(this.canvas.width!==Math.round(width*ratio)||this.canvas.height!==Math.round(height*ratio)){this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);this.canvas.style.width=width+'px';this.canvas.style.height=height+'px';}
    const ctx=this.ctx;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.textAlign='center';ctx.lineWidth=3;
    const labels=[];
    this.numbers=this.numbers.filter(n=>{n.life-=dt;if(n.life<=0)return false;this.projected.set(n.position.x,n.position.y,n.position.z).project(camera);if(this.projected.z<=-1||this.projected.z>=1)return true;
      const x=(this.projected.x*.5+.5)*width,y=(-this.projected.y*.5+.5)*height-22-(1-n.life/n.max)*42;
      const font='700 '+(n.critical?22:16)+'px sans-serif',text=(n.critical?'✦ ':'')+Math.round(n.damage)+(n.matchup>1?' 우세':n.matchup<1?' 저항':'');ctx.font=font;
      labels.push({x,y,width:ctx.measureText(text).width,height:n.critical?24:18,critical:n.critical,killed:n.killed,n,font,text});return true;});
    for(const {n,x,y,font,text} of selectDamageLabels(labels,width,height)){
      ctx.globalAlpha=Math.min(1,n.life*4);ctx.font=font;ctx.strokeStyle='#03111c';ctx.fillStyle=n.critical?'#ffe88c':n.killed?'#ffb476':'#c2fbff';ctx.strokeText(text,x,y);ctx.fillText(text,x,y);if(n.killed){ctx.font='bold 11px sans-serif';ctx.fillText('격파',x,y+15);}
    }ctx.globalAlpha=1;
  }
  diagnostics(){return {count:this.receivedCount||0,last:this.lastReceived?{...this.lastReceived}:null,remaining:this.damageLife,kick:this.kick,energy:this.energy,reduced:this.reduced};}
  clear(){this.numbers=[];this.kick=0;this.energy=0;this.damageLife=0;this.damageMax=0;this.damageOpacity=0;this.markerLife=0;this.statusLife=0;this.lastReceived=null;}
}
