// Shared operation data for simulation, menu and backdrop.
export const SECTOR_DEFS = [
  {name:'파편의 궤도', description:'무너진 궤도 기지 사이로,<br>낯선 함대의 신호가 다가옵니다.', tactic:'균형 편성 · 잔해 회수와 함선 성장', colors:[[.013,.22,.25],[.19,.035,.29]], unlock:[12,30,65,95], weights:[1,1,1,1,1]},
  {name:'붉은 성운', description:'요격기가 측면을 파고들고 저격함이 항로를 봉쇄합니다.<br>예고선을 확인하고 입체 기동으로 돌파하세요.', tactic:'요격·저격 편성 · 예고선 밖으로 부스트', colors:[[.36,.086,.035],[.39,.082,.17]], unlock:[8,22,65,95], weights:[1,3,3,1,1]},
  {name:'침묵의 심연', description:'중력 함선과 항모가 겹겹이 전장을 압박합니다.<br>펄스를 아껴 중력장과 증원을 함께 정리하세요.', tactic:'중력·항모 편성 · 펄스로 포위 해제', colors:[[.027,.09,.18],[.137,.027,.314]], unlock:[12,30,45,75], weights:[1,1,1,3,3]},
];
export function sectorDefinition(sector) {
  return SECTOR_DEFS[Math.max(0,Math.min(2,Math.floor(Number(sector)||1)-1))];
}
export function enemyPool(sector,time) {
  const def=sectorDefinition(sector), kinds=['swarm','interceptor','sniper','gravity','carrier'];
  return kinds.flatMap((kind,i)=>i===0||time>def.unlock[i-1]?Array(def.weights[i]).fill(kind):[]);
}
