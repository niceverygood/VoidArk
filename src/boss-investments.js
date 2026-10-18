import {sortieAdvice} from './sortie-advice.js';
import {UPGRADE_DEFS} from './sim.js';
import {BOSS_DOCTRINES,configureAndromedaBoss} from './andromeda-boss.js';
import {preparationBudget} from './campaign-economy.js';
import {fleetUpgradeCost,FLEET_UPGRADES} from './fleet-upgrades.js';
import {FLEET_ROLES,FLEET_TIERS} from './fleet.js';
import {cleanSpaceBase,SOLAR_FOUNDATION_COST,solarFacilityCost,FLEET_BUILD_COST,persistCampaignShip} from './space-bases.js';
import {jupiterPlan} from './jupiter-preparation.js';
import {growthOptions} from './late-growth.js';
import {campaignCommanderStats} from './solar-campaign.js';

// Private disposable simulation: purchases and combat probes never touch live saves,
// recorders, world state, DOM, renderers or sound.
export function investmentSandbox(sim){
 const s=Object.assign(Object.create(Object.getPrototypeOf(sim)),sim);
 // main.js adds instance wrappers bound to the live simulation. Never copy those
 // into a probe: use the prototype rules with the private receiver instead.
 for(const key of Object.keys(s))if(typeof s[key]==='function')delete s[key];
 for(const key of ['meta','player','upgrades','tech','infrastructure','solar','vessel','fleet','allies','skillTimers','weaponTimers'])if(sim[key]!==undefined)s[key]=structuredClone(sim[key]);
 s.events=[];s.enemies=[];s.shots=[];s.pickups=[];s.hazards=[];s.choices=[];s.battleRecorder=null;s.sortieRecorder=null;s.random=()=>.999999;s.emit=(type,data={})=>s.events.push({type,...data});
 return s;
}
const maxed=(sim,id)=>sim.upgrades[id]>=UPGRADE_DEFS.find(d=>d.id===id).maxLevel;
const metric=(label,before,after,unit='')=>({label,before,after,unit});
const money=s=>s.scrap+s.meta.bank;
const funded=s=>{s.meta.bank=1e8;s.scrap=0;return s;};
const instantAttack={
 chain:'즉시 연쇄 방전: 가까운 적을 차례로 타격합니다. 투사체가 날아가지 않으며, 피해는 방전 순간 적용됩니다.',
 laser:'직선 관통 빔: 빔 경로 안의 적을 함께 타격합니다. 투사체가 날아가지 않으며, 피해는 빔을 쏘는 순간 적용됩니다.'
};

