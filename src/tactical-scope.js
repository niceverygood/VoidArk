import {REGIONS} from './universe.js';
import {galaxyDefinition} from './galaxies.js';
import {PLANETS,planetBases} from './galaxy.js';
export const MAP_SCOPES={local:'내 주변',system:'행성계',galaxy:'은하계'};
export function tacticalView(snapshot,scope='local'){
 if(snapshot.campaign){const c=snapshot.campaign,scopeName=scope==='local'?'내 주변':scope==='system'?(c.systemName||'태양계')+' 작전':(c.galaxyName||'우리 은하')+' · '+(c.systemName||'태양계');const extent=scope==='local'?110:Math.max(c.extent?.x||600,c.extent?.z||600);return {scope,origin:snapshot.player,entities:[...(snapshot.enemies||[]),...(snapshot.fleet?.ships||[]).map(a=>({...a,kind:'fleet'}))],extent,scale:110/extent,verticalExtent:scope==='local'?50:c.extent?.y||240,label:scopeName+' · '+c.name+' 전장 · ±'+extent+'m'};}

 const origin=snapshot.player,galaxy=snapshot.galaxyId||'milky',all=PLANETS.filter(p=>p.galaxy===galaxy);
 const nearest=all.reduce((a,b)=>!a||Math.hypot(b.position.x-origin.x,b.position.y-origin.y,b.position.z-origin.z)<Math.hypot(a.position.x-origin.x,a.position.y-origin.y,a.position.z-origin.z)?b:a,null);
 const planets=scope==='local'?[]:scope==='system'?all.filter(p=>p.region===(snapshot.navigation?.planet.region||nearest?.region)):all;
 const entities=[...(snapshot.defenses||[]).filter(d=>d.hp>0),...(snapshot.cosmic||[]),...(snapshot.fleet?.ships||[]).filter(a=>a.hp>0).map(a=>({...a,id:'fleet-'+a.id,kind:'fleet'})),...(snapshot.enemies||[]),...planets.map(p=>({id:p.id,kind:'planet',x:p.position.x,y:p.position.y,z:p.position.z,owned:snapshot.territory?.owners?.[p.id]===snapshot.actor,name:p.name}))];
 if(scope==='system')for(const p of planets)for(const b of planetBases(p))if(!(snapshot.conquest?.[p.id]||[]).includes(b.index))entities.push({id:b.id,kind:'fortress',x:b.position.x,y:b.position.y,z:b.position.z});
 const extent=scope==='local'?110:Math.max(scope==='system'?500:26000,...planets.map(p=>Math.max(Math.abs(p.position.x-origin.x),Math.abs(p.position.z-origin.z),Math.abs(p.position.y-origin.y))*1.1));
 if(scope!=='local')entities.sort((a,b)=>(a.kind==='planet'?0:a.kind==='fortress'?1:2)-(b.kind==='planet'?0:b.kind==='fortress'?1:2));
 return {scope,origin,entities,extent,scale:110/extent,verticalExtent:scope==='local'?50:extent,label:scope==='local'?'±110m · 높이 · 이동 궤적':(scope==='system'?'행성계 · '+(REGIONS.find(r=>r.id===(snapshot.navigation?.planet.region||nearest?.region))?.name||''):galaxyDefinition(galaxy).name)+' · '+planets.length+'행성 · ±'+Math.round(extent/1000)+'km'};
}
export function battlefieldView(snapshot,view={entities:[],bosses:[]}){
 const origin=snapshot.player,extent=300,verticalExtent=130;
 const {entities,bosses}=view;entities.length=0;bosses.length=0;
 const append=e=>(/boss/i.test(e.kind)?bosses:entities).push(e);
 for(const e of snapshot.enemies||[])append(e);
 for(const e of snapshot.fleet?.ships||[])if(e.hp>0)append({...e,id:'fleet-'+e.id,kind:'fleet'});
 for(const e of snapshot.defenses||[])if(e.hp>0)append(e);
 for(const e of snapshot.cosmic||[])append(e);
 entities.unshift(...bosses);
 return Object.assign(view,{scope:'local',origin,extent,verticalExtent,scale:110/extent,label:'전장 · 반경 300m · 실제 고도',hostiles:(snapshot.enemies||[]).length});
}
