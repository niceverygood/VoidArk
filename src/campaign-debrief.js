import {analysisMarkup} from './campaign-analysis.js';
import {BOSS_DOCTRINES} from './andromeda-boss.js';
import {CAMPAIGN_TUNING_LIMIT} from './campaign-growth.js';
import {BEGINNER_REPAIR_CAP,BEGINNER_SHIELD_CAP} from './campaign-economy.js';
import {SOLAR_STAGES,cleanCampaign,CAMPAIGN_STAGES} from './solar-campaign.js';
import {ANDROMEDA_STAGES} from './andromeda-campaign.js';
import {cleanSpaceBase,SOLAR_CAPITALS,SOLAR_FOUNDATION_COST,FLEET_BUILD_COST,solarStats,solarFleetConstructionState} from './space-bases.js';
import {GOODS,cleanEconomy} from './economy.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Math.round(v||0).toLocaleString('ko-KR');
export function expeditionTarget(meta,result={}){
 const p=cleanCampaign(meta.campaign),failed=result.campaign&&!result.victory;
 const chapter=failed?result.campaign.chapter:p.systemOwned?'andromeda':'solar';
 const remote=chapter==='andromeda',stages=remote?ANDROMEDA_STAGES:SOLAR_STAGES,cleared=remote?p.andromedaCleared:p.cleared;
 const index=failed?(remote?result.campaign.index-8:result.campaign.index):Math.min(cleared,stages.length-1);
 return {chapter:remote?'andromeda':'solar',index,stage:stages[index],retry:!!failed,replay:index<cleared,completed:p.andromedaOwned&&!failed};
}
export function validateExpeditionTarget(meta,target){
 const p=cleanCampaign(meta.campaign),remote=target?.chapter==='andromeda',stages=remote?ANDROMEDA_STAGES:SOLAR_STAGES;
 return !!target&&['solar','andromeda'].includes(target.chapter)&&Number.isInteger(target.index)&&target.index>=0&&target.index<stages.length&&target.index<=(remote?p.andromedaCleared:p.cleared)&&(!remote||p.systemOwned);
}
export function prepareExpedition(sim,target){
 if(!validateExpeditionTarget(sim.meta,target))return false;
 const prior=sim.result?structuredClone(sim.result):null;
 if(!sim.openCampaignBase(sim.meta.campaign?.systemOwned?'sun':'earth'))return false;
 sim.preparationReport=prior?.campaign?.index===3?{result:prior,target:structuredClone(target)}:null;
 sim.preparedCampaignTarget={chapter:target.chapter,index:target.index,retry:!!target.retry};return true;
}
export function campaignDebrief(result,meta){
 const target=expeditionTarget(meta,result),p=cleanCampaign(meta.campaign),b=cleanSpaceBase(meta.spaceBase),activeCapital=solarStats(meta).capital,money=meta.bank||0,construction=solarFleetConstructionState(meta);
 const first=result.campaign?.reward||0,operation=result.settlement?.operation??(result.victory?120:12);
 const loot=result.settlement?.loot??Math.max(0,(result.banked||0)-first-operation);
 const unlocks=p.systemOwned?[
  {name:'태양 궤도 기지',status:b.sunBuilt?'건설 완료':money>=SOLAR_FOUNDATION_COST?'건설 가능':'자원 부족',condition:`태양계 8행성 점령 완료 · 건설 ${SOLAR_FOUNDATION_COST} 아르켈륨`},
  ...SOLAR_CAPITALS.map(d=>({name:d.name,status:b.owned.includes(d.id)?activeCapital?.id===d.id?'지휘 중':'보유 · 선택 가능':!b.sunBuilt?'기지 건설 필요':b.facilities.shipyard<d.rank?`조선소 ${d.rank}단계 필요`:money<d.cost?'자원 부족':'제작 가능',condition:`태양 기지 + 대형 조선소 ${d.rank}단계 · 제작 ${d.cost} 아르켈륨`})),
  {name:'영구 원정 선단',status:`현재 선단 ${construction.count}척 · 추가 건조 한도 ${construction.capacity}척 · ${construction.reason||(money<Math.min(...Object.values(FLEET_BUILD_COST))?'자원 부족':'추가 건조 가능')}`,condition:`기존 선단은 유지됩니다. 사령부 1단계 + 조선소 1단계부터 추가 건조 · 함종별 ${Math.min(...Object.values(FLEET_BUILD_COST))}~${Math.max(...Object.values(FLEET_BUILD_COST))} 아르켈륨 · 사령부 1/2/3단계에서 한도 4/7/10척`},
  {name:'안드로메다 원정',status:p.andromedaOwned?'9거점 정복 완료':'출격 가능 · 무료',condition:'태양계 8행성 점령으로 개방 · 태양 기지·기함 제작은 선택 사항'}
 ]:[];
 return {target,loot,operation,first,total:loot+operation+first,bank:money,unlocks,progress:p};
}
export function targetMarkup(target){
 const s=target.stage;if(!s)return '';
 const tactic=s.chapter==='andromeda'?BOSS_DOCTRINES[s.system.id]:null;
 return `<article class="expedition-target"><span class="eyebrow">${target.completed?'원정 완료 · 최종전 재도전':target.replay||target.retry?'재도전 목표':'다음 점령 목표'}</span><h3>${esc(s.name)} <small>${esc(s.system?.name||'태양계')}</small></h3><p>${esc(s.title)}</p><p class="target-doctrine">${esc(s.system?.doctrine||'항모와 호위 편대 · 궤도 요새 · 중장갑 사령관/총독')}</p>${tactic?`<p class="boss-plan"><strong>보스 공략 · ${tactic.name}</strong><br>${tactic.counter}. 1 펄스로 충전 차단 · Z/C로 회피. 공격 뒤 3초 / 방어 장치 파괴 뒤 4.5초 코어 노출에 과충전·선단 돌격을 집중하세요. 기함·개별 무장 개조는 화력, 장갑 개조는 생존을 보완합니다. 특정 장비가 없어도 공격 후 반격할 수 있습니다.</p>`:''}<p>영구 성능 개조는 출격당 최대 ${CAMPAIGN_TUNING_LIMIT}회 획득 · 기존 개조 유지. 기본 장비의 전투 성장과 호위 레벨 해금은 계속됩니다.</p><div class="target-objectives"><span>봉쇄 함대 ${s.kills}척</span><span>요새 ${s.bases}개</span><span>보스 2척 → 표면 착륙</span></div><strong>${target.replay?'최초 점령 보상 0 · 전리품과 작전 보상은 회수':`최초 점령 시 +${num(s.reward)} 아르켈륨`}</strong><p class="target-reward-note">작전 승리 기본 보상 +120 · 전리품 회수량은 전투에 따라 달라집니다. 보스 격파만으로 점령되지 않습니다. 표면 착륙 후 정산됩니다.</p>${target.completed?'<p>추가 은하 원정은 아직 준비 중입니다. 완료한 작전은 다시 도전할 수 있습니다.</p>':''}</article>`;
}
function objectiveProgressMarkup(result){
 const p=result.objectiveProgress,stage=CAMPAIGN_STAGES[p?.index],phases={blockade:'봉쇄 함대 교전',bases:'궤도 요새 파괴',warden:'수호자 격파',governor:'총독 격파',landing:'표면 착륙'};
 if(!p||!Number.isInteger(p.index)||!stage||p.index!==result.campaign?.index||!Object.hasOwn(phases,p.phase)||!['combatKills','baseKills'].every(k=>Number.isInteger(p[k])&&p[k]>=0)||p.combatRequired!==stage.kills||p.basesRequired!==stage.bases||!['wardenDefeated','crownDefeated','landed'].every(k=>typeof p[k]==='boolean'))return '';
 const rows=[['봉쇄 함대',`${num(Math.min(p.combatKills,p.combatRequired))} / ${num(p.combatRequired)}척 · ${p.combatKills>=p.combatRequired?'달성':'미달성'}`],['궤도 요새',`${num(Math.min(p.baseKills,p.basesRequired))} / ${num(p.basesRequired)}개 · ${p.baseKills>=p.basesRequired?'달성':'미달성'}`],['수호자 격파',p.wardenDefeated?'완료':'미완료'],['총독 격파',p.crownDefeated?'완료':'미완료'],['표면 착륙·점령',p.landed?'완료':'미완료']];
 return `<section class="combat-debrief-card sortie-objectives"><span class="eyebrow">이번 출격 · ${esc(stage.name)}</span><h3>출격 종료 시 작전 목표</h3><p>종료 시 진행 · ${esc(p.landed?'표면 착륙 완료':phases[p.phase])}</p><dl class="combat-record-metrics">${rows.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><small>전체 격파 수와 봉쇄 함대 집계는 다릅니다. 보스 격파만으로 점령되지 않으며 요새 파괴와 표면 착륙까지 완료해야 합니다. 다음 출격에서는 작전 목표를 다시 진행합니다.</small></section>`;
}
export function debriefMarkup(result,meta){
 const d=campaignDebrief(result,meta),rows=[['전리품 회수',d.loot],[result.victory?'작전 완료 보상':'귀환 보급',d.operation],['최초 점령 보상',d.first]];
 const inventory=cleanEconomy(meta).inventory,supplies=`<aside class="prep-supplies result-supplies" aria-label="남은 보급품"><span class="eyebrow">남은 보급품 · 기지에서 사용</span>${['repair','charge'].map(id=>{const goods=GOODS.find(g=>g.id===id);return `<p><strong><kbd>${id==='repair'?'V':'X'}</kbd> ${esc(goods.name)} · ${num(inventory[id])}개</strong><small>${esc(goods.description)}${inventory[id]?'':' · 재고 없음'}</small></p>`;}).join('')}<small>결과 화면에서는 V/X를 사용할 수 없습니다. 아래 ‘${result.victory?'다음 원정 준비':'수리·재도전 준비'}’로 기지에 돌아간 뒤 사용하세요. 부족한 만큼만 회복하고 만충이면 소비하지 않습니다. 사용 후 정비 견적이 갱신됩니다. 재고는 기지에서 J 거래소로 보충할 수 있습니다.</small></aside>`;
 const recovery=!result.victory&&d.progress.cleared<3?`<p class="replay-note">신병 정비 지원 · 귀환 보급 ${num(d.operation)} 아르켈륨으로 선체 수리(최대 ${BEGINNER_REPAIR_CAP})와 실드 충전(최대 ${BEGINNER_SHIELD_CAP})을 할 수 있습니다. 먼저 기지에서 정비한 뒤 같은 행성에 재도전하세요. 장비 강화는 선택 사항입니다.</p>`:'';
 return `<div class="campaign-debrief">${objectiveProgressMarkup(result)}${supplies}${analysisMarkup(result,meta,d.target)}<div class="conquest-progress">지구 → 태양계 ${d.progress.cleared}/8 → 안드로메다 ${d.progress.andromedaCleared}/9</div><dl class="settlement-breakdown">${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>+${num(value)}</dd></div>`).join('')}<div class="settlement-total"><dt>이번 정산 합계</dt><dd>+${num(d.total)}</dd></div><div><dt>총 보유 아르켈륨</dt><dd>${num(d.bank)}</dd></div></dl>${!d.first&&result.victory?'<p class="replay-note">이미 점령한 행성의 최초 보상은 다시 지급되지 않습니다.</p>':''}${recovery}${targetMarkup(d.target)}<p class="fleet-growth-note">전투 성장: LV.6/10/15/22/30에서 호위 2/3/5/7/10척 해금 · 지휘 단계는 다음 출격에도 유지됩니다.</p>${d.unlocks.length?`<details class="conquest-unlocks" ${d.progress.cleared===8&&result.campaign?.index===7?'open':''}><summary>태양계 통일 · 해금과 다음 성장</summary><div>${d.unlocks.map(u=>`<article><strong>${esc(u.name)}</strong><b>${esc(u.status)}</b><p>${esc(u.condition)}</p></article>`).join('')}</div></details>`:''}</div>`;
}