// Obtain damage and interval from the actual firing/damage methods, rather than
// a second implementation of combat math. Head-on, no crit/overcharge/tail bonus.
export function bossWeaponSample(sim,id,stage,exposed=false){
 const s=investmentSandbox(sim);s.phase='playing';s.player.overcharge=0;s.player.heading=0;
 const boss={...campaignCommanderStats(stage),id:991,kind:'boss',position:{x:s.player.position.x,y:s.player.position.y,z:s.player.position.z-20},heading:Math.PI,hp:1e9};
 if(stage.system){configureAndromedaBoss(boss,stage);if(exposed)boss.tactics.exposed=1;}
 s.enemies=[boss];for(const key in s.weaponTimers)s.weaponTimers[key]=Infinity;s.weaponTimers[id]=0;
 const guard=boss.tactics?.guard||0;s.updateWeapons(0);
 const shots=s.shots.filter(q=>q.type===id);if(shots[0])s.damageEnemy(boss,shots[0].damage,id);
 const hit=s.events.find(e=>e.type==='hit'&&e.source===id);
 return {damage:hit?.damage||0,guard:guard-(boss.tactics?.guard||0),interval:Number.isFinite(s.weaponTimers[id])?s.weaponTimers[id]:0,projectiles:shots.length};
}
function gearQuote(sim,id,category,reason,stage){
 const after=funded(investmentSandbox(sim)),complete=maxed(sim,id),cost=complete?0:sim.equipmentCost(id);
 if(!complete)after.installEquipment(id);
 let metrics,sampleSource=id,attackMethod='';
 if(category==='weapon'){
  const source=id==='reactor'?(stage.system?.id==='veil'?'chain':stage.system?.id==='crown'?'cannon':'missile'):id;
  sampleSource=source;
  attackMethod=instantAttack[source]||'';
  if(attackMethod&&id==='reactor')attackMethod=`보유 ${UPGRADE_DEFS.find(d=>d.id===source).name} 기준. `+attackMethod;
  const a=bossWeaponSample(sim,source,stage),b=bossWeaponSample(after,source,stage);
  metrics=[metric('보스 단발 피해',a.damage,b.damage),metric('발사 간격',a.interval,b.interval,'초')];
  if(stage.system){metrics.push(metric('장치 단발 피해',a.guard,b.guard));metrics.push(metric('코어 노출 피해',bossWeaponSample(sim,source,stage,true).damage,bossWeaponSample(after,source,stage,true).damage));}
  if(attackMethod)metrics[1].label='공격 간격';
  else metrics.push(metric('발사당 실투사체',a.projectiles,b.projectiles,'발'));
  if(id==='reactor')reason='대응 무장은 이미 최대입니다. 반응로로 보유 무장의 화력을 높여 코어 노출 때 집중 공격을 강화하세요. 장치 단발 피해가 상한에 도달했다면 이 강화로 장치 파괴 속도는 늘지 않습니다.';
  else if(stage.system&&b.guard<=a.guard+1e-8&&a.guard>0)reason='이 무장은 장치 단발 피해 상한에 도달했습니다. 이번 강화는 코어 노출 화력·발사 주기를 비교해 선택하세요. 단발 장치 피해는 늘지 않으며 실제 파괴 시간은 적중 수와 보스 충전 차단에 따라 달라집니다.';
 }else metrics=[metric('최대 선체',sim.player.maxHp,after.player.maxHp),metric('최대 실드',sim.player.maxShield,after.player.maxShield),metric('스킬 대기 배율',sim.cooldownFactor(),after.cooldownFactor(),'×')];
 return {category,id,kind:'gear',name:UPGRADE_DEFS.find(d=>d.id===id).name,cost,complete,reason,metrics,attackMethod,art:id==='chain'?'module-reactor':id==='reactor'?'module-reactor':`module-${id}`,steps:[],level:sim.upgrades[id],afterLevel:after.upgrades[id],load:category==='weapon'?(id==='reactor'?`보유 ${UPGRADE_DEFS.find(d=>d.id===sampleSource).name} 기준. `:'')+'총독(최종보스) 기준 · 단발 표본 · 정면 적중 · 치명타/꼬리잡기/스킬 버프 제외. 다중 적중 이펙트 비용은 적 밀도에 따라 증가합니다.':'용량 강화는 피격량을 줄이는 장갑 피해 감소가 아닙니다. 버틸 여유를 늘리며 처치 시간 단축을 보장하지 않습니다. 보스 조준선은 Z/C·상하 기동으로 피하세요.'};
}
function fleetMetrics(s,a,other,b){
 const x=a.configuration,y=b.configuration;
 const incoming=(sim,slot)=>{const p=investmentSandbox(sim),ship=p.fleet.find(a=>a.slot===slot);p.fleetCommand='guard';ship.hp=ship.maxHp;const hp=ship.hp;p.damageFleet(ship,100,'laser');return hp-ship.hp;};
 const rows=[metric('해당 함선 최대 선체',a.maxHp,b.maxHp),metric('장갑 피해 감소',x.resistance*100,y.resistance*100,'%'),metric('주포 100 피해 · 엄호',incoming(s,a.slot),incoming(other,b.slot))];
 if(a.role==='interceptor')rows.push(metric('요격 반경',x.interceptRange,y.interceptRange,'m'));
 if(a.role==='support')rows.push(metric('수복 지원 배율',x.support,y.support,'×'));
 return rows;
}
function buildSteps(sim,role){
 const b=cleanSpaceBase(sim.meta.spaceBase),steps=[];
 if(!b.sunBuilt)steps.push({id:'foundation',name:'태양 기지',cost:SOLAR_FOUNDATION_COST});
 if(!b.facilities.command)steps.push({id:'command',name:'사령부 1단계',cost:solarFacilityCost(sim.meta,'command')});
 if(!b.facilities.shipyard)steps.push({id:'shipyard',name:'조선소 1단계',cost:solarFacilityCost(sim.meta,'shipyard')});
 steps.push({id:role,name:FLEET_ROLES[role].name,cost:FLEET_BUILD_COST[role],fleet:true});return steps;
}
function execute(sim,q){
 if(q.complete||q.locked||money(sim)<q.cost)return false;
 if(q.kind==='gear')return sim.installEquipment(q.id);
 if(q.kind==='fleet'){
  if(!sim.openCarrier())return false;const ok=sim.upgradeFleet(String(q.slot),q.id);sim.closeCarrier();if(ok)persistCampaignShip(sim);return ok;
 }
 if(q.kind==='build'){
  if(sim.campaignDock!=='sun'){sim.bankMinerals();if(!sim.openCampaignBase('sun'))return false;}
  for(const step of q.steps)if(!(step.fleet?sim.buildFleetShip(step.id):sim.buildSolar(step.id)))return false;
  persistCampaignShip(sim);return true;
 }
 return false;
}
function escortQuote(sim,stage){
 const doctrine=stage.system?.id,role=doctrine==='crown'?'interceptor':doctrine==='veil'?'support':'frigate';
 const reason=doctrine==='crown'?'추적 유도탄 전술에는 엄호 명령의 요격함이 탄환을 끊습니다. 요격 거리를 늘려 진입 시간을 확보하세요.':doctrine==='veil'?'주포·중력 봉쇄는 먼저 회피하고, 수복 지원함으로 교전 사이 선체와 선단을 복원하세요.':doctrine==='forge'?'고위력 주포가 선단도 타격합니다. 장갑으로 호위 손실을 줄이되 조준선은 편대 기동으로 피하세요.':'항모 호위전에서는 엄호로 편대를 유지하고, 호위 손실을 줄여 요새·총독까지 화력을 유지하세요.';
 const preferred=sim.fleet.slice().sort((a,b)=>(a.role===role?-1:0)-(b.role===role?-1:0)||a.slot-b.slot);
 for(const ship of preferred){
  const priority=ship.role==='interceptor'?['special','armor','engine','weapon']:ship.role==='support'?['special','armor','engine','weapon']:['armor','engine','weapon','special'];
  const id=priority.find(k=>ship.upgrades[k]<3);if(!id)continue;
  const effectReason=ship.role==='interceptor'&&id==='special'?'이 요격함의 엄호 요격 반경을 넓혀 추적탄을 끊습니다.':ship.role==='support'&&id==='special'?'이 지원함의 실제 선체·선단 수복 배율을 높입니다.':id==='armor'?'이 호위함의 내구도와 피해 감소를 올려 편대 생존을 보완합니다.':id==='engine'?'이 함선의 추종·복귀 속도를 높여 편대 유지와 재합류를 돕습니다.':id==='weapon'?'이 함선의 공격력을 올려 호위 적을 빨리 정리합니다.':'이 함선의 사거리와 역할 장비를 강화합니다.';
  const q={category:'escort',kind:'fleet',id,slot:ship.slot,name:`${ship.slot+1}번 ${ship.configuration.name} · ${FLEET_UPGRADES[id].name}`,cost:fleetUpgradeCost(ship.upgrades,id),reason:effectReason+' '+(doctrine==='crown'?'유도탄 추적은 Z/C로 끊고 요격은 요격함에서만 작동합니다.':doctrine?'주포·중력 예고 경로에서 먼저 이탈하세요.':'항모 호위를 정리한 뒤 요새·총독까지 화력을 유지하세요.'),steps:[],art:ship.role==='interceptor'?'skill-sentry':'module-drone',level:ship.upgrades[id],complete:false};
  const after=funded(investmentSandbox(sim));execute(after,q);const b=after.fleet.find(a=>a.slot===ship.slot);
  q.metrics=fleetMetrics(sim,ship,after,b);if(id==='weapon')q.metrics.push(metric('기본 공격력',ship.configuration.damage,b.configuration.damage));if(id==='engine')q.metrics.push(metric('추종 배율',ship.configuration.follow/4,b.configuration.follow/4,'×'));if(id==='special'&&!['support','interceptor'].includes(ship.role))q.metrics.push(metric('무장 사거리',ship.configuration.range,b.configuration.range,'m'));
  q.beforeConfiguration=structuredClone(ship.configuration);q.afterConfiguration=structuredClone(b.configuration);q.afterLevel=b.upgrades[id];q.load='기존 1척 개조 · 함선 수 증가 없음. 요격 반경은 탄환 경로가 통과할 때, 수복은 선체가 손상됐을 때 효과가 있습니다. 엄호 요격은 요격함만, 수복은 지원함만 수행합니다.';if(ship.hp<=0)q.load+=' 현재 전투불능: 아래 추진·선단 정비로 복구하세요. 개조만으로 즉시 부활하지 않습니다.';return q;
 }
 if(sim.fleet.length)return {category:'escort',kind:'complete',id:'escort',name:'선단 개조 최대',cost:0,complete:true,reason:'현재 편대 개조가 모두 완료됐습니다. 요격함은 엄호, 지원함은 재집결 명령으로 역할을 활용하고 보스 예고 경로에서 이탈하세요.',steps:[],metrics:[metric('선단 규모',sim.fleet.length,sim.fleet.length,'척')],load:'전 함선 4계열 최대 단계. 엄호·재집결 명령과 함종 재설계로 대응하세요.',art:'module-drone'};
 const steps=buildSteps(sim,role),locked=!sim.meta.campaign?.systemOwned,q={category:'escort',kind:'build',id:'escort',role,name:`첫 ${FLEET_ROLES[role].name} 건조`,cost:steps.reduce((n,d)=>n+d.cost,0),complete:false,locked,reason,steps,art:role==='interceptor'?'skill-sentry':'module-drone'};
 // A locked goal shows actual configuration, not a fictitious current escort.
 const after=funded(investmentSandbox(sim));after.meta.campaign={...after.meta.campaign,cleared:8,systemOwned:true};execute(after,{...q,locked:false});const built=after.fleet[0],b=built.configuration;q.afterConfiguration=structuredClone(b);q.metrics=[metric('선단 규모',0,1,'척'),metric('새 함선 최대 선체',0,built.maxHp),metric(role==='interceptor'?'요격 반경':role==='support'?'수복 지원 배율':'기본 공격력',0,role==='interceptor'?b.interceptRange:role==='support'?b.support:b.damage,role==='interceptor'?'m':role==='support'?'×':'')];
 const next=FLEET_TIERS.find(t=>t.count>0);q.load=locked?`태양계 8/8 점령 후 자원 건조 해금. 지금은 전투 LV.${next.level}에서 ${next.count}척 무료 호위 해금이 대안입니다. 건조 견적은 미래 목표이며 현재 구매 불가.`:'선행 시설은 보유분을 제외해 한 번만 합산합니다. 새 함선 1척이 추가되어 추종·사격·요격/수복 처리 비용이 늘어납니다.';return q;
}
export function bossInvestmentReport(sim,state){
 if(!sim.campaignDock)return null;
 const stage=state.next,doctrine=stage.system?BOSS_DOCTRINES[stage.system.id]:null;
 const preferred=doctrine?.weak.filter(id=>['cannon','missile','laser','chain'].includes(id))||['missile','laser'];
 const available=preferred.filter(id=>!maxed(sim,id)).sort((a,b)=>(sim.upgrades[b]>0?1:0)-(sim.upgrades[a]>0?1:0)||sim.equipmentCost(a)-sim.equipmentCost(b));
 const weapon=available[0]||(!maxed(sim,'reactor')?'reactor':preferred[0]);
 const weaponReason=doctrine?`${doctrine.name}: ${doctrine.counter}. 대응 무기는 장치 피해가 더 커 코어 노출을 앞당깁니다. 노출 4.5초에 집중 공격하세요.`:'중장갑 총독과 요새에 유도탄·관통포가 유리합니다. 수복함 → 방패 호위 → 항모 순으로 접근해 방호를 끊으세요.';
 const survivor=(stage.system?.id==='veil'?['shield','armor','reactor']:['armor','shield','reactor']).find(id=>!maxed(sim,id))||'armor';
 const survivalReason=stage.system?.id==='crown'?'유도탄 추격은 Z/C로 추적을 끊고 1 펄스로 충전을 차단하세요. 용량 강화로 피격 여유를 확보합니다.':stage.system?'주포 조준·중력 봉쇄는 1.15~1.5초 예고 후 발동합니다. 용량을 보완하고 Z/C·Q/E로 예고 경로에서 벗어나세요.':'사방의 호위 사격과 총독 접촉 피해에 대비해 선체·실드 여유를 확보하세요. 수리는 현재 손상 복원이고 강화는 최대 용량 증가입니다.';
 const rows=[gearQuote(sim,weapon,'weapon',weaponReason,stage),gearQuote(sim,survivor,'survival',survivalReason,stage),escortQuote(sim,stage)];
 if(survivor==='reactor')rows[1].reason=sim.cooldownFactor()<=.45?'선체·실드 장비는 이미 최대 단계입니다. 스킬 대기 배율은 최소치 0.45×에 도달해 이번 반응로 강화로 더 줄지 않습니다. 보유 무장 화력 강화를 비교해 선택하고, 1 펄스 충전 차단과 Z/C 회피를 활용하세요.':'선체·실드 장비는 이미 최대 단계입니다. 반응로로 1 펄스 등 스킬 재사용 대기를 줄여 충전 차단 기회를 늘리세요. Z/C 회피 대기는 이 강화로 줄지 않습니다.';
 if(weapon===survivor)rows[1].reason+=' 대응 무기와 같은 반응로입니다. 한 번 강화하면 두 효과가 함께 반영되며 두 항목을 별도로 구매할 필요는 없습니다.';
 const advice=sortieAdvice(sim.meta,stage);for(const q of rows)q.evidence=advice.reasons[q.category]||'';
 const balance=money(sim),reserve=preparationBudget(sim).reserve;
 for(const q of rows)q.verb=q.kind==='build'?'건조':q.kind==='fleet'?'개조':q.kind==='gear'&&q.level===0?'설치':'강화';
 for(const q of rows){q.key=q.category;q.balance=balance;q.reserve=reserve;q.total=q.cost+reserve;q.shortfall=Math.max(0,q.total-balance);q.affordable=!q.complete&&!q.locked&&balance>=q.cost;q.repairSafe=balance>=q.total;q.state=q.complete?'최대 강화 · 유지':q.locked?'점령 조건 미충족':!q.affordable?'강화 자원 부족':!q.repairSafe?'강화 가능 · 정비비 부족':'정비 확보 후 실행 가능';q.token=JSON.stringify([stage.id,q.kind,q.id,q.slot,q.cost,q.level,q.metrics,q.steps]);if(q.complete){if(q.category==='weapon')q.reason='대응 무장은 이미 최대 단계입니다. 보유 무장의 현재 화력과 공격 간격을 확인하고 보스 예고 뒤 공격 기회를 활용하세요.';else if(q.category==='survival')q.reason='생존 장비는 이미 최대 단계입니다. 현재 선체·실드 용량과 스킬 대기 배율을 확인하고 보스 예고 경로를 피하세요.';q.reason+=' 추가 구매 대신 보유 장비·1 펄스 충전 차단·Z/C 회피를 활용하세요.';}}
 for(const q of rows)if(!q.affordable&&!q.complete&&!q.locked)q.load+=' 지금은 보유 무장으로 출격해 무료 전투 레벨업과 점령 보상을 회수하세요. 수리·충전은 아래 정비 메뉴에서 개별 검토할 수 있습니다.';
 return {advice,stage:stage.name,doctrine:doctrine?.name||'중장갑 총독 · 항모 호위',rows,balance,reserve,growth:jupiterPlan(sim),longGrowth:growthOptions(sim)};
}
// Re-quote at confirmation time and validate the complete sequence in isolation.
export function applyBossInvestment(sim,state,key,expectedToken=null){
 if(sim.phase!=='base')return false;const q=bossInvestmentReport(sim,state)?.rows.find(q=>q.key===key);
 if(!q?.affordable||expectedToken!==null&&q.token!==expectedToken)return false;const probe=investmentSandbox(sim);if(!execute(probe,q))return false;
 return execute(sim,q);
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2});
export function bossInvestmentsMarkup(sim,state){
 const p=bossInvestmentReport(sim,state);if(!p)return '';
 return `<section class="starter-loadouts boss-investments"><span class="eyebrow">${esc(p.stage)} · ${esc(p.doctrine)}</span><h3>이번 보스를 위한 투자 3가지</h3><p>정비 확보 ${n(p.reserve)} · 현재 자원 ${n(p.balance)}. 한 가지를 비교·확인해 적용하세요. 출격은 강화 없이도 가능합니다.</p><div class="loadout-grid">${p.rows.map(q=>`<article class="loadout-card" data-investment-card="${q.key}" ${sim.preferredInvestment===q.key?'aria-label="결과 화면에서 선택한 검토 항목"':''}><div class="loadout-title"><img src="/assets/meshy/${q.art}.png" width="56" height="56" alt=""><h4>${{weapon:'대응 무기',survival:'생존',escort:'선단 엄호'}[q.key]}</h4></div><strong>${esc(q.name)}</strong>${q.level!==undefined?`<small>현재 Lv.${q.level} → ${q.complete?'최대 단계':'Lv.'+q.afterLevel}</small>`:''}<p>${esc(q.reason)}</p>${q.evidence?`<p class="investment-evidence"><strong>직전 출격 참고</strong><br>${esc(q.evidence)}</p>`:''}${q.attackMethod?`<p class="investment-attack">${esc(q.attackMethod)}</p>`:''}<dl class="investment-metrics">${q.metrics.map(m=>`<div><dt>${esc(m.label)}</dt><dd>${n(m.before)} → ${n(m.after)}${esc(m.unit)}</dd></div>`).join('')}</dl>${q.steps.length?`<small>선행비 포함: ${q.steps.map(d=>`${esc(d.name)} ${n(d.cost)}`).join(' + ')} = ${n(q.cost)}</small>`:''}<p class="investment-budget">${q.verb} ${n(q.cost)} + 정비 ${n(q.reserve)} = 총 ${n(q.total)}<br>보유 ${n(q.balance)} · 부족 ${n(q.shortfall)} 아르켈륨<br>${esc(q.state)}</p><small>${esc(q.load)}</small><div class="loadout-actions"><button class="primary-button" data-boss-investment="${q.key}" data-confirm-verb="${q.verb}" data-confirm-name="${esc(q.name)}" data-confirm-cost="${q.cost}" data-confirm-effect="${esc([q.attackMethod,...q.metrics.map(m=>`${m.label} ${n(m.before)} → ${n(m.after)}${m.unit}`)].filter(Boolean).join(' · '))}${q.repairSafe?'':esc(' · 정비 포함 부족액 '+n(q.shortfall))}" ${q.affordable?'':'disabled'}>${q.complete?'현재 최대 단계':q.locked?'태양계 통일 후 건조':!q.affordable?'자원 부족':`${n(q.cost)} 아르켈륨 · ${q.verb} 확인`}</button></div></article>`).join('')}</div><details class="investment-growth" ${state.chapter==='solar'&&state.index===3?'open':''}><summary>장기 목표 · ${sim.meta.campaign?.systemOwned?'태양 기지·기함·선단 → 안드로메다':'태양계 '+(sim.meta.campaign?.cleared||0)+'/8 → 기함·선단'}</summary><p>전투 레벨 호위 해금은 무료입니다. 다음 단계 ${p.growth.next?`LV.${p.growth.next.level} · ${p.growth.next.count}척`: '최대 10척'}. ${sim.meta.campaign?.systemOwned?p.longGrowth.options.map(q=>`${esc(q.name)}: ${q.complete?'완료':'남은 총비용 '+n(q.cost)+' · 정비 확보 후 부족 '+n(q.shortfall)}`).join(' / '):`${esc(p.growth.capital)} 시설·제작비 ${n(p.growth.capitalTotal)}, 첫 호위함 시설·건조비 ${n(p.growth.fleetTotal)} 아르켈륨.`} 보유 시설은 중복 계산하지 않습니다.${state.chapter==='solar'&&state.index===3?` 기함과 첫 호위함을 함께 준비하면 남은 총비용 ${n(p.growth.capitalTotal+p.growth.frigate)}, 정비 확보 후 부족 ${n(Math.max(0,p.growth.capitalTotal+p.growth.frigate-Math.max(0,p.balance-p.reserve)))} 아르켈륨입니다.`:''} 개별 개조·향후 정비는 별도입니다. 태양계 통일 뒤 안드로메다 출격은 무료이며 기함 제작은 선택입니다.</p><button class="secondary-button" data-base-section="facilities">기지·기함 성장 검토</button></details></section>`;
}
