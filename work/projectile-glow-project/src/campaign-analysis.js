import {sortieSummaryMarkup} from './sortie-advice.js';
import {cleanSortieRecord} from './sortie-record.js';
import {bossInvestmentReport} from './boss-investments.js';
import {Simulation} from './sim.js';
import {followupQuotes} from './followup-loadouts.js';
import {recordFeedback} from './jupiter-record.js';
import {preparationBudget} from './campaign-economy.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Math.round(v||0).toLocaleString('ko-KR');
export function debriefPreparation(result,meta,target){
 const preview=new Simulation(structuredClone(meta));if(!preview.openCampaignBase(meta.campaign?.systemOwned?'sun':'earth'))return null;
 const services=preparationBudget(preview),reserve=services.reserve,money=preview.meta.bank+preview.scrap;
 const quotes=followupQuotes(preview,target.index,target.chapter);
 return {reserve,repair:services.repair,shield:services.shield,maintenance:services.maintenance,money,free:Math.max(0,money-reserve),deficit:Math.max(0,reserve-money),quotes,gear:{...preview.upgrades},next:target.stage?.name};
}
export function recordMarkup(result){
 if(result.campaign?.index!==3)return '';
 const r=result.battleRecord,valid=r?.version===1&&r.scope==='jupiter';
 return `<section class="combat-debrief-card"><span class="eyebrow">목성 · 실제 출격 기록</span><h3>${result.victory?'공략 성과를 다음 원정으로':'전투 기록으로 재도전 준비'}</h3>${valid?`<dl class="combat-record-metrics"><div><dt>수복 / 방패 호위 격파</dt><dd>${r.killed.support} / ${r.killed.guard}척</dd></div><div><dt>항모 격파</dt><dd>${r.killed.carrier}척</dd></div><div><dt>첫 항모 격파 · 생성 후 경과</dt><dd>${r.firstCarrierSeconds===null?'격파 기록 없음':r.firstCarrierSeconds.toFixed(1)+'초'}</dd></div><div><dt>관측한 적 수복량</dt><dd>${n(r.healed)} 내구도</dd></div><div><dt>방패 호위 적용 타격</dt><dd>${r.protectedHits}회</dd></div><div><dt>누적 선체 / 실드 손실</dt><dd>${n(r.hullLoss)} / ${n(r.shieldLoss)}</dd></div></dl>`:''}<div class="combat-record-feedback">${recordFeedback(r).map(row=>`<p>${esc(row)}</p>`).join('')}</div><small>이번 출격에서 기록한 전단만 집계합니다. 누적 손실은 수리 전후의 모든 피격 손실입니다. 명중률·DPS·회피 성공률은 기록하지 않아 표시하지 않습니다.</small></section>`;
}
export function analysisMarkup(result,meta,target){
 if(cleanSortieRecord(result.sortieRecord)){const preview=new Simulation(structuredClone(meta));preview.openCampaignBase(meta.campaign?.systemOwned?'sun':'earth');const p=bossInvestmentReport(preview,{next:target.stage});return `${sortieSummaryMarkup(meta,target.stage)}<section class="combat-debrief-plan"><h3>${esc(target.stage.name)} · 정비소에서 검토할 세 투자</h3><div class="loadout-grid">${p.rows.map(q=>`<article class="loadout-card"><h4>${{weapon:'대응 무기',survival:'생존',escort:'선단 엄호'}[q.key]}</h4><strong>${esc(q.name)}</strong><p>${esc(q.evidence||q.reason)}</p><p>현재 견적 ${q.cost} + 정비 ${q.reserve} = ${q.total} · 부족 ${q.shortfall}</p><small>${esc(q.state)} · 정비소에서 재계산</small><div class="loadout-actions"><button class="secondary-button" data-action="prepare-expedition" data-plan-equipment="${q.key}">${{weapon:'무기',survival:'생존',escort:'선단'}[q.key]} · 정비소에서 검토</button></div></article>`).join('')}</div><p>검토 버튼은 다음 목적지의 정비소만 엽니다. 자원은 사용하지 않습니다. 실패 시 같은 행성에, 점령 완료 시 다음 목표로 준비합니다.</p></section>`;}
 if(result.campaign?.index!==3)return '';
 const p=debriefPreparation(result,meta,target);if(!p)return recordMarkup(result);
 return `${recordMarkup(result)}<section class="combat-debrief-plan"><span class="eyebrow">${target.retry?'같은 작전 재도전':'다음 원정 준비'}</span><h3>${esc(p.next)} · 보상으로 준비할 3가지</h3><p>정비소 진입 기준: 보유 ${n(p.money)} · 수리 ${p.repair} + 실드 ${p.shield} + 추진·선단 ${p.maintenance} = 정비 예산 ${p.reserve} · 정비 후 강화 예산 ${n(p.free)}${p.deficit?` · 정비비 ${p.deficit} 부족`:''}</p><p>패배한 함선은 내구도 25%로 견인되어 정비소에서 계산됩니다. 아래는 지금 한 단계 강화할 견적이며, 선택만으로 자원이 사용되지 않습니다.</p><div class="loadout-grid">${p.quotes.map(q=>`<article class="loadout-card"><div class="loadout-title"><img src="/assets/meshy/${q.art}.png" width="56" height="56" alt=""><h4>${esc(q.name)}</h4></div><p>영구 보유 LV.${q.level} → ${q.max?'최대 단계':`LV.${q.level+1}`}</p><p>${esc(q.reason)}</p><strong>${q.max?'현재 장비 유지':`비용 ${q.cost} · 정비 예산 확보 후 ${q.repairSafe?'강화 가능':`${Math.max(0,q.cost+p.reserve-p.money)} 부족`}`}</strong><small>${esc(q.load)} · 실제 효과 비용은 적중 밀도에 따라 달라집니다</small><div class="loadout-actions"><button class="secondary-button" data-action="prepare-expedition" data-plan-equipment="${q.id}">${q.max?'다른 강화 검토':`${q.name} · 정비소에서 검토`}</button><small>${q.max?'최대 단계 · 추가 구매 없음':!q.repairSafe?'먼저 수리·충전을 확인하세요':'정비소에서 재계산 · 구매 확인 후 적용'}</small></div></article>`).join('')}</div><p>보상·다음 목적지는 아래 실제 정산과 작전 목표를 확인하세요. 연구·함선 변경·정비 후 가격과 예산은 정비소에서 갱신됩니다.</p></section>`;
}
export function preparationReportMarkup(sim,state){
 if(sim.campaignDock)return sortieSummaryMarkup(sim.meta,state.next);
 const p=sim.preparationReport;if(!p||state.chapter!==p.target.chapter||state.index!==p.target.index)return '';
 const {reserve}=preparationBudget(sim),money=sim.meta.bank+sim.scrap;
 return `<section class="combat-debrief-card"><span class="eyebrow">직전 목성 공략 → ${esc(state.next.name)}</span><h3>기록을 바탕으로 출격 준비</h3>${recordFeedback(p.result.battleRecord).map(row=>`<p>${esc(row)}</p>`).join('')}<p>현재 보유 ${n(money)} · 전체 정비 ${reserve} · 정비 후 강화 예산 ${n(Math.max(0,money-reserve))}</p><div class="base-hub-links"><button class="secondary-button" data-base-section="repair">수리·충전 먼저 확인</button><button class="secondary-button" data-base-section="equipment">장비 강화 확인</button></div><small>상세 공략 기록은 이번 세션에서만 유지됩니다. 새로고침 후 과거 성과는 추정하지 않습니다.</small></section>`;
}

