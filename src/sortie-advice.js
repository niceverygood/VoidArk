import {cleanSortieRecord,sortieConfiguration} from './sortie-record.js';
import {CAMPAIGN_STAGES} from './solar-campaign.js';
const n=v=>Number(v||0).toLocaleString('ko-KR',{maximumFractionDigits:1});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const andromedaBossRows=r=>['warden','crown'].map(rank=>{const boss=r.bosses.find(b=>b.rank===rank);return {name:rank==='warden'?'수호자':'총독',status:boss?boss.defeated?'격파':'관측 · 미격파':'관측 기록 없음',boss};});
export function sortieAdvice(meta,next,now=Date.now()){
 const r=cleanSortieRecord(meta.lastSortie),base={status:'first',label:'첫 준비 · 현재 목적지 기준 기본 안내',record:r,transition:'',reasons:{weapon:'',survival:'',escort:''}};
 if(!r)return base;
 const from=CAMPAIGN_STAGES[r.stage],same=r.stage===next.index,sameDoctrine=(from.system?.id||'solar')===(next.system?.id||'solar');
 base.transition=`${from.name} ${r.outcome==='victory'?'점령 완료':'실패'} → ${next.name}${same?' 재도전':' 출격'}`;
 if(now-r.at>7*864e5||now<r.at-3e5||(meta.runs||0)-r.run>2){base.status='stale';base.label='오래된 출격 기록 · 현재 목적지 기준 기본 안내';return base;}
 if(r.configuration!==sortieConfiguration(meta)){base.status='changed';base.label='함선·장비·연구·선단 구성이 바뀜 · 이전 기록으로 새 성능을 예측하지 않음';return base;}
 if(r.duration<10&&!r.bosses.some(b=>b.defeated)&&r.outcome!=='victory'){base.status='partial';base.label='짧은 출격 기록 · 공략 판단 근거 부족, 기본 안내';return base;}
 base.status='valid';base.label='직전 실제 출격 참고 · 원인을 단정하거나 클리어를 보장하지 않음';
 const b=r.bosses.find(b=>b.rank==='crown')||r.bosses[0],bossNote=b?(from.system?`안드로메다 보스 기록 · ${andromedaBossRows(r).map(row=>`${row.name} ${row.status}${row.boss?` · 적중 ${n(row.boss.hits)}회 · 장치 파괴 ${row.boss.device} · 충전 차단 ${row.boss.interrupt} · 공격 후 노출 ${row.boss.attack}회`:''}`).join(' / ')}. 보스 격파 후에도 요새 파괴와 표면 착륙을 완료해야 점령됩니다.`:`태양계 보스 기록 · ${r.bosses.map(b=>`${b.rank==='warden'?'수호자':'총독'} 적중 ${n(b.hits)}회 · ${b.defeated?'격파':'미격파'} · 공격 뒤 냉각 ${b.attack}회 · 충전 차단 ${b.interrupt}회`).join(' / ')}. 냉각은 반격 시간이며 별도 피해 배율은 없습니다.`):'보스 전투 기록이 없습니다. 이전 출격으로 보스 대응 무기의 효율은 판단하지 않습니다.';
 base.reasons.weapon=(!sameDoctrine?`다음 목적지는 ${next.system?.name||'태양계'}의 다른 전술입니다. 이전 무기 성과를 그대로 적용하지 않고 현재 상성으로 비교합니다. `:same?'같은 행성 재도전입니다. ':'다음 행성도 같은 전술 계열이지만 난도와 장갑은 달라질 수 있습니다. ')+bossNote+' 처치 시간·명중률이 없으므로 화력 부족으로 단정하지 않습니다.';
 const source=Object.entries(r.causes).sort((a,b)=>b[1]-a[1])[0],names={projectile:'탄환',beam:'예고 주포',contact:'접촉',gravity:'중력',boundary:'전장 이탈',other:'기타'};
 base.reasons.survival=`직전 누적 선체 ${n(r.hull)} · 실드 ${n(r.shield)} 손실.`+(source?.[1]>0?` 기록된 손실 중 ${names[source[0]]} ${n(source[1])}가 가장 컸습니다.`:' 피해 기록이 없어 생존 장비가 부족했다고 판단하지 않습니다.')+(source?.[0]==='boundary'&&source[1]>0?' 전장 복귀가 우선이며 용량 강화로 경계 소모를 해결하지 못합니다.':' 수리·실드 예산을 먼저 확인하고 Z/C·Q/E 회피와 용량 강화를 비교하세요.')+(r.outcome==='defeat'?' 실패 원인을 이 기록만으로 확정하지 않습니다.':'');
 base.reasons.escort=`직전 선단 전투불능 ${r.fleetDisabled}회 · 실제 요격 ${r.intercepts}발 · 선체 수복 ${n(r.supportHull)}.`+(r.fleetDisabled?' 먼저 추진·선단 정비로 복구 상태를 확인하세요. 개별 장갑 개조와 복구는 별개입니다.':' 지원 기록 0은 지원이 필요 없었거나 경로·역할 조건이 맞지 않았을 수도 있습니다.')+(!sameDoctrine?' 다음 전술의 함종과 엄호 역할로 다시 비교하세요.':' 현재 편대 역할과 아래 개조 수치를 함께 확인하세요.');
 return base;
}
export function sortieSummaryMarkup(meta,next){
 const p=sortieAdvice(meta,next),r=p.record;
 const bosses=r&&CAMPAIGN_STAGES[r.stage].system?andromedaBossRows(r).map(row=>`<div><dt>해당 출격 · ${esc(row.name)}</dt><dd>${esc(row.status)}</dd></div>`).join(''):'';
 return `<section class="combat-debrief-card sortie-feedback"><span class="eyebrow">${esc(p.transition||'첫 출격 준비')}</span><h3>전투 기록 → 정비 → 다음 출격</h3><p>${esc(p.label)}</p>${r?`<dl class="combat-record-metrics"><div><dt>실제 출격 시간 · 격파</dt><dd>${n(r.duration)}초 · ${r.kills}척</dd></div><div><dt>누적 선체 / 실드 손실</dt><dd>${n(r.hull)} / ${n(r.shield)}</dd></div><div><dt>선단 전투불능 / 요격</dt><dd>${r.fleetDisabled}회 / ${r.intercepts}발</dd></div><div><dt>실제 지원 수복 · 선체 / 실드 / 선단</dt><dd>${n(r.supportHull)} / ${n(r.supportShield)} / ${n(r.supportFleet)}</dd></div>${bosses}</dl>`:''}<p>아래 세 투자 카드는 ${esc(next.name)}의 현재 상성과 장비로 계산합니다. 수리로 손상을 복원한 뒤 강화는 필요한 항목만 개별 확인하세요.</p><small>최근 완료 출격 1개만 보관 · 7일 또는 이후 정산 3회 경과 시 기본 안내. 누적 손실에는 회복 후 재피격이 포함됩니다. 전투 시간은 보스 처치 시간이 아닙니다. 전투 중 임시 성장·스킬 효과가 포함되어 다음 출격의 초기 성능과 다를 수 있습니다.</small></section>`;
}
