import {ANDROMEDA_STAGES} from './andromeda-campaign.js';
import {SOLAR_STAGES} from './solar-campaign.js';
import {UPGRADE_DEFS} from './sim.js';
import {damageMultiplier} from './combat-relations.js';
import {preparationBudget} from './campaign-economy.js';
export function followupQuotes(sim,index,chapter='solar'){
 const remote=chapter==='andromeda',stage=(remote?ANDROMEDA_STAGES:SOLAR_STAGES)[index],cleared=remote?(sim.meta.campaign?.andromedaCleared||0):(sim.meta.campaign?.cleared||0);if(!sim.campaignDock||!Number.isInteger(index)||!stage||(!remote&&index<1)||index>cleared||(sim.meta.campaign?.cleared||0)<1||(remote&&!sim.meta.campaign?.systemOwned))return [];
 const baseArmor=stage.armor||'structure',bossArmor=stage.armor||'heavy',armorName=({heavy:'중장갑',energy:'에너지',light:'경량'})[bossArmor];
 const {reserve}=preparationBudget(sim),money=sim.scrap+sim.meta.bank;
 return ['missile','laser','chain'].map(id=>{
  const def=UPGRADE_DEFS.find(d=>d.id===id),level=sim.upgrades[id]||0,cost=sim.equipmentCost(id),max=level>=def.maxLevel;
  const reason=id==='missile'?`요새 ×${damageMultiplier(id,baseArmor)} · ${armorName} 보스 ×${damageMultiplier(id,bossArmor)}. 봉쇄 뒤 ${stage.bases}개 요새와 총독을 공략합니다.`:id==='laser'?`${armorName} 보스 ×${damageMultiplier(id,bossArmor)} · 요새 ×${damageMultiplier(id,baseArmor)}. 직선에 겹친 함선을 관통합니다. 기관포의 같은 보스 상성은 ×${damageMultiplier('cannon',bossArmor)}입니다.`:`경량 호위 ×1.25 · 에너지 장갑 ×1.5. 가까운 편대에 유리하며, 다음 ${armorName} 보스 ×${damageMultiplier(id,bossArmor)} · 요새 ×${damageMultiplier(id,baseArmor)}도 함께 고려하세요.`;
  const load=id==='missile'?`발사당 ${level?level+1:0} → ${level+2}발 · 폭발 주변 피해 포함`:id==='laser'?'추가 실투사체 없음 · 광선과 직선 다중 적중 효과':'실투사체 없음 · 연쇄 경로와 적중 효과 증가';
  return {id,name:def.name,level,cost,max,money,reserve,remaining:money-cost,affordable:!max&&money>=cost,repairSafe:money-cost>=reserve,reason,load:max?'현재 최대 단계 유지 · 추가 효과 없음':load,art:id==='chain'?'module-reactor':`module-${id}`};
 });
}
export function followupMarkup(sim,state,effect){
 const rows=followupQuotes(sim,state.index,state.chapter);if(!rows.length)return '';
 return `<section class="starter-loadouts followup-loadouts"><span class="eyebrow">점령 보상으로 다음 원정 준비</span><h3>${state.next.name} · 다음 강화 3가지</h3><p>다음 적 장갑에 맞는 한 단계 강화 · 정비 예산 확보 후 선택하세요.</p><div class="loadout-grid">${rows.map(q=>`<article class="loadout-card ${sim.preferredDebriefEquipment===q.id?'selected':''}"><div class="loadout-title"><img src="/assets/meshy/${q.art}.png" width="56" height="56" alt=""><h4>${q.name}</h4></div><span>현재 Lv.${q.level} → ${q.max?'최대 단계':`Lv.${q.level+1}`}</span><p>${q.max?'현재 최대 단계입니다. 다른 무장을 보완하세요.':effect(sim,q.id)}</p><p>${q.reason}</p><small>${q.load} · 처리 비용은 배치·적중 수에 따라 달라집니다</small><strong>${q.max?'강화 완료':`비용 ${q.cost} · ${q.affordable?`구매 후 ${q.remaining}`:`${Math.max(0,q.cost-q.money)} 부족`}`}</strong><small>정비 + 강화 총 ${q.max?q.reserve:q.reserve+q.cost} · 보유 ${q.money} · 부족 ${q.max?Math.max(0,q.reserve-q.money):Math.max(0,q.reserve+q.cost-q.money)} 아르켈륨<br>전체 정비 예산 ${q.reserve} · ${q.max?'보유 장비 유지':q.repairSafe?'정비 예산 확보 가능':'수리·충전을 먼저 권장합니다'}</small><div class="loadout-actions"><button class="primary-button" data-base-equipment="${q.id}" data-confirm-name="${q.name}" data-confirm-effect="${effect(sim,q.id)}" ${!q.affordable?'disabled':''}>${q.max?'최대 강화':`${q.cost} 아르켈륨 · ${q.level?'강화':'설치'} 확인`}</button><small>기존 장비 유지 · 개별 확인 후 영구 적용</small></div></article>`).join('')}</div><small>상성은 기본값 · 함선·연구·사령관 특성은 추가 적용됩니다. 강화는 선택 사항입니다.</small></section>`;
}





