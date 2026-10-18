export const TREE_BRANCHES = [
  {id:'arsenal',label:'포대 공학',color:'#73eaff',nodes:[
    ['cannonPower','레일 가속기','기관포 피해 +8%','cannon',.08],
    ['fireRate','급속 장전','기관포 연사 속도 +8%','fireRate',.08],
    ['laserPower','집광 렌즈','광선 피해 +10%','laser',.1],
    ['shotSpeed','탄도 가속','아군 탄속 +10%','shotSpeed',.1],
    ['allPower','함대 화력망','모든 무장 피해 +6%','power',.06]]},
  {id:'arc',label:'전기·반응로',color:'#c795ff',nodes:[
    ['chainPower','방전 증폭','번개 피해 +10%','chain',.1],
    ['chainReach','연쇄 도약','번개 도약 거리 +3m','chainReach',3],
    ['pulseRange','펄스 확장','전자기 펄스 반경 +3m','pulseRange',3],
    ['overTime','과충전 안정화','과충전 지속 시간 +2초','overTime',2],
    ['nova','플라즈마 신성','4번 스킬 해금 · 주변 광역 피해, 강화당 +60','nova',60]]},
  {id:'missiles',label:'미사일·중력',color:'#ffb46d',nodes:[
    ['missilePower','고폭 탄두','미사일 피해 +10%','missile',.1],
    ['barrageCount','확장 탄창','유도탄 폭우 +2발','barrageCount',2],
    ['pulsePower','충격파 코어','펄스 피해 +15%','pulsePower',.15],
    ['cooldown','동기화 회로','모든 스킬 재사용 시간 -4%','cooldown',.04],
    ['stasis','시간 구속장','5번 스킬 해금 · 주변 적 정지, 강화당 +1초','stasis',1]]},
  {id:'fleet',label:'호위 함대',color:'#89baff',nodes:[
    ['fighterPower','요격기 탄두','호위기 피해 +12%','fighter',.12],
    ['fighterRange','전술 데이터링크','호위기 조준 거리 +6m','fighterRange',6],
    ['fighterHaste','출격 관제','호위기 연사 속도 +8%','fighterHaste',.08],
    ['extraEscort','예비 격납고','추가 호위기 +1대','extraEscort',1],
    ['fleetShield','함대 방벽','최대 방어막 +20','shield',20]]},
  {id:'defense',label:'장갑·수리',color:'#8decc6',nodes:[
    ['hull','장갑 골격','최대 선체 +15','hull',15],
    ['resist','피해 분산','받는 피해 -4%','resist',.04],
    ['shieldRegen','방어막 복원','방어막 초당 재생 +0.75 (총량 상한 적용)','shieldRegen',1.5],
    ['regen','수리 나노봇','피격 4초 후 선체 초당 회복 +0.5','regen',.5],
    ['repair','긴급 재구성','6번 스킬 해금 · 선체·실드 회복, 강화당 +20','repair',20]]},
  {id:'mobility',label:'기동·회수',color:'#ffe18c',nodes:[
    ['speed','추진 벡터','이동 속도 +5%','speed',.05],
    ['boostRegen','추진 회수','부스트 초당 충전 +3','boostRegen',3],
    ['boostEconomy','효율 노즐','부스트 소모 -6%','boostEconomy',.06],
    ['magnet','인양 신호망','잔해 회수 반경 +3m','magnet',3],
    ['salvage','심층 인양','고철 회수량 +8%','salvage',.08]]},
  {id:'siege',label:'공성·관통',color:'#ff8978',fork:true,nodes:[
    ['bossPower','지휘함 파쇄탄','보스·행성 기지 피해 +6%','bossPower',.06],
    ['missileRadius','확산 탄두','미사일 폭발 반경 +2m','missileRadius',2],
    ['laserRange','장거리 집광','자동 광선 사거리 +6m','laserRange',6],
    ['cannonRange','원거리 표적기','기관포 사거리 +5m','cannonRange',5],
    ['lance','성간 관통 창','7번 스킬 해금 · 전방 120m 관통, 강화당 피해 +50','lance',50]]},
  {id:'warfare',label:'전자전·추격',color:'#ed9fef',fork:true,nodes:[
    ['critChance','약점 스캐너','직접 무장 치명타 확률 +4%','critChance',.04],
    ['critPower','코어 분석기','치명타 추가 피해 +15%','critPower',.15],
    ['chainTargets','분기 방전망','번개 연쇄 대상 +1','chainTargets',1],
    ['tailPower','추격 사격 관제','꼬리잡기 추가 피해 +8%','tailPower',.08],
    ['countermeasure','유도탄 교란','8번 스킬 해금 · 50m 내 적탄 제거·락온 해제, 강화당 반경 +5m','countermeasure',5]]},
  {id:'support',label:'전투 지원',color:'#9bdfbf',fork:true,nodes:[
    ['shieldOnKill','잔류 에너지 흡수','최근 3초 무피격 시 직접 격파마다 실드 +1','shieldOnKill',2],
    ['hullOnKill','재활용 수리기','직접 격파마다 선체 +1','hullOnKill',1],
    ['repairPower','수리 증폭기','긴급 재구성 회복량 +10%','repairPower',.1],
    ['fighterOrbit','외곽 호위 진형','호위기 궤도 반경 +1m','fighterOrbit',1],
    ['sentry','긴급 호위대','9번 스킬 해금 · 12초간 임시 호위기, 강화당 +2대','sentry',2]]},
  {id:'drive',label:'회피·도약',color:'#78c4ff',fork:true,nodes:[
    ['evadeCooldown','회피 냉각기','회피 재사용 시간 -6%','evadeCooldown',.06],
    ['evadeDuration','관성 안정기','회피 이동·무적 시간 +0.06초','evadeDuration',.06],
    ['evadeSpeed','측면 분사기','회피 속도 +2m/s','evadeSpeed',2],
    ['warpHaste','도약 축전기','궤도 도약 재충전 -10%','warpHaste',.1],
    ['driveSync','전력 우회망','모든 스킬 재사용 시간 -1.5%','cooldown',.015]]},
  {id:'economy',label:'산업·보급',color:'#e6c983',fork:true,nodes:[
    ['refining','잔해 정제기','격파 고철 회수량 +4%','salvage',.04],
    ['income','궤도 물류망','점령 행성 생산량 +8%','income',.08],
    ['equipmentDiscount','규격 부품 창고','기지 장비 강화 비용 -3%','equipmentDiscount',.03],
    ['constructionDiscount','건설 드론 제어','기지 건설 비용 -3%','constructionDiscount',.03],
    ['tractor','중력 인양빔','잔해 회수 반경 +2m','magnet',2]]},
  {id:'fortress',label:'요새·광역',color:'#b5dfed',fork:true,nodes:[
    ['shieldBank','방어막 축전판','최대 방어막 +12','shield',12],
    ['bulkhead','격벽 확장','최대 선체 +10','hull',10],
    ['reactiveArmor','반응 장갑판','받는 피해 -2%','resist',.02],
    ['shieldRelay','실드 중계탑','방어막 초당 재생 +0.25 (총량 상한 적용)','shieldRegen',.5],
    ['novaRange','신성 확산기','플라즈마 신성 반경 +2m','novaRange',2]]},
];
const APPEARANCES = {
  arsenal:[['barrels','레일 증폭 포대'],['rack','자동 장전 드럼'],['lens','집광 렌즈 포대'],['rails','탄도 가속 레일'],['dish','화력 관제 접시']],
  arc:[['coil','방전 코일'],['antenna','연쇄 송전 안테나'],['dish','펄스 확장 접시'],['core','반응로 안정기'],['core','플라즈마 신성 코어']],
  missiles:[['rack','외장 탄두 저장함'],['missiles','다연장 발사관'],['coil','충격파 발생기'],['antenna','스킬 동기화 안테나'],['gyroscope','시간 구속 자이로']],
  fleet:[['missiles','요격기 탄두 포드'],['dish','함대 통신 접시'],['antenna','출격 관제탑'],['hangar','예비 격납고'],['coil','함대 방벽 발생기']],
  defense:[['armor','외장 장갑 골격'],['armor','피해 분산 적층판'],['coil','방어막 복원 코일'],['rack','나노봇 수리 팩'],['core','긴급 재구성 코어']],
  mobility:[['fins','추진 벡터 날개'],['core','추진 에너지 회수기'],['nozzle','효율 추진 노즐'],['dish','인양 신호 접시'],['claw','잔해 인양 집게']],
  siege:[['barrels','중장 공성 포신'],['missiles','확산 탄두 포드'],['lens','장거리 광학 렌즈'],['dish','표적 탐색 레이더'],['lance','장축 관통 창 포대']],
  warfare:[['scanner','약점 탐지 패널'],['dish','코어 분석 접시'],['coil','분기 방전 코일'],['antenna','추격 관제 안테나'],['jammer','교란 송신 안테나']],
  support:[['coil','에너지 흡수 코일'],['rack','재활용 수리 팩'],['core','수리 증폭 코어'],['antenna','호위 진형 관제'],['hangar','긴급 호위대 격납고']],
  drive:[['radiator','회피 냉각 방열판'],['gyroscope','관성 안정 자이로'],['nozzle','측면 분사 노즐'],['core','도약 축전 코어'],['rails','전력 우회 레일']],
  economy:[['refinery','외장 정제 탱크'],['dish','궤도 물류 접시'],['rack','규격 부품 보급함'],['droneBay','건설 드론 베이'],['claw','중력 인양 집게']],
  fortress:[['armor','방어막 축전 패널'],['armor','함체 확장 격벽'],['armor','반응 장갑 적층판'],['antenna','실드 중계탑'],['gyroscope','신성 확산 링']],
};
export const RESEARCH_VISUALS=[
  {id:'hull',shape:'armor',branch:'defense',tier:3,appearance:'조선소 장갑판'},
  {id:'reactor',shape:'core',branch:'arc',tier:3,appearance:'조선소 반응로'},
  {id:'salvage',shape:'claw',branch:'mobility',tier:3,appearance:'조선소 인양 장치'},
];
export const TREE_NODES=TREE_BRANCHES.flatMap(branch=>branch.nodes.map((row,i)=>({
  id:row[0],name:row[1],description:row[2],stat:row[3],value:row[4],branch:branch.id,
  tier:branch.fork&&i===3?3:i+1,requires:branch.fork&&i===4?[branch.nodes[2][0],branch.nodes[3][0]]:i?branch.nodes[branch.fork&&i===3?1:i-1][0]:null,max:3,cost:40+i*45,
  shape:APPEARANCES[branch.id][i][0],appearance:APPEARANCES[branch.id][i][1],
})));
export const treePrerequisites=node=>Array.isArray(node.requires)?node.requires:node.requires?[node.requires]:[];
export const treeLocked=(node,tree)=>treePrerequisites(node).some(id=>!(tree[id]>0));
export function cleanTree(tree) {
  return Object.fromEntries(TREE_NODES.map(n=>[n.id,Number.isFinite(tree?.[n.id])?Math.max(0,Math.min(n.max,Math.floor(tree[n.id]))):0]));
}
export function treeStats(tree) {
  const levels=cleanTree(tree),stats={};
  for(const n of TREE_NODES)stats[n.stat]=(stats[n.stat]||0)+levels[n.id]*n.value;
  return stats;
}
export function treePurchase(meta,id) {
  const node=TREE_NODES.find(n=>n.id===id);if(!node)return false;
  const tree=cleanTree(meta.tree),level=tree[id],cost=node.cost*(level+1)**2;
  if(level>=node.max||treeLocked(node,tree)||!Number.isFinite(meta.bank)||meta.bank<cost)return false;
  meta.bank-=cost;tree[id]++;meta.tree=tree;return true;
}
