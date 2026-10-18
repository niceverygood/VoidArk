import {FLEET_ROLES} from './fleet.js';
import {campaignFleetRepairUnits} from './campaign-economy.js';

const n=v=>(Math.round((Number(v)||0)*10)/10).toLocaleString('ko-KR');
export function maintenanceReport(sim){
 const fleet=sim.fleet||[],damaged=fleet.filter(a=>a.hp<a.maxHp).length,disabled=fleet.filter(a=>a.hp<=0||a.disabled>0).length;
 const skills=Object.values(sim.skillTimers||{}).filter(t=>t>0).length;
 const summary=`현재 추진 ${n(sim.player.boost)} / 100 · 대기 스킬 ${skills}개\n선단 손상 ${damaged} / ${fleet.length}척 · 전투불능 ${disabled}척`;
 const ships=fleet.map(a=>`${a.slot+1}번 ${a.configuration?.name||FLEET_ROLES[a.role]?.name||a.name||'함선'} · 선체 ${n(a.hp)} / ${n(a.maxHp)} · ${a.hp<=0||a.disabled>0?'전투불능':a.hp<a.maxHp?'수리 필요':'정상'}`);
 const effect='정비 효과: 추진 완충 · 스킬·무장 대기 초기화 · 선단 전 함선 수리·전투불능 복귀';
 const reason=campaignFleetRepairUnits(sim)>0?'견적에 기본 정비와 선단 손상 비용·시설 할인이 반영됩니다.':'견적에 기본 정비 비용·시설 할인이 반영됩니다.';
 return {summary,ships,effect,reason,detail:[summary,...ships,effect,reason].join('\n')};
}
