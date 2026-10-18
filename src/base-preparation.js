import {bossInvestmentsMarkup} from './boss-investments.js';
import {preparationReportMarkup} from './campaign-analysis.js';
import {jupiterPreparationMarkup} from './jupiter-preparation.js';
import {followupMarkup} from './followup-loadouts.js';
import {validateExpeditionTarget,targetMarkup} from './campaign-debrief.js';
import {starterLoadoutsMarkup} from './starter-loadouts.js';
import {beginnerSupport,BEGINNER_REPAIR_CAP,BEGINNER_SHIELD_CAP,equipmentPriceSteps,preparationBudget} from './campaign-economy.js';
import {UPGRADE_DEFS} from './sim.js';
import {BASE_FACILITIES,cleanBase,constructionCost,constructionLock} from './base-tech.js';
import {SOLAR_STAGES,cleanCampaign} from './solar-campaign.js';
import {ANDROMEDA_STAGES} from './andromeda-campaign.js';
import {GOODS} from './economy.js';
import {maintenanceReport} from './base-maintenance.js';
const n=v=>Math.round(v||0).toLocaleString('ko-KR');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function preparationState(sim){
 const progress=cleanCampaign(sim.meta.campaign),remote=progress.systemOwned,stages=remote?ANDROMEDA_STAGES:SOLAR_STAGES,index=Math.min(remote?progress.andromedaCleared:progress.cleared,stages.length-1);
 const selected=sim.campaignDock&&validateExpeditionTarget(sim.meta,sim.preparedCampaignTarget)?sim.preparedCampaignTarget:{chapter:remote?'andromeda':'solar',index};const list=selected.chapter==='andromeda'?ANDROMEDA_STAGES:SOLAR_STAGES;
 return {money:sim.scrap+sim.meta.bank,chapter:selected.chapter,index:selected.index,retry:!!selected.retry,next:list[selected.index],replay:selected.index<(selected.chapter==='andromeda'?progress.andromedaCleared:progress.cleared),damaged:sim.player.hp<sim.player.maxHp*.999,home:!!sim.campaignDock};
}
export function equipmentEffect(sim,id){
 const lv=sim.upgrades[id]||0,next=lv+1,p=sim.player;
 const change=(fn,suffix='')=>`${lv?fn(lv):'미장착'} → ${fn(next)}${suffix}`;
 if(id==='cannon')return `탄당 기본 피해 ${change(l=>18+l*6)} · ${next>=3?'동시 2발':'동시 1발'} · 기본 발사 간격 ${Math.max(.09,.42-next*.045).toFixed(2)}초`;
 if(id==='chain')return `적중 기본 피해 ${change(l=>20+l*12)} · 최대 ${3+next}척 연쇄`;
 if(id==='missile')return `미사일 기본 피해 ${change(l=>26+l*13)} · 한 번에 ${next+1}발`;
 if(id==='laser')return `기본 피해 ${change(l=>38+l*20)} · 직선상 적 관통`;
 if(id==='fighter')return `영구 요격기 ${lv*2} → ${next*2}대 · 성장/연구 호위기는 추가 적용`;
 if(id==='armor')return `최대 선체 ${n(p.maxHp)} → ${n(p.maxHp+35)} · 현재 선체도 35 수리`;
 if(id==='shield')return `최대 실드 ${n(p.maxShield)} → ${n(p.maxShield+25)} · 실드 충전 속도 강화`;
 if(id==='magnet')return `잔해 회수 반경 +8m · 이동 속도 약 +${(.9/(13+lv*.9)*100).toFixed(1)}% (현재 단계 대비)`;
 if(id==='reactor')return '모든 무장 피해 +12% · '+(sim.cooldownFactor()<=.45?'스킬 대기 배율 0.45× · 최소치 도달, 추가 감소 없음':'스킬 대기시간 6% 감소 · 최소 대기 배율 0.45×');
 return '';
}
export function basePreparationMarkup(sim,{solarPanel,defensePanel,selectedLoadout}){
 const p=sim.player,state=preparationState(sim),home=sim.campaignDock,sun=home==='sun',money=state.money,costs=sim.baseServices(),budget=preparationBudget(sim),steps=equipmentPriceSteps(sim);
 const action=home?`data-solar="${state.index}" data-chapter="${state.chapter}"`:'data-action="leave-base"';
 const launch=home?`${state.next.name} 출격`:'전장으로 복귀';
 const economyGuide=home?`<aside class="expedition-target prep-economy"><strong>원정 예산 · ${esc(state.next.name)}</strong><p>${state.replay?'재점령':'첫 점령'} 고정 보상 ${n((state.replay?0:state.next.reward)+120)} 아르켈륨 = 최초 점령 ${n(state.replay?0:state.next.reward)} + 승리 보급 120. 이미 점령한 행성은 승리 보급 120만 지급하며 회수 자원은 별도입니다.</p><p>영구 장비 기본 비용: 설치 ${steps[0]} · 다음 강화 ${steps.slice(1).join(' / ')}. 시설·연구 할인은 각 버튼에 반영됩니다. 전투 중 레벨업 선택은 무료이며 영구 구매와 별개입니다.</p>${beginnerSupport(sim)?`<p>신병 정비 지원 · 화성 첫 점령까지 선체 수리 최대 ${BEGINNER_REPAIR_CAP}, 실드 충전 최대 ${BEGINNER_SHIELD_CAP}. 패배 보급금 12로 두 작업을 모두 할 수 있습니다. 추진·선단 정비와 강화는 별도입니다.</p>`:'<p>신병 정비 지원 종료 · 손상량과 시설 할인에 따라 정비 비용이 계산됩니다.</p>'}</aside>`:'';
 const services=[['repair','선체 수리',`현재 선체 ${n(p.hp)} → ${n(p.maxHp)}. 최대 내구도는 그대로입니다.`],['shield','실드 충전',`현재 실드 ${n(p.shield)} → ${n(p.maxShield)}. 실드 장비 강화는 아래 장비 탭에서 합니다.`],['maintenance','추진·선단 정비',maintenanceReport(sim).detail]];
 const shortage=cost=>`<small class="purchase-reason">${money<cost?`${n(cost-money)} 아르켈륨 부족`:`구매 후 ${n(money-cost)} 아르켈륨 남음`}</small>`;
 const serviceStatus=state.damaged?'손상된 선체를 먼저 확인하세요':costs.shield>0?(p.shield<=0?'실드가 비어 있습니다 · 충전 권장':'실드 충전 필요 · 현재 용량을 확인하세요'):budget.maintenance>0?'추진·선단 정비 필요 · 아래 상태를 확인하세요':'상태 양호 · 필요한 경우에만 정비';
 const gain=v=>(Math.round(v*10)/10).toLocaleString('ko-KR');
 const supplies=['repair','charge'].map(id=>{
  const stock=sim.meta.economy?.inventory?.[id]||0,goods=GOODS.find(g=>g.id===id);
  const hp=Math.min(60,Math.max(0,p.maxHp-p.hp)),shield=Math.min(45,Math.max(0,p.maxShield-p.shield)),boost=Math.min(30,Math.max(0,100-p.boost));
  const full=id==='repair'?p.hp>=p.maxHp:p.shield>=p.maxShield&&p.boost>=100;
  const status=!stock?'재고 없음 · J 거래소에서 구매':p.hp<=0?'생존한 함선에서 사용 가능':full?(id==='repair'?'선체 완전 수리 · 키트 보존':'실드·추진 만충 · 셀 보존'):id==='repair'?`사용 가능 · 선체 +${gain(hp)}`:`사용 가능 · 실드 +${gain(shield)} / 추진 +${gain(boost)}`;
  return `<p><strong><kbd>${id==='repair'?'V':'X'}</kbd> ${esc(goods.name)} · ${n(stock)}개</strong><span>${status}</span><small>${esc(goods.description)}</small></p>`;
 }).join('');
 return `<section class="overlay-screen base-screen"><div class="base-flight-bar"><div><span class="eyebrow">${home?(state.replay?'재도전 준비':'출격 준비'):'전장 정비'}</span><strong>${home?`${state.replay?'재도전 목표':'다음 목표'} · ${state.next.name}`:'정비 후 전투에 다시 합류하세요'}</strong><small>${state.damaged?'선체 손상 · 수리 권장 · 현재 상태로도 출격 가능':'출격 가능 · 장비 강화와 기지 건설은 선택 사항'}</small></div><button class="primary-button" ${action} data-autofocus>${launch} →</button><button class="secondary-button" data-action="${home?'leave-base':'menu'}">${home?'행성 선택':'메뉴로'}</button></div>
 <div class="base-panel"><div class="prep-heading"><span class="eyebrow">${home?'1 준비 → 2 출격 → 3 점령 보상으로 성장':'수리와 강화는 다른 작업입니다'}</span><h2>${home?(sun?'태양 기지 · 헬리오스 성채':'지구 작전본부 · 블루 헤이븐'):'방주 정비 기지'}</h2><p>수리로 현재 손상을 복원하고, 장비 강화로 성능과 외형을 성장시키세요.${home?' 최초 기지 개설 지원금 80 아르켈륨은 한 번만 지급됩니다. 기지 복귀·재출격으로 다시 지급되지 않습니다.':''}</p></div>
 <div class="prep-overview"><div class="prep-readiness"><span class="eyebrow">현재 선택한 함선</span><h3>${esc(sim.solar?.capital?.name||sim.vessel.name)}</h3><dl><div><dt>선체</dt><dd>${n(p.hp)} / ${n(p.maxHp)}</dd></div><div><dt>실드</dt><dd>${n(p.shield)} / ${n(p.maxShield)}</dd></div><div><dt>사용 가능 자원</dt><dd>${n(money)} 아르켈륨</dd></div></dl><div class="prep-supplies" aria-label="보유 보급품"><span class="eyebrow">보유 보급품 · 기지와 전투에서 V/X 사용</span>${supplies}<small>거래소·확인창을 닫은 뒤 사용하세요. 만충이면 소비하지 않습니다.</small></div><p class="prep-budget-line">현재 정비: 수리 ${budget.repair} + 실드 ${budget.shield} + 추진·선단 ${budget.maintenance} = ${budget.reserve} · 강화 가용 ${Math.max(0,money-budget.reserve)} 아르켈륨</p><p class="current-equipment">장착 장비 · ${UPGRADE_DEFS.filter(d=>sim.upgrades[d.id]>0).map(d=>`${esc(d.name)} Lv.${sim.upgrades[d.id]}`).join(' · ')||'없음'}</p>${home?'<button class="secondary-button" data-action="fleet">함선 변경 · 무료 24종</button>':''}</div><div class="prep-ship"><canvas class="base-ship-preview" aria-label="현재 장비가 적용된 실제 3D 함선"></canvas><small>설치·강화 후 실제 함선에도 적용됩니다</small></div></div>
 ${home?preparationReportMarkup(sim,state):''}${home&&state.chapter==='solar'&&state.index===3?`<aside class="jupiter-support-notice" role="status"><strong>목성부터 신병 정비 지원 종료</strong><p>화성 첫 점령까지 적용되던 수리 최대 8 · 실드 충전 최대 4 지원이 끝났습니다. 이제 손상량과 시설 할인으로 비용을 계산합니다. 패배 보급 12만으로 완전 정비가 보장되지 않습니다.</p><p>현재 정비 ${budget.reserve} · 강화 가용 ${Math.max(0,money-budget.reserve)} 아르켈륨</p><button class="secondary-button" data-base-section="repair">정비 비용 확인</button></aside>`:''}${home?bossInvestmentsMarkup(sim,state):''}${home?'<details class="prep-group"><summary>작전 목표·점령 보상 상세</summary>'+targetMarkup({stage:state.next,retry:state.retry,replay:state.index<(state.chapter==='andromeda'?cleanCampaign(sim.meta.campaign).andromedaCleared:cleanCampaign(sim.meta.campaign).cleared),completed:!!sim.meta.campaign?.andromedaOwned})+'</details>':''}<details class="prep-group"><summary>원정 보상·가격표·정비 지원 상세</summary>${economyGuide}</details><nav class="prep-tabs" aria-label="출격 준비 메뉴"><button class="secondary-button" data-base-section="repair">수리 · 충전</button><button class="secondary-button" data-base-section="equipment">장비 설치 · 강화</button><button class="secondary-button" data-base-section="facilities">기지 성장</button></nav>
 <details class="prep-group" data-prep-group="repair" ${state.damaged||p.shield<p.maxShield?'open':''}><summary>수리 · 충전 <small>${serviceStatus}</small></summary><div class="base-service-grid">${services.map(([id,name,description])=>{const complete=costs[id]===0||(id==='maintenance'&&p.boost>=100&&Object.values(sim.skillTimers).every(t=>t===0)&&sim.fleet.every(a=>a.hp>=a.maxHp));return `<article><h3>${name}</h3><p class="${id==='maintenance'?'maintenance-status':''}">${esc(description)}</p><button class="secondary-button" data-base-service="${id}" ${complete||money<costs[id]?'disabled':''}>${complete?'정비 필요 없음':`${n(costs[id])} 아르켈륨 · ${id==='repair'?'수리':id==='shield'?'충전':'정비'}`}</button>${complete?'':shortage(costs[id])}</article>`;}).join('')}</div></details>
 <details class="prep-group" data-prep-group="equipment" ${home?'':'open'}><summary>장비 설치 · 강화 <small>영구 성장 · 선택하면 비용과 전후 외형 확인</small></summary>${home&&state.chapter==='solar'&&state.index===0?starterLoadoutsMarkup(sim,selectedLoadout):''}<p>미장착 장비는 설치, 이미 장착한 장비는 다음 단계로 강화합니다. 기본 무장 수치는 연구·상성·스킬에 따라 추가 보정됩니다.</p><div class="base-equipment">${UPGRADE_DEFS.map(d=>{const lv=sim.upgrades[d.id],max=lv>=d.maxLevel,cost=sim.equipmentCost(d.id);return `<article><strong>${d.name}</strong><span>${lv?`현재 Lv.${lv} → ${max?'최대 단계':`Lv.${lv+1}`}`:'미장착 → Lv.1 설치'}</span><p>${max?(d.id==='magnet'?`장비 누적 효과 · 회수 반경 +${lv*8}m · 이동 속도 약 +${(lv*.9/13*100).toFixed(1)}% (미장착 대비)`:d.id==='fighter'?`장비 누적 효과 · 영구 요격기 ${lv*2}대 · 성장/연구 호위기는 추가 적용`:d.id==='shield'?`장비 누적 효과 · 최대 실드 +${lv*25} · 피격 후 재충전 강화`:d.id==='armor'?`장비 누적 효과 · 최대 선체 +${lv*35}`:d.id==='laser'?`장착 무장 · 기본 피해 ${38+lv*20} · 직선상 적 관통`:d.id==='chain'?`장착 무장 · 적중 기본 피해 ${20+lv*12} · 기본 최대 ${3+lv}척 연쇄 (연구 추가 적용)`:d.id==='cannon'?`장착 무장 · 탄당 기본 피해 ${18+lv*6} · ${lv>=3?'동시 2발':'동시 1발'} · 기본 발사 간격 ${Math.max(.09,.42-lv*.045).toFixed(2)}초`:d.id==='missile'?`장착 무장 · 미사일 기본 피해 ${26+lv*13} · 한 번에 ${lv+1}발`:d.id==='reactor'?`장비 누적 효과 · 기본 화력 가산 +${lv*12}% (장비 몫) · 현재 스킬 대기 배율 ${sim.cooldownFactor().toFixed(2)}×${sim.cooldownFactor()<=.45?' · 최소치 도달':''}`:d.description):equipmentEffect(sim,d.id)}</p><button class="secondary-button" data-base-equipment="${d.id}" ${max||money<cost?'disabled':''}>${max?'최대 강화':`${n(cost)} 아르켈륨 · ${lv?'강화':'설치'}`}</button>${max?'':shortage(cost)}</article>`;}).join('')}</div></details>
 <details class="prep-group" data-prep-group="facilities"><summary>기지 성장 <small>시설과 방어 건설 · 다음 출격에도 지원</small></summary>${home?`<div class="base-hub-links"><button class="secondary-button" data-campaign-base="earth" ${!sun?'disabled':''}>지구 기지</button><button class="secondary-button" data-campaign-base="sun" ${!sim.meta.campaign?.systemOwned||sun?'disabled':''}>${sim.meta.campaign?.systemOwned?'태양 기지':'태양계 8개 행성 정복 후 해금'}</button></div><div class="station-inspection"><canvas class="station-preview" aria-label="시설 단계에 따라 확장되는 실제 3D 기지"></canvas><small>${sun?'태양 궤도 성채':'지구 궤도 · 블루 헤이븐'}</small></div>`:''}${sun?solarPanel(sim):defensePanel(sim,'home')}<h3>지원 시설 · 영구 확장</h3><div class="base-equipment">${BASE_FACILITIES.map(d=>{const lv=cleanBase(sim.meta.base)[d.id],cost=Math.ceil(constructionCost(sim.meta.base,d.id)*(1-sim.tech.constructionDiscount)),lock=constructionLock(sim.meta.base,d.id);return `<article><strong>${d.name}</strong><span>현재 ${lv} / 3단계</span><p>${d.description}</p><button class="secondary-button" data-construction="${d.id}" ${lock||money<cost?'disabled':''}>${lock||`${n(cost)} 아르켈륨 · ${lv?'증축':'건설'}`}</button>${lock?'':shortage(cost)}</article>`;}).join('')}</div></details>
 <details class="prep-group"><summary>자원 · 거래 <small>상점과 회수 자원 보관</small></summary><div class="base-wallet-actions"><button class="secondary-button" data-action="market">광물 거래소 · 상점</button><button class="secondary-button" data-action="bank-minerals" ${sim.scrap<=0?'disabled':''}>회수 자원 ${n(sim.scrap)} 전량 보관</button></div><p>출격 중 회수한 자원부터 사용하고, 부족분은 보관 자원 ${n(sim.meta.bank)}에서 지불합니다. 패배한 함선은 선체 25%로 견인됩니다.</p></details></div></section>`;
}





