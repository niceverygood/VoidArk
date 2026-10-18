export const BASE_FACILITIES = [
  {id:'command',name:'중앙 지휘소',base:20,color:0x75e4db,description:'도킹 범위 +4m / 단계 · 상위 시설 건설 해금'},
  {id:'drydock',name:'함체 건조소',base:25,color:0xdce9e4,requires:'command',description:'함선 최대 선체 +20 / 단계 · 선체 수리 비용 15%씩 감소'},
  {id:'shieldLab',name:'방어막 연구소',base:25,color:0x5ddcff,requires:'command',description:'최대 실드 +15 / 단계 · 실드 복구 비용 15%씩 감소'},
  {id:'arsenal',name:'무장 생산소',base:30,color:0xffb36c,requires:'command',description:'모든 무장 피해 +8% / 단계 · 장비 설치·강화 비용 10%씩 감소'},
  {id:'reactor',name:'융합 발전소',base:30,color:0xff92bf,requires:'command',description:'스킬 대기 시간 5%씩 감소 · 추진 충전 속도 +15% / 단계'},
  {id:'recycler',name:'잔해 재처리소',base:20,color:0xffdc79,requires:'command',description:'적 격파 고철 수익 +10% / 단계 · 회수 반경 +3m / 단계'},
  {id:'hangar',name:'호위기 관제 격납고',base:40,color:0x99bfff,requires:'arsenal',description:'독립 공격 호위기 +1 / 단계 · 기지 건설 비용 5%씩 감소'},
  {id:'drive',name:'추진 시험장',base:35,color:0x98ffac,requires:'reactor',description:'함선 이동 속도 +5% / 단계 · 장비 정비 비용 15%씩 감소'},
];
export function cleanBase(input={}) {return Object.fromEntries(BASE_FACILITIES.map(d=>[d.id,Number.isFinite(input?.[d.id])?Math.max(0,Math.min(3,Math.floor(input[d.id]))):0]));}
export function baseStats(input) {const b=cleanBase(input);return {hull:b.drydock*20,shield:b.shieldLab*15,power:b.arsenal*.08,cooldown:b.reactor*.05,boostRegen:b.reactor*.15,salvage:b.recycler*.1,magnet:b.recycler*3,speed:b.drive*.05,escorts:b.hangar,dockRange:18+b.command*4,repairDiscount:b.drydock*.15,shieldDiscount:b.shieldLab*.15,equipmentDiscount:b.arsenal*.1,maintenanceDiscount:b.drive*.15};}
export function constructionCost(input,id){const b=cleanBase(input),def=BASE_FACILITIES.find(d=>d.id===id);return def?Math.ceil(def.base*(b[id]+1)**2*(1-b.hangar*.05)):Infinity;}
export function constructionLock(input,id){const b=cleanBase(input),def=BASE_FACILITIES.find(d=>d.id===id);if(!def)return '알 수 없는 시설';if(b[id]>=3)return '최대 단계';if(def.requires&&b[def.requires]<1)return BASE_FACILITIES.find(d=>d.id===def.requires).name+' 1단계 필요';if(id!=='command'&&b[id]>=b.command)return '중앙 지휘소 '+(b[id]+1)+'단계 필요';return '';}
