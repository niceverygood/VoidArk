import {FLEET_ROLES} from './fleet.js';
export const FLEET_UPGRADES={weapon:{name:'무장 증설',cost:60,description:'공격력 +25% / 단계 · 포대 추가'},armor:{name:'적층 장갑',cost:50,description:'기본 내구도 +25%, 피해 감소 +8% / 단계 · 장갑판 확장'},engine:{name:'추진 개조',cost:45,description:'편대 추종 +25%, 복귀 속도 +20% / 단계 · 추진 모듈 추가'},special:{name:'역할 전문화',cost:75,description:'수복 지원함 수복 +40%, 요격함 요격 거리 +6m, 함선 사거리 +12m / 단계 · 전용 장비 추가'}};
const rank=value=>Math.max(0,Math.min(3,Math.floor(Number(value)||0)));
function cleanOne(value){return {weapon:rank(value?.weapon),armor:rank(value?.armor),engine:rank(value?.engine),special:rank(value?.special)};}
export function fleetConfigurationKey(role,value){return `${role}:${rank(value?.weapon)}.${rank(value?.armor)}.${rank(value?.engine)}.${rank(value?.special)}`;}
export function cleanFleetUpgrades(value){return Array.from({length:10},(_,i)=>cleanOne(value?.[i]));}
export function fleetUpgradeCost(upgrades,id){return FLEET_UPGRADES[id]?FLEET_UPGRADES[id].cost*(1+(upgrades?.[id]||0))**2:Infinity;}
export function fleetConfiguration(role,value){
 const d=FLEET_ROLES[role],u=cleanOne(value),growth=1+Object.values(u).reduce((a,b)=>a+b,0)*.055,gear={...d.gear};
 gear.cannon=(gear.cannon||0)+u.weapon;gear.armor=(gear.armor||0)+u.armor;
 const primary={frigate:'shield',support:'shield',destroyer:'missile',interceptor:'fighter',cruiser:'laser'}[role];gear[primary]=(gear[primary]||0)+u.special;
 return {...d,upgrades:u,gear,growth,scale:d.scale*growth,hp:d.hp*(1+u.armor*.25),radius:d.radius*growth,damage:d.damage*(1+u.weapon*.25),range:d.range+u.special*12,resistance:u.armor*.08,follow:4*(1+u.engine*.25),recovery:1+u.engine*.2,support:1+u.special*.4,interceptRange:24+u.special*6,key:role+':'+Object.values(u).join('.')};
}
