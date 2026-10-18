import {ENEMY_OFFICERS} from './enemy-captains.js';

const supportedRole=role=>typeof role==='string'&&Object.hasOwn(ENEMY_OFFICERS,role);

// Called when an escort is created, never from the per-frame movement path.
export function selectEnemyReinforcementRole(leader,enemies=[]) {
  const roles=leader?.captain?.roles;
  if(leader?.id==null||!Array.isArray(roles))return 'striker';
  const weights=new Map();
  for(const role of roles)if(supportedRole(role))weights.set(role,(weights.get(role)||0)+1);
  if(!weights.size)return 'striker';

  const counts=new Map();let alive=0,totalWeight=0;
  for(const weight of weights.values())totalWeight+=weight;
  for(const escort of Array.isArray(enemies)?enemies:[]) {
    if(escort?.leaderId!==leader.id||!(escort.hp>0)||!supportedRole(escort.fleetRole))continue;
    alive++;counts.set(escort.fleetRole,(counts.get(escort.fleetRole)||0)+1);
  }

  let selected,best=-Infinity;
  for(const [role,weight] of weights) {
    // Integer deficit avoids floating-point ties; the first authored role wins ties.
    const deficit=weight*(alive+1)-(counts.get(role)||0)*totalWeight;
    if(deficit>best){best=deficit;selected=role;}
  }
  return selected;
}
