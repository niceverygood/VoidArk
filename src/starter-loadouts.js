import {permanentEquipmentCost} from './campaign-economy.js';
export const STARTER_LOADOUTS=Object.freeze([
 {id:'focus',art:'module-cannon',name:'집중 포격',targets:{cannon:2},reason:'한 적을 빠르게 처치하고 싶을 때',effect:'기관포 Lv.2 · 기본 탄당 30 피해 · 기본 간격 0.33초',load:'추가 무장 없이 기관포 연사 강화',next:'다음 성장 · 기관포 Lv.3에서 동시 2발'},
 {id:'spread',art:'module-missile',name:'함대 제압',targets:{chain:1,missile:1},reason:'여러 호위함이 가까이 몰릴 때',effect:'방전기 기본 피해 32 · 최대 4척 연쇄 / 유도탄 기본 피해 39 · 2발',load:'초기 준비 후 자동 공격 · 방전 2.3초 / 유도탄 2.9초 기본 간격',next:'다음 성장 · 주력 방전기 또는 유도탄을 Lv.2로'},
 {id:'guard',art:'module-armor',name:'안전 항해',targets:{armor:1,shield:1},reason:'피격과 회피 조작이 아직 익숙하지 않을 때',effect:'장갑 1단계당 선체 +35 / 방어막 1단계당 실드 +25',load:'기본 기관포 유지 · 추가 공격 효과 없음',next:'다음 성장 · 공격 무장 설치로 처치 속도 보완'},
]);
export function loadoutQuote(sim,id){
 const def=STARTER_LOADOUTS.find(d=>d.id===id);if(!def)return null;
 const discount=sim.infrastructure.equipmentDiscount+sim.tech.equipmentDiscount;
 const needed=Object.entries(def.targets).filter(([key,target])=>(sim.upgrades[key]||0)<target);
 const cost=needed.reduce((sum,[key,target])=>{for(let lv=sim.upgrades[key]||0;lv<target;lv++)sum+=permanentEquipmentCost(lv,discount);return sum;},0);
 const money=sim.scrap+sim.meta.bank,services=sim.baseServices(),reserve=services.repair+services.shield;
 return {...def,needed,cost,money,remaining:money-cost,reserve,affordable:money>=cost,nextId:needed[0]?.[0],complete:needed.length===0};
}
export function starterLoadoutsMarkup(sim,selected){
 const purchaseEffects={cannon:'기관포 기본 피해 24 → 30 · 발사 간격 0.375 → 0.33초',chain:'방전기 기본 피해 32 · 최대 4척 연쇄',missile:'유도탄 기본 피해 39 · 한 번에 2발',armor:`최대 선체 ${Math.round(sim.player.maxHp)} → ${Math.round(sim.player.maxHp+35)} · 현재 선체도 35 수리`,shield:`최대 실드 ${Math.round(sim.player.maxShield)} → ${Math.round(sim.player.maxShield+25)} · 실드 충전 속도 강화`};
 const labels={cannon:'레일 기관포',chain:'아크 방전기',missile:'군집 유도탄',armor:'세라믹 적층 장갑',shield:'재생 방어막'};
 return `<section class="starter-loadouts"><span class="eyebrow">출격 조합 · 선택은 무료</span><h3>어떤 전투로 시작할까요?</h3><p>이미 가진 장비는 유지합니다. 선택 후 필요한 장비를 하나씩 확인·구매하세요. 수치는 함선·연구 보정 전 기본값이며 승률이나 FPS를 보장하지 않습니다.</p><div class="loadout-grid">${STARTER_LOADOUTS.map(def=>{const q=loadoutQuote(sim,def.id),active=selected===def.id;return `<article class="loadout-card ${active?'selected':''}" data-loadout-card="${def.id}"><div class="loadout-title"><img src="/assets/meshy/${def.art}.png" width="56" height="56" alt="" loading="lazy" decoding="async"><h4>${def.name}</h4></div><p>${def.reason}</p><p>${def.effect}</p><small>${def.load}</small><strong>${q.complete?'목표 장비 보유':`필요 ${q.cost} 아르켈륨 · ${q.affordable?`구매 후 ${q.remaining}`:`${q.cost-q.money} 부족`}`}</strong><small>현재 수리·실드 예산 ${q.reserve} · ${q.affordable&&q.remaining<q.reserve?'구매하면 정비 예산이 부족합니다':'정비와 장비 구매는 별도'}</small><p>${def.next}</p><div class="loadout-actions"><button class="secondary-button" data-loadout-plan="${def.id}" ${active?'disabled':''}>${active?'선택한 조합':q.complete?'보유 조합 확인':'이 조합 선택'}</button>${active&&!q.complete?`<button class="primary-button" data-base-equipment="${q.nextId}" data-confirm-name="${labels[q.nextId]}" data-confirm-effect="${purchaseEffects[q.nextId]}" ${sim.equipmentCost(q.nextId)>q.money?'disabled':''}>${labels[q.nextId]} · ${sim.equipmentCost(q.nextId)} · ${sim.upgrades[q.nextId]?'강화':'설치'}</button>`:''}${active?`<small>${q.complete?'모든 목표 장비가 적용됐습니다. 출격할 수 있습니다.':'조합 전체가 자동 구매되지 않습니다. 완료 후 남은 장비를 이어서 확인하세요.'}</small>`:'<small>선택 후 필요한 장비를 확인 팝업에서 개별 구매합니다.</small>'}</div></article>`;}).join('')}</div></section>`;
}
