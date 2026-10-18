import {GALAXIES} from './galaxies.js';
import {REGIONS} from './universe.js';
const names=['아우로라','케플러','니바','헬리오스','테라노바','아르카디아','베스퍼','카이론','오르비스','에레보스','칼데라','셀레네','제피르','모노리스','라구나','루멘','페로스','네뷸라','크로노스','아틀라스','옵시디언','엘리시움','아비스','오메가'];
const biomes=['해양','사막','빙하','화산','숲','가스'];
const colors=[0x429bbb,0xc7a16d,0x96cce3,0xa95541,0x52987a,0x9b83c9];
const original=names.map((name,i)=>{
  const angle=i*2.39996, distance=480+Math.floor(i/3)*1000;
  return {id:'planet-'+i,index:i,region:REGIONS[Math.floor(i/3)].id,name,level:1+Math.floor(i/2),biome:biomes[i%6],color:colors[i%6],radius:55+i%4*16,
    position:{x:Math.round(Math.cos(angle)*distance),y:(i%5-2)*65,z:Math.round(Math.sin(angle)*distance)},baseCount:3+i%4};
});
const suffixes=['프롤로그','아스테리아','노틸러스','솔라리스','아마란스','헤스티아','리브라','노바','이스카'];
const homePlanets=[...original,...Array.from({length:72},(_,n)=>{
const i=n+24,r=Math.floor(n/9),a=(r/8)*Math.PI*2+(n%9-4)*.07,d=10500+(n%9)*1700;
return {id:'planet-'+i,index:i,region:REGIONS[r].id,name:REGIONS[r].name.split(' ')[0]+' '+suffixes[n%9],level:4+r*2+Math.floor(n%9/2),biome:biomes[i%6],color:colors[i%6],radius:55+i%4*16,position:{x:Math.round(Math.cos(a)*d),y:(i%5-2)*65,z:Math.round(Math.sin(a)*d)},baseCount:3+i%4};
})];
export const PLANETS=GALAXIES.flatMap(g=>homePlanets.map(p=>({...p,galaxy:g.id,id:g.tier?g.id+'-'+p.id:p.id,index:p.index,level:p.level+g.tier*8,name:g.tier?g.name.split(' · ')[0]+' '+p.name:p.name,position:{x:p.position.x+g.offset.x,y:p.position.y,z:p.position.z+g.offset.z}})));
export const TOTAL_BASES=PLANETS.reduce((n,p)=>n+p.baseCount,0);
export function regionProgress(state,id,galaxy='milky'){const planets=PLANETS.filter(p=>p.region===id&&p.galaxy===galaxy);return {total:planets.length,owned:planets.filter(p=>occupied(state,p)).length};}
export function planetBases(planet){return Array.from({length:planet.baseCount},(_,i)=>{
  const a=i*Math.PI*2/planet.baseCount,range=planet.radius+45;
  return {id:planet.id+'-base-'+i,index:i,position:{x:planet.position.x+Math.cos(a)*range,y:planet.position.y+(i%3-1)*16,z:planet.position.z+Math.sin(a)*range}};
});}
export function cleanConquest(input={}) {return Object.fromEntries(PLANETS.map(p=>[p.id,[...new Set((Array.isArray(input?.[p.id])?input[p.id]:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<p.baseCount||n==='warden'||n==='crown'))]]));}
export function occupied(planetsState,planet){return basesDestroyed(planetsState,planet)>=planet.baseCount && !!planetsState?.[planet.id]?.includes('crown');}
export function galaxyProgress(state){return PLANETS.filter(p=>occupied(state,p));}

export function basesDestroyed(state,p){return (state?.[p.id]||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<p.baseCount).length;}
