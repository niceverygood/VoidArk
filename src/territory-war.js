import {invasionPriority} from './combat-relations.js';
import {PLANETS,occupied} from './galaxy.js';
import {civilizationForPlanet,civilizationForOwner,civilizationPriority} from './civilizations.js';
const validOwner=x=>typeof x==='string'&&((/^(faction-[1-5]|player|pilot-[a-f0-9]{16})$/).test(x)||!!civilizationForOwner(x));
const isAI=x=>x?.startsWith('faction-')||!!civilizationForOwner(x);
export function initialOwner(p){return civilizationForPlanet(p).owner;}
export class TerritoryWar {
 constructor(data={},conquest={}){
  this.time=Number.isFinite(data.time)?Math.max(0,data.time):0;this.nextRaid=Number.isFinite(data.nextRaid)?Math.max(0,data.nextRaid):75;this.serial=Number.isInteger(data.serial)?Math.max(1,data.serial):1;
  const protectedIds=new Set((Array.isArray(data.wars)?data.wars:[]).flatMap(w=>[w.source,w.target]));
  this.owners=Object.fromEntries(PLANETS.map(p=>[p.id,validOwner(data.owners?.[p.id])?data.civilizationsVersion!==1&&data.owners[p.id].startsWith('faction-')&&!protectedIds.has(p.id)?initialOwner(p):data.owners[p.id]:occupied(conquest,p)?'player':initialOwner(p)]));
  this.grace=Object.fromEntries(PLANETS.map(p=>[p.id,Number.isFinite(data.grace?.[p.id])?Math.max(0,data.grace[p.id]):0]));
  this.wars=(Array.isArray(data.wars)?data.wars:[]).slice(0,8).filter(w=>PLANETS.some(p=>p.id===w.target)&&validOwner(w.attacker)&&validOwner(w.defender)&&Number.isFinite(w.remaining)&&w.remaining>0&&Number.isInteger(w.kills)&&Number.isInteger(w.strength)&&w.strength>=2&&w.strength<=12).map(w=>({...w,remaining:Math.min(180,w.remaining),kills:Math.max(0,Math.min(w.strength,w.kills))}));this.log=[];this.events=[];
 }
 emit(type,data){this.events.push({type,...data});this.log.unshift({time:this.time,type,...data});this.log=this.log.slice(0,8);}
 raid(source,target,attacker,strength=5){const p=PLANETS.find(p=>p.id===target);if(!p||!validOwner(attacker)||!PLANETS.some(q=>q.id===source&&q.galaxy===p.galaxy&&this.owners[q.id]===attacker)||this.owners[target]===attacker||this.wars.some(w=>w.target===target)||this.wars.length>=8||isAI(attacker)&&civilizationPriority(attacker,this.owners[target])===0)return false;
 const war={id:'raid-'+this.serial++,source,target,attacker,defender:this.owners[target],remaining:120,strength:Math.min(12,Math.max(2,Math.floor(strength))),kills:0};this.wars.push(war);this.emit('raidStarted',{war:{...war},planet:p.name});return war;
 }
 claim(id,owner){const old=this.owners[id];this.owners[id]=owner;this.grace[id]=this.time+90;this.wars=this.wars.filter(w=>w.target!==id);if(old!==owner)this.emit('territoryChanged',{planet:PLANETS.find(p=>p.id===id).name,planetId:id,old,owner});}
 kill(id){const w=this.wars.find(w=>w.id===id);if(!w)return false;w.kills++;if(w.kills>=w.strength){this.wars=this.wars.filter(x=>x!==w);this.grace[w.target]=this.time+60;this.emit('raidDefended',{war:{...w},planet:PLANETS.find(p=>p.id===w.target).name});}return true;}
 tick(dt){if(!Number.isFinite(dt)||dt<=0)return;this.time+=Math.min(dt,1);this.nextRaid-=Math.min(dt,1);
 for(const w of [...this.wars]){w.remaining-=Math.min(dt,1);if(w.remaining<=0){if(this.owners[w.source]!==w.attacker||isAI(w.defender)&&isAI(w.attacker)&&(this.serial+w.strength)%3===0){this.wars=this.wars.filter(x=>x!==w);this.emit('raidDefended',{war:{...w},planet:PLANETS.find(p=>p.id===w.target).name});}else this.claim(w.target,w.attacker);}}
 if(this.nextRaid<=0){this.nextRaid=20;const owned=PLANETS.filter(p=>!isAI(this.owners[p.id])&&this.grace[p.id]<=this.time&&!this.wars.some(w=>w.target===p.id));
 const target=owned.length&&this.serial%3===1?owned[this.serial%owned.length]:PLANETS[(this.serial*13)%PLANETS.length];if(this.grace[target.id]>this.time||this.wars.some(w=>w.target===target.id))return;
 const source=PLANETS.filter(p=>p.galaxy===target.galaxy&&isAI(this.owners[p.id])&&this.owners[p.id]!==this.owners[target.id]&&invasionPriority(this.owners[p.id],this.owners[target.id])>0).sort((a,b)=>Math.hypot(a.position.x-target.position.x,a.position.z-target.position.z)/invasionPriority(this.owners[a.id],this.owners[target.id])-Math.hypot(b.position.x-target.position.x,b.position.z-target.position.z)/invasionPriority(this.owners[b.id],this.owners[target.id]))[0];if(source)this.raid(source.id,target.id,this.owners[source.id],4+target.level%4);
 }
 }
 snapshot(){return {civilizationsVersion:1,time:this.time,nextRaid:this.nextRaid,serial:this.serial,owners:{...this.owners},grace:{...this.grace},wars:this.wars.map(w=>({...w})),log:this.log.map(x=>({...x}))};}
}
