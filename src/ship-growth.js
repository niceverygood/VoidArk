import {cleanTree} from './skill-tree.js';
import {cleanBase} from './base-tech.js';
const limits={cannon:5,chain:5,missile:5,laser:5,fighter:4,armor:5,shield:5,magnet:4,reactor:4};
export const GROWTH_NAMES=['정찰함','무장 프리깃','중장 구축함','전투 순양함','기동 전함','항모 전단 기함','성간 요새함'];
export function hullDisplayName({capitalName,growth,stageName,stage}){
  const index=typeof stage==='number'?stage:0;
  return capitalName||(growth?.tier>0?growth.name:stageName)||['정찰선','구축함','전투모함'][index]||'전투모함';
}
export function shipGrowth(upgrades={},tree={},base={},legacyResearch={}){
  let equipment=0;
  for(const [id,max] of Object.entries(limits)){const n=Number.isFinite(upgrades[id])?Math.max(0,Math.min(max,Math.floor(upgrades[id]))):0;equipment+=Math.max(0,n-(id==='cannon'?1:0));}
  const research=Object.values(cleanTree(tree)).reduce((a,b)=>a+b,0),facilities=Object.values(cleanBase(base)).reduce((a,b)=>a+b,0);
  const legacy=['hull','reactor','salvage'].reduce((sum,id)=>sum+(Number.isFinite(legacyResearch[id])?Math.max(0,Math.min(5,Math.floor(legacyResearch[id]))):0),0);
  const score=equipment+research*.55+facilities*.5+legacy*.5,tier=Math.min(6,Math.floor(score/9));
  return {score,tier,name:GROWTH_NAMES[tier],scale:{x:1+score*.021,y:1+score*.031,z:1+score*.025},camera:1+score*.017};
}
