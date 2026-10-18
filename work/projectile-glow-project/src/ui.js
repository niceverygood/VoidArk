import {bossInvestmentReport} from './boss-investments.js';
import {hullDisplayName} from './ship-growth.js';
import {debriefMarkup,expeditionTarget} from './campaign-debrief.js';
import {STARTER_LOADOUTS} from './starter-loadouts.js';
import {basePreparationMarkup,preparationState} from './base-preparation.js';
import {hullAsset} from './asset-library.js';
import {confirmBaseUpgrade} from './upgrade-confirm.js';
import {createSolarPurchase,solarFleetConstructionGuide} from './solar-purchase.js';
import {createFleetRefit} from './fleet-refit.js';
import {installSkillArt,UPGRADE_ART,skillArtDiagnostics,retainSkillArtRenderer} from './skill-art.js';
import {renderSolarCommand} from './solar-command-map.js';
import {ANDROMEDA_STAGES,ANDROMEDA_SYSTEMS} from './andromeda-campaign.js';
import {SOLAR_FACILITIES,SOLAR_CAPITALS,SOLAR_FOUNDATION_COST,FLEET_BUILD_COST,fleetRefitCost,fleetRefitLock,solarFacilityLock,solarFacilityCost,solarStats} from './space-bases.js';
import {FLEET_ROLES} from './fleet.js';
import {renderSpaceBase} from './solar-base-visuals.js';
import {SOLAR_STAGES,cleanCampaign} from './solar-campaign.js';
import {renderSolarRoute,renderAndromedaRoute} from './solar-visuals.js';
import {navigationPlan} from './navigation.js';
import {CIVILIZATIONS,civilizationForOwner,civilizationForPlanet,diplomaticRelation} from './civilizations.js';
import {renderMineralPreview} from './mineral-preview.js';
import {GOODS,MINERALS} from './economy.js';
import {DEFENSES,defenseCost} from './defenses.js';
import {ARMORS,WEAPONS,MATCHUPS,shipArmor,fleetArmor,planetArmor,armorAdvice,relationsFor} from './combat-relations.js';
import {ENEMY_OFFICERS,CAPTAIN_ATTRIBUTES} from './enemy-captains.js';
import {FLEET_UPGRADES,fleetUpgradeCost} from './fleet-upgrades.js';
import {GALAXIES,galaxyDefinition} from './galaxies.js';
import {SHIPS, SHIP_FAMILIES, shipDefinition} from './ships.js';
import {REGIONS, FACTIONS, CHRONICLE, regionFor, planetLore} from './universe.js';
import { PLANETS, TOTAL_BASES, basesDestroyed, regionProgress, occupied, galaxyProgress } from './galaxy.js';
import { renderGalaxyMap, renderGalaxyNetwork } from './galaxy-visuals.js';
import { BASE_FACILITIES, cleanBase, constructionCost, constructionLock } from './base-tech.js';
import { UPGRADE_DEFS, BASE_POSITION, dist } from './sim.js';
import { createTacticalMap } from './tactical-map.js';
import { createBattleRadarDisplay } from './battle-radar-display.js';
import {renderShipPreview} from './ship-preview.js';
import { TREE_BRANCHES, TREE_NODES, RESEARCH_VISUALS, treeStats, treePrerequisites, treeLocked, cleanTree } from './skill-tree.js';
import { SECTOR_DEFS } from './sectors.js';
const ICONS = {
  pulse: '<circle cx="12" cy="12" r="3"/><path d="M7 12a5 5 0 0 1 5-5m5 5a5 5 0 0 1-5 5M4 12a8 8 0 0 1 8-8m8 8a8 8 0 0 1-8 8"/>',
  missile: '<path d="m8 16 8-8m-9 5-3 1 3 3 3-1m0-9 1-3 6-2-2 6-3 1m-4 9-2 2"/><path d="m12 7 5 5"/>',
  overdrive: '<path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  hull: '<path d="m12 3 7 7-2 10H7L5 10l7-7Z"/><path d="M9 13h6m-3-6v13"/>',
  reactor: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',
  salvage: '<path d="m4 8 8-5 8 5v9l-8 4-8-4V8Z"/><path d="m4 8 8 5 8-5m-8 5v8m-4-16 8 5"/>',
  weapon: '<path d="m5 19 4-4m1-6 5-5 5 5-5 5-5-5Zm0 0-4 4 5 5 4-4M16 5l3-3m-1 5 3-3"/>',
  drone: '<path d="m12 4 4 8-4 8-4-8 4-8ZM4 8l4 4-4 4V8Zm16 0-4 4 4 4V8Z"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4V9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M4 9h4l5-4v14l-5-4H4V9Zm13 0 5 6m0-6-5 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 3m0 2v1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  ship: '<path d="m12 2 4 9 5 6-7-2-2 7-2-7-7 2 5-6 4-9Z"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.weapon}</svg>`;
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, Number(v) || 0));
const formatTime = (t = 0) => `${Math.floor(Math.max(0, t) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, t) % 60).toString().padStart(2, '0')}`;
const num = (v) => Math.round(Number(v) || 0).toLocaleString('ko-KR');
const normalizedSkill = (id) => /pulse|emp|펄스|chain/i.test(id) ? 'pulse' : /missile|미사일|rocket|barrage/i.test(id) ? 'missile' : /over|과충전/i.test(id) ? 'overdrive' : /fighter/i.test(id) ? 'drone' : /armor/i.test(id) ? 'hull' : /magnet/i.test(id) ? 'salvage' : id;
const SECTOR_NAMES = SECTOR_DEFS.map(s=>s.name);
const SECTOR_DESCRIPTIONS = SECTOR_DEFS.map(s=>s.description);

function defensePanel(sim,target){return `<section class="defense-build"><h3>궤도 방어 건설</h3><p>전투 + 보관 아르켈륨 ${Math.floor(sim.scrap+sim.meta.bank)} · 시설은 자동 교전하며 영구 저장됩니다.</p><div class="base-equipment">${DEFENSES.map(d=>{const lv=sim.meta.defenses?.[target]?.[d.id]||0,cost=defenseCost(sim.meta.defenses,target,d.id);return `<article><strong>${d.name}</strong><span>단계 ${lv} / 3</span><p>${d.description}</p><button class="secondary-button" data-defense-type="${d.id}" data-defense-target="${target}" ${lv>=3||sim.scrap+sim.meta.bank<cost?'disabled':''}>${lv>=3?'최대 강화':cost+' 아르켈륨 · '+(lv?'강화':'건설')}</button></article>`;}).join('')}</div></section>`;}

function solarBasePanel(sim){
 const b=sim.meta.spaceBase,f=b.facilities,money=sim.scrap+sim.meta.bank,construction=solarFleetConstructionGuide(sim),capacity=construction.capacity,activeCapital=solarStats(sim.meta).capital?.id;
 if(!b.sunBuilt)return '<section class="solar-base-construction"><span class="eyebrow">SOLAR THRONE / FOUNDATION</span><h3>태양 궤도 성채 건설</h3><p>태양계의 점령 자원을 모아 대형 조선소와 원정 함대의 중심 기지를 건설합니다.</p><button class="primary-button" data-solar-build="foundation" '+(money<SOLAR_FOUNDATION_COST?'disabled':'')+'>' + SOLAR_FOUNDATION_COST + ' 아르켈륨 · 태양 기지 건설</button></section>';
 return '<section class="solar-base-construction"><span class="eyebrow">STELLAR INDUSTRY / PERMANENT</span><h3>태양 기지 시설 · 항성 공업</h3><div class="base-equipment">'+SOLAR_FACILITIES.map(d=>{const lv=f[d.id],cost=solarFacilityCost(sim.meta,d.id),lock=solarFacilityLock(sim.meta,d.id);return '<article><strong>'+d.name+'</strong><span>단계 '+lv+' / 3</span><p>'+d.description+'</p><button class="secondary-button" data-solar-build="'+d.id+'" '+(lock||money<cost?'disabled':'')+'>'+(lock||cost+' 아르켈륨 · '+(lv?'증축':'건설'))+'</button></article>';}).join('')+'</div><h3>항성 기함 제작 · 외형과 성능 진화</h3><div class="capital-projects">'+SOLAR_CAPITALS.map(d=>{const owned=b.owned.includes(d.id),lock=f.shipyard<d.rank;return '<article><span class="eyebrow">CAPITAL CLASS / 0'+d.rank+'</span><h3>'+d.name+'</h3><p>'+d.description+'</p><small>기본 함체 + 영구 장비 + 항성 시설 + 전용 함체/모듈</small><button class="primary-button" '+(owned?'data-capital-select':'data-capital-build')+'="'+d.id+'" '+((owned&&activeCapital===d.id)||lock||(!owned&&money<d.cost)?'disabled':'')+'>'+(owned?(activeCapital===d.id?'현재 지휘 기함':'이 기함으로 변경'):lock?'대형 조선소 '+d.rank+'단계 필요':d.cost+' 아르켈륨 · 제작')+'</button></article>';}).join('')+'</div><h3>원정 함대 건조 · 현재 '+sim.fleet.length+'척</h3><p>추가 건조 한도 '+capacity+'척 · 새 함선을 추가하려면 한도가 현재 선단 수보다 커야 합니다. 기존 선단은 유지됩니다.</p><p>직접 함종을 선택해 편대를 증설하세요. 모든 함선의 무장·장갑·엔진·특수 시스템은 개별 영구 개조가 가능합니다.</p><div class="base-equipment">'+Object.entries(FLEET_BUILD_COST).map(([role,cost])=>'<article><strong>'+FLEET_ROLES[role].name+'</strong><p>기본 선체 '+FLEET_ROLES[role].hp+' · 기본 화력 '+FLEET_ROLES[role].damage+' · '+({frigate:'기관포 엄호',support:'아군 선체·실드 수복',destroyer:'유도탄 포격',interceptor:'적 탄환 요격',cruiser:'중장 레이저 관통'}[role])+'</p><button class="secondary-button" data-fleet-build="'+role+'" '+(!f.shipyard||sim.fleet.length>=capacity||money<cost?'disabled':'')+'>'+(construction.reason||cost+' 아르켈륨 · 건조')+'</button></article>').join('')+'</div><button class="primary-button" data-action="carrier" '+(!sim.fleet.length?'disabled':'')+'>선단 격납고 · 함선별 4계열 개조 / 실제 3D 외형 확인</button></section>';
}

export function createUI(actions = {}) {
  const mount = document.querySelector('#ui') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'ui' }));
  let soundEnabled = true;
  let lastUpdate = -Infinity;
  let lastSnapshot = null;
  let modalKind = '';
  let modalData = null;
  let currentMeta = { bank: 0, bestKills: 0, wins: 0, runs: 0, research: {} };
  let announceTimer = 0;
  let toastId = 0;
  let upgradeSim=null,selectedUpgrade=null;let currentCarrierSim=null;let currentBaseSim=null,selectedLoadout=null,disposeConfirmation=null;let disposeUpgradeArt=null;let disposeSkillArt=null,disposeBattleArt=null;let quality = 'high';let disposeGalaxyMap=null,disposeShipPreview=null,treeFilter='all';
  const values = new Map();
  mount.innerHTML = `
    <div class="game-hud" aria-label="비행 계기판">
      <div class="hud-top-left">
        <div class="tiny-brand"><span class="brand-symbol">${icon('ship')}</span><strong>VOID ARK</strong><span class="brand-divide"></span><span>잔해의 방주</span></div>
        <div class="mission-chip"><span class="status-dot"></span><span data-hud="objective">함선을 성장시키고 6분간 생존하세요</span></div>
        <div class="ship-stage"><span class="stage-index" data-hud="stage">01</span><div><span class="eyebrow">VESSEL CLASS</span><strong data-hud="stageName">정찰선</strong></div><span class="stage-progress" data-hud="stageProgress">LV. 1</span></div>
        <div class="weapon-list" data-hud="weapons"></div>
      </div>
      <div class="boundary-alert" role="status" hidden><strong data-hud="boundaryTitle"></strong><span data-hud="boundaryDetail"></span></div>
      <div class="vitals" aria-label="내 함선 선체와 실드">
        <div class="vital-label"><span>선체</span><span><b data-hud="hp">100</b><em> / </em><span data-hud="maxHp">100</span></span></div>
        <div class="meter hull-meter"><div data-hud="hpFill"></div></div>
        <div class="shield-line"><span>${icon('shield')} 실드</span><div class="meter shield-meter"><div data-hud="shieldFill"></div></div><b data-hud="shield">50</b></div>
      </div>
      <div class="hud-top-right">
        <div class="hud-controls"><button class="icon-button" data-action="market" title="광물 거래소 · J" aria-label="광물 거래소">◆</button><button class="icon-button" data-action="help" title="조작 안내" aria-label="조작 안내">${icon('help')}</button><button class="icon-button sound-button" data-action="sound" title="음향 켜기 / 끄기" aria-label="음향 켜기 / 끄기">${icon('sound')}</button><button class="icon-button" data-action="pause" title="일시정지 · Esc" aria-label="일시정지">${icon('pause')}</button></div>
        <div class="run-clock"><span class="eyebrow">생존 시간</span><strong data-hud="time">00:00</strong><small>/ <span data-hud="duration">06:00</span></small></div>
        <div class="resource-console" aria-label="함선 자원"><small class="resource-kicker">ARK / RESOURCES</small><div class="mineral-hud" data-hud="wallet"><div class="wallet-row arkelium"><span>◆ 아르켈륨</span><b data-hud="walletBank">0</b></div><div class="wallet-row helionite"><span>◈ 헬리오나이트</span><b data-hud="walletHelio">0</b></div></div><div class="mining-hint" data-hud="mining"></div><div class="run-stats"><div><span>격파</span><b data-hud="kills">0</b></div><div><span class="scrap-label">${icon('salvage')} 아르켈륨</span><b data-hud="scrap">0</b></div></div></div>

      </div>
        <div class="radar"><div class="radar-heading"><span>3D TACTICAL MAP</span><span class="radar-live">LIVE <i></i></span></div><div class="battle-radar-status"></div><div class="battle-radar-scene"><canvas width="360" height="250" aria-label="보스와 적의 실제 3D 위치를 표시하는 전장 지도"></canvas><div class="battle-radar-labels"></div></div><div class="navigation-guidance" aria-label="목표 항로 안내"></div><div class="radar-footer"><span class="battle-legend"><b style="color:#8bffff">▲ 나</b><b style="color:#ff425e">◆ 적</b><b style="color:#ff914a">◆ 항모</b><b style="color:#ffda68">★ 보스</b><b style="color:#87ffd2">◆ 아군</b></span><span>세로선: 고도 차이 · 화살표: 이동 방향</span></div></div>
      <aside class="raid-alert" aria-label="영토 긴급 통신" aria-live="polite" hidden></aside><div class="cosmic-alert" role="status" hidden></div><div class="boss-hud" aria-label="보스 체력" hidden><div><span class="boss-label">BOSS</span><strong data-hud="bossName">공허의 포식자</strong><b data-hud="bossHp">100%</b></div><div class="meter boss-meter"><div data-hud="bossFill"></div></div><p class="boss-tactic" data-hud="bossTactic" hidden></p><div class="incoming-hint" hidden><span>보스 접근</span><strong data-hud="bossDistance"></strong></div></div>
      <button class="base-entry secondary-button" data-action="enter-base">F · 기지 입항</button>
      <div class="flight-reticle" aria-hidden="true"><i></i><span></span><i></i></div>
      <div class="dogfight-alert" role="status" hidden></div><button class="evade-button secondary-button" data-action="evade"><canvas class="skill-model-art" data-skill-art="evade" aria-hidden="true"></canvas><span class="evade-label">Z / C · 회피 기동</span></button>
      <button class="galaxy-entry secondary-button" data-action="galaxy">G · 은하 지도</button>
      
      <button class="camera-reset" data-action="camera-reset" title="기본 시점 복귀 · Home">Home · 시점 복귀</button><span class="camera-zoom" data-hud="cameraZoom">휠 줌 1.00×</span><div class="hud-bottom-left"><div class="flight-caption"><span class="status-dot"></span><span>자동 조준 · 자동 사격</span></div><div class="move-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동</span><span><kbd>Q</kbd><kbd>E</kbd> 하강 / 상승</span><span class="camera-hint">좌·우 드래그 회전 · 휠 ↑ 확대 / ↓ 축소</span></div><div class="flight-speed"><span>추진 속도</span><b data-hud="speed">0</b><small>m/s</small><div class="boost-meter"><div data-hud="boostFill"></div></div><span class="boost-key"><kbd>SHIFT</kbd> 부스트</span></div></div>
      <aside class="hostile-fleet" hidden></aside><div class="fleet-command" hidden><small class="fleet-console-kicker">ARK / TACTICAL COMMAND</small><span class="fleet-heading"></span><div class="fleet-vessels"></div><div class="fleet-orders"><button data-fleet-command="assault" title="전방 쐐기 편대 · 사격 속도 증가">${icon('missile')}<span>돌격</span></button><button data-fleet-command="guard" title="근접 방어 편대 · 적 탄환 요격">${icon('shield')}<span>엄호</span></button><button data-fleet-command="rally" title="후방 대열 · 수복 가속">${icon('drone')}<span>재집결</span></button></div><button class="carrier-entry" data-action="carrier">B · 기함 격납고 / 개별 함선 강화</button><small class="fleet-next"></small></div><div class="skills" aria-label="함선 스킬"></div>
      <div class="altimeter"><div class="altitude-label"><span>ALT</span><b data-hud="altitude">0</b></div><div class="altitude-track"><i></i><i></i><i></i><i></i><i></i><span data-hud="altitudeMarker"></span></div><span class="altitude-unit">m</span></div>
      <div class="xp-hud"><span class="xp-level">LV. <b data-hud="level">1</b></span><div class="xp-track"><div data-hud="xpFill"></div></div><span class="xp-next"><span data-hud="xp">0</span><em> / </em><span data-hud="xpNeed">10</span><small data-hud="xpCaption">다음 증축</small></span></div>
      <div class="perf-readout"><span data-hud="fps">60</span> FPS <i></i> SECTOR <span data-hud="sector">01</span></div>
    </div>
    <div class="screen-announcement" role="status"><span class="announcement-line"></span><strong></strong><p></p></div>
    <div class="toast-stack" aria-live="polite"></div>
    <div class="modal-root"></div>
    <div class="small-screen-notice">더 넓은 전장이 필요합니다.<br><span>가로 모드 · 1024px 이상 화면을 권장합니다.</span></div>
  `;
  const modal = mount.querySelector('.modal-root');
  const hud = mount.querySelector('.game-hud');
  const radarCanvas = mount.querySelector('.radar canvas');
  const tacticalMap = createTacticalMap(radarCanvas);let navigationTarget=null,currentGalaxySim=null,mapFocus=true;
  const updateRadarDisplay = createBattleRadarDisplay(mount.querySelector('.battle-radar-status'), mount.querySelector('.battle-radar-labels'));
  const hudNodes = Object.fromEntries([...mount.querySelectorAll('[data-hud]')].map((el) => [el.dataset.hud, el]));
  let skillNodes = [...mount.querySelectorAll('.skill-card')];

  function text(name, value) {
    const str = String(value);
    if (values.get(name) === str || !hudNodes[name]) return;
    values.set(name, str);
    hudNodes[name].textContent = str;
  }
  function fill(name, value) {
    const percent = `${(clamp(value) * 100).toFixed(1)}%`;
    if (values.get(name) === percent || !hudNodes[name]) return;
    values.set(name, percent);
    hudNodes[name].style.width = percent;
  }
  function beginBattleArt(){if(disposeBattleArt)return;try{disposeBattleArt=retainSkillArtRenderer();}catch{/* Existing card fallback keeps failed art contexts optional. */}}
  function endBattleArt(){disposeBattleArt?.();disposeBattleArt=null;}
  function show(content, kind, data) {
    disposeUpgradeArt?.();disposeUpgradeArt=null;disposeGalaxyMap?.();disposeGalaxyMap=null;disposeShipPreview?.();disposeShipPreview=null;
    modalKind = kind;
    modalData = data;
    hud.inert = true;
    mount.classList.add('has-modal');
    modal.innerHTML = content;
    modal.style.display = '';
    requestAnimationFrame(() => modal.querySelector('[data-autofocus]')?.focus({ preventScroll: true }));
  }
  function hideModal() {
    disposeUpgradeArt?.();disposeUpgradeArt=null;disposeGalaxyMap?.();disposeGalaxyMap=null;disposeShipPreview?.();disposeShipPreview=null;
    modalKind = '';
    modalData = null;
    hud.inert = false;
    modal.innerHTML = '';
    mount.classList.remove('has-modal');
  }
  function brand() {
    return `<div class="modal-brand"><span>${icon('ship')}</span><strong>VOID ARK</strong><i></i><small>잔해의 방주</small></div>`;
  }
  function sharedNav() {
    return `<div class="menu-nav"><button class="text-button" data-action="help">${icon('help')} 조작 안내</button><button class="text-button sound-button" data-action="sound">${icon(soundEnabled ? 'sound' : 'muted')} ${soundEnabled ? '음향 켜짐' : '음향 꺼짐'}</button></div>`;
  }
  function showMarket(sim){const m=sim.meta,e=m.economy;show(`<section class="market-screen"><header>${brand()}<button class="text-button" data-action="market-close" data-autofocus>거래소 닫기</button></header><h2>성간 광물 거래소</h2><canvas class="mineral-models" aria-label="아르켈륨과 헬리오나이트 실제 3D 광물"></canvas><div class="mineral-wallet"><article class="arkelium"><h3>◆ 아르켈륨 <b>${num(m.bank)}</b></h3><p>${MINERALS.arkelium.story}</p><small>채굴 M · 전리품 · 행성 수익 / 인게임 전용</small></article><article class="helionite"><h3>◆ 헬리오나이트 <b>${num(e.helionite)}</b></h3><p>${MINERALS.helionite.story}</p><small>유료 구매 전용 · 플레이 보상/광물 환전 없음</small></article></div><h3>보급품 & 교역</h3><div class="market-goods">${GOODS.map(g=>`<article><h3>${g.name}</h3><p>${g.description}</p><strong>${g.price} ${MINERALS[g.currency].name}</strong><small>${g.currency==='arkelium'?'보유 '+e.inventory[g.id]:(e.skins.includes(g.id)?(e.activeSkin===g.id?'장착 중':'소유 중'):'미보유')}</small><div class="market-card-actions"><button class="secondary-button" data-market="${g.id}" data-operation="buy" ${(g.currency==='arkelium'?m.bank<g.price||e.inventory[g.id]>=9999:e.helionite<g.price||e.skins.includes(g.id))?'disabled':''}>구매</button>${g.sell?`<button class="text-button" data-market="${g.id}" data-operation="sell" ${e.inventory[g.id]<1?'disabled':''}>판매 +${g.sell} 아르켈륨</button>`:e.skins.includes(g.id)?`<button class="text-button" data-market="${g.id}" data-operation="equip">외형 장착</button>`:''}</div></article>`).join('')}</div><h3>헬리오나이트 충전</h3><p>실제 결제 서비스 준비 중 · 지금은 결제하거나 유료 광물을 지급하지 않습니다.</p><div class="market-packs">${[100,550,1200].map(q=>`<button disabled>◆ ${q} 헬리오나이트<br>충전 준비 중</button>`).join('')}</div><p>거래소를 닫은 뒤 기지·전투에서 V: 수복 키트 / X: 충전 셀 · 기지에서 출격 광물을 금고로 보관하세요.<br>아르켈륨으로 조선소·테크트리·기지·선단 강화 가능. 현재 거래는 조합 NPC와의 매매입니다.</p></section>`,'market',sim);disposeShipPreview=renderMineralPreview(modal.querySelector('.mineral-models'));}
  function showTree(meta=currentMeta) {
    currentMeta=meta;const tree=cleanTree(meta.tree),ship=shipDefinition(meta.ship),capital=solarStats(meta).capital,filters=[['all','전체 기술'],['skills','액티브 스킬'],['combat','무장·전투'],['utility','기동·산업']];
    const groups=TREE_BRANCHES.filter(b=>treeFilter==='all'||(treeFilter==='skills'?['arc','missiles','defense','siege','warfare','support'].includes(b.id):treeFilter==='utility'?['mobility','drive','economy'].includes(b.id):!['mobility','drive','economy'].includes(b.id)));
    show(`<section class="tree-screen"><header class="tree-header">${brand()}<button class="text-button" data-action="menu" data-autofocus>메뉴로 돌아가기</button></header><div class="tree-overview"><div class="tree-intro"><span class="eyebrow">SKILLS & TECHNOLOGY / ${TREE_NODES.length} NODES</span><h2>당신의 방주를 설계하세요.</h2><p>${TREE_BRANCHES.length}개 분기 · 기술 ${TREE_NODES.length}종 · 각 3단계 강화 · 액티브 스킬 최대 9종.<br>선행 기술을 1단계 연구하세요. 새 분기는 두 갈래로 나뉘고, 양쪽 기술을 배우면 최종 기술이 열립니다.<br>연구 즉시 오른쪽 실제 함선 모델에 장착됩니다. 전투 능력은 다음 출격부터 적용됩니다.</p><strong>보유 아르켈륨 <b>${num(meta.bank)}</b></strong><button class="primary-button" data-action="start">기지에서 출격 준비</button></div><figure class="tree-preview"><canvas aria-label="선택한 연구와 장비가 실제로 장착된 3D 함선 미리보기"></canvas><figcaption>실제 함선 · ${esc(capital?.name||ship.name)}${capital?' · 기본 함체 '+esc(ship.name):''} · 장착 기술 ${Object.values(tree).filter(lv=>lv>0).length}종</figcaption></figure></div><nav class="tree-filters" aria-label="기술 분류">${filters.map(([id,label])=>`<button data-tree-filter="${id}" aria-pressed="${treeFilter===id}">${label}</button>`).join('')}</nav><div class="tree-grid">${groups.map(branch=>`<section class="tree-branch ${branch.fork?'forked':''}" style="--branch:${branch.color}"><h3>${branch.label}</h3>${TREE_NODES.filter(n=>n.branch===branch.id).map(n=>{
      const lv=tree[n.id],blocked=treeLocked(n,tree),max=lv>=n.max,cost=n.cost*(lv+1)**2;
      const prereqs=treePrerequisites(n).map(id=>TREE_NODES.find(p=>p.id===id).name).join(' + ');
      return `<article class="tree-node ${lv?'learned':''} ${blocked?'locked':''}"><div class="tree-node-top"><span>TIER 0${n.tier}</span><b>${lv} / ${n.max}</b></div><h4>${n.name}</h4><p>${n.description}</p><div class="tech-appearance">외형 · ${n.appearance}<span>${lv?lv+'단계 장착':'연구 시 장착'}</span></div><small>${prereqs?'선행: '+prereqs+' 각 1단계':'선행 기술 없음'} · 단계마다 효과 누적</small><button data-tree="${n.id}" ${blocked||max||meta.bank<cost?'disabled':''}>${max?'강화 완료':blocked?'선행 기술 필요':(lv?'강화':'해금')+' · '+num(cost)+' 아르켈륨'}</button></article>`;
    }).join('')}</section>`).join('')}</div></section>`,'tree',meta);
    disposeShipPreview=renderShipPreview(modal.querySelector('.tree-preview canvas'),meta);
  }
  function showMenu(meta = {}) {
    currentMeta={...meta,research:{...meta.research}};hud.classList.remove('is-playing');
    const progress=cleanCampaign(currentMeta.campaign),remote=progress.systemOwned,complete=remote&&progress.andromedaOwned,stages=remote?ANDROMEDA_STAGES:SOLAR_STAGES,cleared=remote?progress.andromedaCleared:progress.cleared,next=stages[Math.min(cleared,stages.length-1)],ship=shipDefinition(currentMeta.ship),capital=solarStats(currentMeta).capital,hullName=capital?.name||ship.name;
    const menuDescription=complete?'태양계와 안드로메다를 정복했습니다.<br>기지에서 정비하고 완료한 행성에 다시 도전하세요.':'내 함선을 키우고, 적 함대와 보스를 격파해<br>'+(remote?'다른 은하의 행성을 하나씩 점령하세요.':'수성부터 행성을 하나씩 점령하세요.');
    show(`<section class="main-menu"><div class="menu-grid"></div><header class="menu-header">${brand()}${sharedNav()}</header><div class="menu-content"><span class="eyebrow">${complete?'안드로메다 원정 완료':remote?'안드로메다 원정':'지구에서 시작하는 태양계 정복'}</span><h1>VOID<span>ARK</span><i>잔해의 방주</i></h1><p class="menu-description">${menuDescription}</p><ol class="prep-menu-steps"><li>함선 확인</li><li>기지에서 준비</li><li>행성으로 출격</li></ol><div class="menu-actions"><button class="primary-button start-button" data-action="start" data-autofocus><span>${complete?'최종전 재도전 준비':'기지에서 출격 준비'}</span>${icon('arrow')}<small>${complete?'재도전':'다음 목표'} · ${next.name}</small></button></div><button class="secondary-button fleet-entry" data-action="fleet">${capital?"함선 확인·변경 · "+esc(hullName):"함선 선택 · 무료 24종 · "+esc(ship.name)}</button><a class="secondary-button" style="display:block;text-decoration:none;margin-top:10px;max-width:340px" href="./planet-enemies-preview.html">행성 적 3D 도감 · 17행성</a><details class="menu-optional"><summary>연구 · 기술 · 상점 <small>추가 성장 · 선택 사항</small></summary><button class="secondary-button" data-action="dock">영구 연구 · 조선소</button><button class="secondary-button" data-action="tree">테크트리 · 60종 기술</button><button class="secondary-button" data-action="market">광물 거래소 · 상점</button></details><div class="menu-how"><span><kbd>WASD</kbd> 이동</span><span><kbd>Q / E</kbd> 상승·하강</span><span><kbd>1 ~ 9</kbd> 스킬</span></div></div><aside class="sector-card"><div class="sector-card-top"><span class="eyebrow">${complete?'재도전 행성':'다음 점령 목표'}</span><span class="sector-number">${String(Math.min(cleared+1,stages.length)).padStart(2,'0')}</span></div><div class="sector-orbit"><i></i><i></i><i></i><span>${icon('ship')}</span><b class="orbit-target"></b></div><h2>${next.name}</h2><p>${next.title}</p><div class="sector-facts"><div><span>정복 진행</span><strong>${cleared} / ${stages.length}개 행성</strong></div><div><span>${capital?"선택 기함":"선택 함선"}</span><strong>${esc(hullName)}</strong></div><div><span>보관 자원</span><strong>${num(currentMeta.bank)} 아르켈륨</strong></div></div><div class="record-strip"><div><span>최고 격파</span><b>${num(currentMeta.bestKills)}</b></div><div><span>승리</span><b>${num(currentMeta.wins)}</b></div><div><span>출격</span><b>${num(currentMeta.runs)}</b></div></div></aside><footer class="menu-footer"><span>${capital?"기본 함선 24종 선택은 무료 · 제작한 기함은 태양 기지에서 변경 · 정비와 강화는 자원 사용":"함선 선택과 출격은 무료 · 정비와 강화는 자원 사용"}</span><label>그래픽 품질 <select data-setting="quality" aria-label="그래픽 품질"><option value="high" ${quality==='high'?'selected':''}>높음</option><option value="low" ${quality==='low'?'selected':''}>성능 우선</option></select></label></footer></section>`, 'menu', currentMeta);
  }
  function showUpgrades(choices = [],sim=null) {
    const upgradeStart=performance.now();
    upgradeSim=sim;selectedUpgrade=null;
    show(`<section class="overlay-screen upgrade-screen"><div class="overlay-glow"></div><div class="upgrade-header"><span class="eyebrow">SYSTEM UPGRADE AVAILABLE</span><h2>잔해가 새로운 힘이 됩니다.</h2><p>함선에 적용할 업그레이드를 선택하세요. <span>선택하는 동안 전투가 멈춥니다.</span></p></div><div class="level-ship-summary"><div class="level-ship-visual"><canvas class="level-ship-preview" aria-label="현재 및 선택 후 실제 3D 함선"></canvas></div><div class="level-ship-details"><span class="eyebrow">CURRENT VESSEL</span><h3 class="level-preview-title">현재 우주선</h3><p class="level-preview-stats"></p><p class="level-preview-effect">카드를 선택하면 장착 후 모습을 미리 볼 수 있습니다.</p><button class="primary-button" data-upgrade-confirm disabled>선택 후 확인</button></div></div><div class="upgrade-options">${choices.map((choice, i) => `<button class="upgrade-card" data-upgrade="${esc(choice.id)}" aria-keyshortcuts="${i + 1}" style="--upgrade-color:${esc(choice.color || '#71e6e8')}" ${i === 0 ? 'data-autofocus' : ''}><span class="upgrade-index"><span>키</span><kbd>${i + 1}</kbd></span><span class="upgrade-tag">${esc(choice.tag || '함선 강화')}</span><div class="upgrade-art"><canvas class="upgrade-model-art" data-skill-art="${esc(choice.art || choice.id)}" data-art-color="${esc(choice.color)}" aria-hidden="true"></canvas>${icon(normalizedSkill(choice.icon || choice.id))}<i></i><i></i><span class="upgrade-model-caption">3D EQUIPMENT</span></div><div class="upgrade-title"><h3>${esc(choice.name)}</h3><span>${choice.level > 1 ? `LV. ${choice.level - 1} → ${choice.level}` : (choice.tuning?'성능 개조':'새 모듈')}</span></div><p>${esc(choice.description)}</p><div class="upgrade-card-footer"><span>${Array.from({ length: Math.min(choice.maxLevel || 5, 8) }, (_, j) => `<i class="${j < Math.max(0, (choice.level || 1) - 1) ? 'filled' : j === Math.max(0, (choice.level || 1) - 1) ? 'next' : ''}"></i>`).join('')}</span><b>장착 미리보기 ${icon('arrow')}</b></div></button>`).join('')}</div><p class="upgrade-tip">1 · 2 · 3 키 / 카드로 미리보기 · 확인 버튼으로 최종 장착</p></section>`, 'upgrades', choices);
    const markupEnd=performance.now();
    disposeUpgradeArt=installSkillArt(modal,{assets:UPGRADE_ART,resolution:384});
    const artEnd=performance.now();
    renderLevelShip();
    timings.upgrade={domMs:markupEnd-upgradeStart,artSetupMs:artEnd-markupEnd,previewScheduleMs:performance.now()-artEnd,totalMs:performance.now()-upgradeStart};
    modal.dataset.upgradeTiming=JSON.stringify(timings.upgrade);
  }
  function renderLevelShip(choice=null){
    const sim=upgradeSim;if(!sim)return;disposeShipPreview?.();const gear={...sim.upgrades};if(choice&&!choice.tuning)gear[choice.id]=(gear[choice.id]||0)+1;
    const meta={...sim.meta,previewStage:choice?(sim.solar?.capital?2:sim.level>=8?2:sim.level>=4?1:0):sim.stage,campaignShip:{...sim.meta.campaignShip,gear}};
    const oldCanvas=modal.querySelector('.level-ship-preview'),canvas=oldCanvas.cloneNode(false);oldCanvas.replaceWith(canvas);disposeShipPreview=renderShipPreview(canvas,meta);
    modal.querySelector('.level-preview-title').textContent=sim.vessel.name+(choice?' · '+choice.name+' 장착 예상':' · 현재 상태');
    modal.querySelector('.level-preview-stats').textContent='선체 '+Math.round(sim.player.hp)+' / '+Math.round(sim.player.maxHp)+' · 실드 '+Math.round(sim.player.shield)+' / '+Math.round(sim.player.maxShield)+' · LV. '+sim.level;
    modal.querySelector('.level-preview-effect').textContent=choice?choice.description+(choice.tuning?' · 수치 개조는 함체 구조를 변경하지 않습니다.':''): '카드를 선택하면 장착 후 모습을 미리 볼 수 있습니다.';
  }
  function previewUpgrade(id){if(modalKind!=='upgrades')return false;const choice=modalData.find(c=>c.id===id);if(!choice)return false;selectedUpgrade=id;for(const card of modal.querySelectorAll('[data-upgrade]')){card.classList.toggle('selected',card.dataset.upgrade===id);card.setAttribute('aria-pressed',String(card.dataset.upgrade===id));}renderLevelShip(choice);const button=modal.querySelector('[data-upgrade-confirm]');button.disabled=false;button.textContent=choice.name+' · 확인하여 장착';return true;}
  function showPause() {
    show(`<section class="overlay-screen pause-screen"><div class="pause-panel"><span class="eyebrow">FLIGHT SUSPENDED</span><h2>잠시 숨을 고르세요.</h2><p>전장이 당신을 기다립니다.</p><button class="primary-button" data-action="resume" data-autofocus><span>전투 계속하기</span>${icon('arrow')}<small>ESC</small></button><div class="pause-links"><button class="secondary-button" data-action="help">${icon('help')} 조작 안내</button><button class="secondary-button sound-button" data-action="sound">${icon(soundEnabled ? 'sound' : 'muted')} ${soundEnabled ? '음향 켜짐' : '음향 꺼짐'}</button></div><button class="quiet-button" data-action="quit-confirm">작전을 종료하고 메뉴로</button></div></section>`, 'pause');
  }
  function showHelp() {
    const previous = { kind: modalKind, data: modalData };
    if (!modalKind) actions.pause?.();
    show(`<section class="overlay-screen help-screen"><div class="help-panel"><button class="icon-button help-close" data-action="help-close" title="안내 닫기" aria-label="안내 닫기">${icon('close')}</button><span class="eyebrow">FLIGHT MANUAL / 01</span><h2>조종은 간단하게.<br>전투는 입체적으로.</h2><p class="help-intro">무장은 자동 조준·사격합니다. 적을 피하고 잔해를 수집하세요.</p><div class="help-controls"><div><span class="control-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><strong>전후 · 좌우 이동</strong><p>함선 주변으로 적을 유도하세요.</p></div><div><span class="control-keys"><kbd>Q</kbd><kbd>E</kbd></span><strong>하강 · 상승</strong><p>높이를 바꾸며 포위망을 벗어나세요. Z / C: 좌우 회피, R: 이동 방향 회피.</p></div><div><span class="control-keys"><kbd>SHIFT</kbd></span><strong>부스트</strong><p>누르는 동안 에너지를 소비해 가속합니다.</p></div><div><span class="control-keys"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></span><strong>전술 스킬</strong><p>펄스 · 유도 미사일 · 과충전을 사용하세요.</p></div><div><span class="control-keys mouse-key">드래그</span><strong>카메라 회전</strong><p>좌·우 버튼을 누르고 움직이면 360° 회전합니다. 위·아래에서도 볼 수 있습니다. 휠로 거리를 조절하고 Home키로 시점을 복귀하세요.</p></div><div><span class="control-keys"><kbd>ESC</kbd></span><strong>일시정지</strong><p>언제든 전투를 멈출 수 있습니다.</p></div></div><div class="help-loop"><span>적 함선 격파</span>${icon('arrow')}<span>잔해 수집</span>${icon('arrow')}<span>무장 · 함체 증축</span>${icon('arrow')}<span>보스 격파</span></div><button class="primary-button" data-action="help-close" data-autofocus><span>확인했어요</span>${icon('check')}</button></div></section>`, 'help', previous);
  }
  function showEnd(result = {}, meta = currentMeta) {
    currentMeta = { ...currentMeta, ...meta, research: { ...currentMeta.research, ...meta.research } };
    const success = !!result.victory,target=result.campaign?expeditionTarget(currentMeta,result):null;
    show(`<section class="overlay-screen end-screen ${result.campaign?'campaign-end':''} ${success ? 'victory' : ''}"><div class="end-panel"><span class="eyebrow">${success ? 'OPERATION COMPLETE / WELCOME HOME' : 'SIGNAL LOST / FLIGHT RECORDER RECOVERED'}</span><div class="end-emblem">${icon(success ? 'ship' : 'shield')}</div><h2>${result.campaign?(success?(result.campaign.complete?(result.campaign.chapter==='andromeda'?'안드로메다의 지배자':'태양계의 지배자'):result.campaign.planet+' 점령 완료'):'침공 실패 · 기지로 귀환'):success?'방주는 살아남았습니다.':'신호가 끊겼습니다.'}</h2><p>${result.campaign?(success?(result.campaign.complete?(result.campaign.chapter==='andromeda'?'아르카온의 황좌를 무너뜨렸습니다. 세 행성계와 아홉 거점이 항복해 안드로메다 원정이 완수되었습니다.':'태양계 통일 완료. 태양 기지에서 기함과 선단을 준비해 안드로메다로 원정하세요.'):'다음 행성 침공이 열렸습니다. 기지에서 수리하고 함선을 준비하세요.'):'정복한 행성과 영구 장비는 유지됩니다. 기지에서 수리·충전하고 같은 작전에 재도전하세요.'):success?'적 함대를 돌파했습니다. 회수한 잔해로 다음 출격을 준비하세요.':'마지막 전투의 기록과 회수한 아르켈륨이 조선소에 남았습니다.'}</p><div class="result-stats"><div><span>생존 시간</span><strong>${formatTime(result.time)}</strong></div><div><span>격파한 적</span><strong>${num(result.kills)}</strong></div><div><span>도달 레벨</span><strong><small>LV.</small> ${num(result.level)}</strong></div><div><span>최종 함체</span><strong>${esc(result.finalHullName || (typeof result.stage === 'string' ? result.stage : ['정찰선', '전투함', '우주 모함'][Math.max(0, result.stage || 0)] || '우주 모함'))}</strong></div></div>${result.campaign?debriefMarkup(result,currentMeta):`<div class="banked-reward">${icon('salvage')}<div><span>조선소로 회수한 아르켈륨</span><strong>+${num(result.banked ?? result.scrap)}</strong></div><span>보유 <b>${num(currentMeta.bank)}</b></span></div>`}<div class="end-actions"><button class="primary-button" data-action="${result.campaign?'prepare-expedition':'restart'}" data-autofocus><span>${result.campaign?(success?(target.completed||target.replay?'재도전 준비 · ':'다음 원정 준비 · '):'수리·재도전 준비 · ')+esc(target.stage?.name||'기지'):'정비 기지로 귀환'}</span>${icon('arrow')}</button><button class="secondary-button" data-action="dock">${icon('reactor')} 조선소에서 연구</button></div><button class="quiet-button" data-action="menu">메인 메뉴로</button></div></section>`, 'end', { result, meta: currentMeta });
  }
  function showFleet(meta=currentMeta,family=-1){
    currentMeta=meta;const selected=shipDefinition(meta.ship),capital=solarStats(meta).capital,hullName=capital?.name||selected.name,hasCapital=SOLAR_CAPITALS.some(d=>meta.spaceBase?.owned?.includes(d.id));
    show(`<section class="overlay-screen fleet-screen"><div class="fleet-panel"><div class="fleet-flight-bar"><strong>${capital?"현재 기함":"선택 함선"} · ${esc(hullName)}</strong><button class="primary-button" data-action="start">이 함선으로 출격 준비 →</button></div><header><div><span class="eyebrow">ARK FLEET / 24 VESSELS</span><h2>당신의 전투 방식을 선택하세요</h2><p>선택: ${esc(hullName)} · 기본 함선 24종은 무료 · 카드 선택 즉시 적용 · 다음 출격부터 사용 · 연구와 기지 지원은 공통 적용</p>${capital?`<p class="counter-advice">현재 기함 ${esc(capital.name)}의 기본 함체는 ${esc(selected.name)}입니다. 다른 기본 함체를 선택하면 그 함체로 출격합니다. 제작한 기함의 보유는 유지되며 태양 기지에서 다시 선택할 수 있습니다.</p>`:hasCapital?`<p class="counter-advice">제작한 기함은 보유 중입니다. 다시 사용하려면 태양 기지의 기함 제작 목록에서 보유 기함을 선택하세요.</p>`:""}</div><div class="fleet-next-actions"><button class="secondary-button" data-action="menu">메뉴로</button></div></header><nav class="region-tabs"><button class="secondary-button ${family<0?'selected':''}" data-family="-1" aria-pressed="${family<0}">전체 24종</button>${SHIP_FAMILIES.map((f,i)=>`<button class="secondary-button ${family===i?'selected':''}" data-family="${i}" aria-pressed="${family===i}">${f.name}</button>`).join('')}</nav><details class="archive"><summary>전술 상성표 · 무기와 장갑</summary><p>실제 피해 배율입니다. 지휘관 고유 저항·방패 호위·연구 효과가 추가 적용됩니다. 접촉과 반응로 폭발은 중립입니다.</p><div style="overflow:auto"><table class="counter-table"><thead><tr><th>무장</th>${Object.values(ARMORS).map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>${Object.entries(MATCHUPS).map(([id,row])=>`<tr><th>${WEAPONS[id]}</th>${row.map(n=>`<td class="${n>1?'advantage':n<1?'resistant':''}">×${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>요격기는 경량 추격기를, 유도탄은 중장갑·요새를, 방전은 에너지 장갑을 견제합니다. 적 수복함부터 격파하면 재생을, 방패 호위를 격파하면 항모 피해 감소 25%를 끊습니다.</p></details><div class="fleet-grid">${SHIPS.filter(s=>family<0||s.family===family).map(s=>{const f=SHIP_FAMILIES[s.family],weapons={cannon:'기관포',missile:'유도탄',laser:'레이저',chain:'번개',fighter:'호위기'};return `<article class="fleet-card ${s.id===selected.id?'chosen':''}" style="--fleet-color:${f.color}"><div class="fleet-ship-art"><img src="/assets/meshy/${hullAsset(s.id,s.family===2?2:s.family===0?0:1)}.png" alt="${s.name} · 메시AI 3D 함선" loading="lazy" decoding="async"><span>${s.family===2?'CARRIER':s.family===0?'SCOUT':'CRUISER'} / ${s.weapon.toUpperCase()}</span></div><span class="eyebrow">${f.name}</span><h3>${s.name}</h3><div class="fleet-stats">선체 ${s.hull} · 실드 ${s.shield}<br>이동 ${(13*s.speed).toFixed(1)}m/s · 주력 ${weapons[s.weapon]}${s.bonus?' +'+Math.round(s.bonus*100)+'%':''}</div><p>${s.description}</p><p class="counter-advice">${armorAdvice(shipArmor(s))}</p><button class="secondary-button" data-ship="${s.id}" ${s.id===selected.id?'disabled':''}>${s.id===selected.id?(capital?"현재 기함의 기본 함체":"선택됨"):"이 함선 선택"}</button></article>`;}).join('')}</div><button class="primary-button" data-action="start">${esc(hullName)} · 기지에서 출격 준비 →</button></div></section>`,'fleet',{family});
    modal.querySelectorAll('[data-family]').forEach(b=>b.addEventListener('click',()=>showFleet(currentMeta,Number(b.dataset.family))));
  }
  function showCampaign(sim,home=false,selected=null){
    if(home)hud.classList.remove('is-playing');
    const progress=cleanCampaign(sim.meta.campaign),chapter=selected||(home&&progress.systemOwned?'andromeda':sim.campaign?.chapter||'solar'),remote=chapter==='andromeda';
    const stages=remote?ANDROMEDA_STAGES:SOLAR_STAGES,cleared=remote?progress.andromedaCleared:progress.cleared,done=cleared===stages.length,next=stages[Math.min(cleared,stages.length-1)],unlocked=!remote||progress.systemOwned;
    const rewardText=(stage,replay)=>replay?'재점령: 최초 보상 0 · 승리 작전 보상 +120 · 실제 전리품 회수':`최초 점령 보상 +${stage.reward} 아르켈륨 · 승리 작전 보상 +120 · 실제 전리품 회수`;
    const systems=remote?ANDROMEDA_SYSTEMS.map((r,i)=>'<article style="--system-color:#'+r.color.toString(16)+'"><span class="eyebrow">SYSTEM 0'+(i+1)+' / '+r.faction+'</span><h3>'+r.name+'</h3><p>'+r.story+'</p><small>'+r.relation+'<br>'+r.doctrine+'</small><b>점령 '+Math.max(0,Math.min(3,cleared-i*3))+' / 3</b></article>').join(''):'';
    const cards=stages.map((p,i)=>'<article class="'+(i<cleared?'owned':i===cleared?'next':'locked')+'"><span>STAGE '+String(i+1).padStart(2,'0')+(remote?' · '+p.system.name:'')+'</span><h3>'+p.name+'</h3><p>'+p.title+'</p>'+(remote?'<small>'+armorAdvice(p.armor)+'<br>중간보스: '+p.warden+'<br>총독: '+p.governor+'</small>':'')+(remote?'':'<button class="stage-inspect" data-stage-inspect="'+i+'">3D 작전 미리보기 ↗</button>')+'<small>함대 '+p.kills+'척 · 요새 '+p.bases+'개 · 보스 2척<br>'+rewardText(p,i<cleared)+'</small><button class="secondary-button" data-solar="'+i+'" data-chapter="'+chapter+'" '+(!home||!unlocked||i>cleared?'disabled':'')+'>'+(!home?(p.index===sim.campaign?.index?'현재 작전 진행 중':i<cleared?'점령 완료':'다음 작전 대기'):!unlocked?'태양계 정복 필요':i<cleared?'점령 완료 · 재도전':i===cleared?(remote?'태양 관문에서 원정':'기지에서 출격'):stages[i-1].name+' 정복 후 해금')+'</button></article>').join('');
    show('<section class="solar-screen"><header>'+brand()+'<button class="text-button" data-action="'+(home?'menu':'galaxy-close')+'">'+(home?'메뉴로 돌아가기':'전장 복귀 · G / ESC')+'</button></header><span class="eyebrow">'+(remote?'CHAPTER II / ANDROMEDA EXPEDITION':'CHAPTER I / SOLAR CAMPAIGN')+'</span><h2>'+(remote?'안드로메다 · 황좌의 관문':'태양계 정복 작전')+'</h2><p>'+(remote?'태양계 → 은하 간 관문 → 안드로메다 은하 → 3개 행성계 / 9개 행성':'내 행성 지구 → 태양계 → 우리 은하')+'</p><div class="base-hub-links"><button class="secondary-button" data-campaign-chapter="solar">우리 은하 · 태양계 '+progress.cleared+'/8</button><button class="secondary-button" data-campaign-chapter="andromeda" '+(!progress.systemOwned?'disabled':'')+'>'+(progress.systemOwned?'안드로메다 원정 '+progress.andromedaCleared+'/9':'안드로메다 · 태양계 정복 시 해금')+'</button></div><div class="solar-status"><strong>'+(!unlocked?'태양계 정복 후 원정 가능':done?(remote?'안드로메다의 지배자 · 황좌 점령':'태양계 통일 · 태양 소유'):'다음 원정: '+next.name)+'</strong><span>점령 '+cleared+' / '+stages.length+'</span></div>'+(home?'<div class="base-hub-links"><button class="secondary-button" data-campaign-base="earth">지구 기지 · 정비</button><button class="secondary-button" data-campaign-base="sun" '+(!progress.systemOwned?'disabled':'')+'>태양 궤도 기지 · 기함 / 선단 준비</button></div>':'')+(home&&unlocked?'<div class="campaign-next-action"><div><strong>'+next.name+' · '+(done?'재도전':'다음 점령 목표')+'</strong><small>함대 격파 → 요새 파괴 → 보스 2척 → 행성 착륙<br>'+rewardText(next,done)+'</small></div><button class="primary-button" data-solar="'+Math.min(cleared,stages.length-1)+'" data-chapter="'+chapter+'">'+next.name+'으로 출격 →</button></div>':'')+'<h3>3D 원정 항로 · 행성계별 점령 현황</h3><canvas class="solar-route" aria-label="'+(remote?'안드로메다 3개 행성계와 9개 행성의 입체 원정 지도':'태양계 입체 작전 지도')+'"></canvas>'+(remote?'<p>아스트라 → 벨카르 → 에테르 순서로 침공합니다. 각 행성은 봉쇄 함대 → 궤도 요새 → 수호자 → 총독.<br>마지막 에테리온은 패왕 아르카온 격파 후 표면 착륙으로 은하 정복 완료.<br>'+rewardText(stages[stages.length-1],done)+'.<br>권장 준비: 태양 기함 · 영구 무장 · 요격/지원함을 포함한 선단. 이전 장비와 개별 함선 개조는 이어집니다.</p><div class="expedition-systems">'+systems+'</div>':'<p>수성 → 금성 → 화성 → 목성 → 토성 → 천왕성 → 해왕성 → 명왕성<br>8개 행성 정복 후 태양 기지와 안드로메다 원정 해금.</p>')+'<div class="solar-stages">'+cards+'</div><p>전장: '+(remote?'1.5km × 높이 600m × 1.5km':'1.2km × 높이 480m × 1.2km')+' · 이탈 시 5초 복귀 유예 후 실드/선체 소모<br>보스 격파 뒤 표면 착륙·승리 시 정산됩니다. 전리품 회수량은 전투에 따라 달라집니다.<br>정복과 기지·함선 개조는 저장됩니다. 패배 시 해당 행성에 재도전합니다.</p></section>','campaign',sim.meta);
    if(remote)disposeGalaxyMap=renderAndromedaRoute(modal.querySelector('.solar-route'),cleared);
    else {
      const canvas=modal.querySelector('.solar-route'), panel=document.createElement('div');panel.className='mission-inspector';canvas.after(panel);
      const phases=['봉쇄 함대','궤도 요새','방어 사령관','행성 총독'];
      const explain=i=>{const p=stages[i];panel.innerHTML='<div class="mission-heading"><span>STAGE '+String(i+1).padStart(2,'0')+' / '+p.title+'</span><h3>'+p.name+' 침공 작전</h3><button class="secondary-button" data-overview>태양계 전체 보기</button></div><div class="mission-phases">'+phases.map((name,j)=>'<button data-preview-phase="'+j+'" aria-pressed="'+(j===0)+'">0'+(j+1)+' · '+name+'</button>').join('')+'</div><p class="mission-detail">항모와 호위 전단을 격파하세요 · 목표 '+p.kills+'척</p><small>작전 배치 개념도 · 드래그: 회전 / 휠: 확대 · 거리·크기·공전 속도는 관측용 축척입니다.</small>';
        panel.querySelector('[data-overview]').onclick=()=>{disposeGalaxyMap.select(-1);panel.innerHTML='<p>공전 중인 행성을 누르거나 아래 스테이지의 3D 작전 미리보기를 선택하세요.</p>';};
        panel.querySelectorAll('[data-preview-phase]').forEach(b=>b.onclick=()=>{const phase=Number(b.dataset.previewPhase);disposeGalaxyMap.phase(phase);panel.querySelectorAll('[data-preview-phase]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));panel.querySelector('.mission-detail').textContent=[ '항모와 호위 전단을 격파하세요 · 목표 '+p.kills+'척','행성 주변의 궤도 요새 '+p.bases+'개를 파괴하세요','중간보스 방어 사령관을 격파해 방어선을 돌파하세요','최종보스 행성 총독 격파 → 표면 착륙 · '+rewardText(p,i<cleared)][phase];});
      };
      disposeGalaxyMap=renderSolarCommand(canvas,cleared,explain);panel.innerHTML='<p>행성을 클릭해 작전 보기 · 드래그로 시점 회전 · 휠로 확대/축소</p><small>실제 천체를 바탕으로 한 게임 지도 · 거리·크기·공전 속도는 관측용 축척</small>';
      modal.querySelectorAll('[data-stage-inspect]').forEach(b=>b.onclick=()=>{disposeGalaxyMap.select(Number(b.dataset.stageInspect));canvas.scrollIntoView({behavior:'smooth',block:'center'});});
    }
    modal.querySelectorAll('[data-campaign-chapter]').forEach(b=>b.addEventListener('click',()=>showCampaign(sim,home,b.dataset.campaignChapter)));
  }
  function showGalaxy(sim,regionId){
    if(sim.mode==='campaign')return showCampaign(sim);
    currentGalaxySim=sim;const nav=navigationPlan({...sim.snapshot(),level:sim.level},navigationTarget);regionId ||= nav?.planet.region||'haven';
    const ownerName=id=>id===sim.actor?'내 영토':id?.startsWith('pilot-')?'조종사 '+id.slice(-4):civilizationForOwner(id)?.name||FACTIONS[Number(id?.split('-')[1])]?.name||'미확인';
    const current=galaxyDefinition(sim.galaxyId),localPlanets=PLANETS.filter(p=>p.galaxy===current.id);const owned=galaxyProgress(sim.meta.conquest),income=Math.ceil(owned.reduce((n,p)=>n+p.level*2,0)*(1+treeStats(sim.meta.tree).income)),region=REGIONS.find(r=>r.id===regionId)||REGIONS[0],faction=FACTIONS[region.faction],progress=regionProgress(sim.meta.conquest,region.id,current.id);
    show(`<section class="overlay-screen galaxy-screen"><div class="galaxy-panel"><header><div><span class="eyebrow">ARK ARCHIVE / STELLAR YEAR 301</span><h2>${current.name}</h2><p>5개 은하 · 은하마다 ${REGIONS.length}개 성역 · 행성 ${PLANETS.length}개 · 방어 기지 ${TOTAL_BASES}개 · 점령 ${owned.length}/${PLANETS.length} · 30초마다 보관 아르켈륨 +${income}</p></div><button class="secondary-button" data-action="galaxy-close">전장 복귀 · G / ESC</button></header><section class="navigation-brief"><span class="eyebrow">NEXT DESTINATION / 추천 항로</span><h3>${esc(nav?.planet.name||"목표 없음")} · LV.${nav?.planet.level||1}</h3><p>${esc(nav?.reason||"")} · ${num(nav?.distance||0)}m</p><p>${esc(nav?.step||"")}</p><p>흰 마커 = 내 위치 · 금빛 고리/항로 = 선택 목표 · 초록 = 내 영토 · 행성을 클릭해 목표를 선택하세요.</p><button class="primary-button" data-navigate="${nav?.recommended.id}">추천 목표 추적</button><button class="secondary-button" data-warp="${nav?.planet.id}" ${sim.warpCooldown>0?"disabled":""}>${sim.warpCooldown>0?"도약 충전 "+Math.ceil(sim.warpCooldown)+"초":"선택 목표로 궤도 도약"}</button><p>도약 후: 가까운 방어 기지부터 격파하세요. 우두머리와 교전 중이면 120m 이상 벗어난 뒤 도약할 수 있습니다.</p></section><details class="galaxy-expedition"><summary>다른 은하로 원정 · 관문 항로와 난도 보기</summary><section class="intergalactic-panel"><span class="eyebrow">INTERGALACTIC GATE NETWORK</span><h3>은하 간 원정 · 5개 은하 / 480개 행성</h3><p>현재 ${current.name} · ${current.story}</p><canvas class="galaxy-network" aria-label="5개 은하의 입체 나선 구조와 관문 연결 항로"></canvas><p>흰 고리: 현재 은하 · 밝은 항로: 이동 가능 · 흐린 은하: 미탐사</p><div class="galaxy-gates">${GALAXIES.map(g=>`<article style="--gate-color:${g.color}"><strong>${g.name}</strong><small>난도 +${g.tier*8} · 발견 ${sim.meta.discoveries.includes(g.id)?'완료':'미탐사'}</small><p>${g.story}</p><button class="secondary-button" data-galaxy="${g.id}" ${!current.links.includes(g.id)||sim.warpCooldown>0?'disabled':''}>${g.id===current.id?'현재 은하':current.links.includes(g.id)?'관문 통과 · 45초 충전':'연결 은하를 경유하세요'}</button></article>`).join('')}</div><p>관문 항로: 우리 은하 ↔ 안드로메다 · 우리 은하 ↔ 청록 · 안드로메다 ↔ 심연 · 청록 ↔ 심연 / 시원 · 심연 ↔ 시원</p><p>첫 발견 보상 200~500 아르켈륨 · 정비 기지 귀환은 모든 은하에서 가능 · 이동하면 45초 충전 후 현지 행성으로 도약할 수 있습니다.</p></section></details><div class="war-fronts"><strong>32개 문명 패권 전쟁 · 진행 중인 침공 ${sim.war.wars.length}건 · ${sim.sharedWar?'서버 시간 계속 진행':'메뉴에서 전투 일시정지'}</strong>${sim.war.wars.map(w=>`<p>${PLANETS.find(p=>p.id===w.target).name} · ${ownerName(w.attacker)} → ${ownerName(w.defender)} · 남은 ${Math.ceil(w.remaining)}<span data-war-time="${w.id}" hidden></span>초 · 침공 함대 ${w.kills}/${w.strength} 격파 <button class="secondary-button" data-warp="${w.target}" ${sim.warpCooldown>0||PLANETS.find(p=>p.id===w.target).galaxy!==current.id?'disabled':''}>${PLANETS.find(p=>p.id===w.target).galaxy===current.id?'전선으로 도약':'해당 은하 관문을 경유하세요'}</button>${w.defender===sim.actor?`<button class="primary-button" data-defend="${w.id}" ${sim.defenseRecall||sim.recalledRaids[w.id]||sim.player.boost<25?'disabled':''}>선단 긴급 귀환 · 추진 25</button>`:''}</p>`).join('')||'<p>현재 침공 없음 · 세력들이 다음 공격을 준비 중입니다.</p>'}</div><details class="civilization-directory"><summary>문명 외교 기록실 · 32개 독립 국가 · 동맹과 숙적</summary><p>동맹끼리는 침공하지 않습니다. 숙적은 우선 공격하며, 점령 결과에 따라 실제 영토가 바뀝니다.</p><div class="civilization-grid">${CIVILIZATIONS.map(n=>`<article class="civilization-card" style="--nation-color:${n.color}"><h3>${n.name}</h3><p>${n.history}.</p><p>목표 · ${n.goal} / 전술 · ${n.doctrine} / 핵심 자원 · ${n.resource}</p><p>현재 영토 ${PLANETS.filter(p=>sim.war.owners[p.id]===n.owner).length}개 · 원정 ${sim.war.wars.filter(w=>w.attacker===n.owner).length}건</p><p>동맹 · ${CIVILIZATIONS.filter(x=>diplomaticRelation(n.owner,x.owner)==='동맹').map(x=>x.name).join(' / ')}</p><p>숙적 · ${CIVILIZATIONS.filter(x=>diplomaticRelation(n.owner,x.owner)==='숙적').map(x=>x.name).join(' / ')}</p></article>`).join('')}</div></details><nav class="region-tabs" aria-label="성역 선택">${REGIONS.map(r=>{const x=regionProgress(sim.meta.conquest,r.id,current.id);return `<button class="secondary-button ${r.id===region.id?'selected':''}" data-region="${r.id}">${r.name}<small>${x.owned}/${x.total}</small></button>`;}).join('')}</nav><div class="galaxy-layout"><div><div class="map-focus-actions"><button class="secondary-button" data-map-focus="near">목표 주변 확대</button><button class="secondary-button" data-map-focus="all">은하 전체 보기</button></div><canvas class="galaxy-canvas" aria-label="성역별 행성과 현재 함선 위치를 표시하는 3D 은하 지도"></canvas><p>흰색: 현재 함선 · 녹색: 점령 행성 · 밝은 별: 선택한 성역</p><article class="region-story"><span class="eyebrow">${faction.name} 계승 성역 / ${progress.owned===progress.total?'해방 완료':'분쟁 성역'}</span><h3>${region.name}</h3><p>${region.story}</p><strong>${region.goal}</strong><p>현재 은하 성역 해방 ${progress.owned}/${progress.total} · 모든 행성 점령 시 보관 아르켈륨 +${300+REGIONS.indexOf(region)*100}</p></article><button class="primary-button" data-warp="home" ${sim.warpCooldown>0?'disabled':''}>정비 기지로 도약</button><p>${sim.warpCooldown>0?'도약 충전 '+sim.warpCooldown.toFixed(1)+'초 · 전장에서 충전됩니다':'도약 준비 완료 · 우두머리 120m 내 교전 중에는 도약 불가'}</p><details class="archive"><summary>방주 역사 기록실 · 은하 연대기와 선조 세력</summary><h3>우리는 왜 항해하는가</h3><p>모성은 사라졌지만 이주 선단의 신호는 남아 있습니다. 정비 기지를 키우고 행성의 봉쇄를 풀어, 다시 살아갈 우주를 연결하세요.</p>${CHRONICLE.map(([year,title,text])=>`<p><strong>${year} · ${title}</strong><br>${text}</p>`).join('')}${FACTIONS.map(f=>`<p><strong style="color:${f.color}">${f.name}</strong><br>${f.history}</p>`).join('')}<p>자원과 유적은 세계관 기록입니다. 현재 점령 생산과 보상은 아르켈륨으로 지급됩니다.</p></details></div><div class="planet-list">${localPlanets.filter(p=>p.region===region.id).map(p=>{const war=sim.war.wars.find(w=>w.target===p.id),captured=basesDestroyed(sim.meta.conquest,p),done=occupied(sim.meta.conquest,p),lore=planetLore(p,sim.meta.conquest,sim.war.owners[p.id],sim.actor);return `<article class="planet-card ${done?'occupied':''}"><strong>${p.name}<small>LV. ${p.level} · ${p.biome} · ${ownerName(sim.war.owners[p.id])}</small></strong><p>${done?'점령 완료 · 자원 생산 중':'기지 '+captured+' / '+p.baseCount+' · '+(sim.meta.conquest?.[p.id]?.includes('warden')?'중간보스 격파':'중간보스 대기')} · ${num(dist(p.position,sim.player.position))}m</p>${war?`<p class="war-danger">⚠ ${ownerName(war.attacker)} 침공 · ${Math.ceil(war.remaining)}초</p>`:''}<details><summary>행성 기록 · ${lore.resource}</summary><p><b>독립 문명</b> · ${(civilizationForOwner(sim.war.owners[p.id])||civilizationForPlanet(p)).name} · ${(civilizationForOwner(sim.war.owners[p.id])||civilizationForPlanet(p)).goal}</p><p>${lore.history}</p><p><b>방주와의 관계</b> · ${lore.relationship}</p><p>${lore.stakes}</p><p class="counter-advice">궤도 요새 · ${armorAdvice(planetArmor(p))}</p>${relationsFor(p).map(r=>`<p><b>${r.kind}</b> · ${r.text}</p>`).join('')}<div class="captain-dossier" style="--captain-color:${lore.captain.color}"><strong>${lore.captain.name} · ${lore.captain.title}</strong><p class="counter-advice">적 기함 · ${armorAdvice(lore.captain.tactic==='restore'?'bio':shipArmor(shipDefinition(lore.captain.ship)))}</p><p>${lore.captain.trait} · ${CAPTAIN_ATTRIBUTES[lore.captain.tactic].element}</p><p>호위 편대 · ${lore.captain.roles.map(r=>ENEMY_OFFICERS[r].name).join(" / ")}</p><p>${CAPTAIN_ATTRIBUTES[lore.captain.tactic].weakness}</p><p>${lore.captain.history}</p><blockquote>“${lore.captain.quote}”</blockquote></div></details><button class="secondary-button" data-navigate="${p.id}">${nav?.planet.id===p.id?"◆ 추적 중":"목표로 지정"}</button><button class="secondary-button" data-warp="${p.id}" ${sim.warpCooldown>0?'disabled':''}>${done?'방어 · 점령 궤도':'침공 · 궤도 도약'}</button>${done&&sim.war.owners[p.id]===sim.actor?`<button class="secondary-button" data-headquarters="${p.id}" ${sim.meta.headquarters===p.id?'disabled':''}>${sim.meta.headquarters===p.id?'본부 행성 · 긴급 통신 우선':'본부 행성으로 지정'}</button>`+defensePanel(sim,p.id):''}${!done?`<button class="secondary-button" data-raid="${p.id}" ${sim.meta.bank<30||!owned.length||war?'disabled':''}>침공 함대 파견 · 30 아르켈륨</button>`:''}</article>`;}).join('')}</div></div></div></section>`,'galaxy',{regionId});
    const disposeLocal=renderGalaxyMap(modal.querySelector('.galaxy-canvas'),sim.meta.conquest,sim.player.position,region.id,sim.war.snapshot(),sim.actor,sim.sharedWar,current.id,nav?.planet.id,id=>{navigationTarget=id;showGalaxy(sim,PLANETS.find(p=>p.id===id)?.region);},mapFocus);const disposeNetwork=renderGalaxyNetwork(modal.querySelector('.galaxy-network'),current.id,sim.meta.discoveries);disposeGalaxyMap=()=>{disposeLocal();disposeNetwork();};
    modal.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>showGalaxy(sim,button.dataset.region)));
  }
  function refreshGalaxy(sim){if(modalKind!=='galaxy')return;const region=modalData?.regionId||'haven',top=modal.querySelector('.galaxy-screen')?.scrollTop||0;showGalaxy(sim,region);modal.querySelector('.galaxy-screen').scrollTop=top;}
  function showCarrier(sim,slot=modalKind==='carrier'?(modalData?.slot||0):0){
    currentCarrierSim=sim;const ship=sim.fleet.find(a=>a.slot===slot)||sim.fleet[0];if(!ship)return;slot=ship.slot;const d=ship.configuration;
    show(`<section class="overlay-screen carrier-screen"><div class="carrier-panel"><header><div><span class="eyebrow">FLAGSHIP / CARRIER HANGAR</span><h2>선단 격납고</h2><p>각 함선의 개조는 영구 저장됩니다. 전투 아르켈륨부터 사용합니다.</p></div><button class="secondary-button" data-action="carrier-close">${sim.campaignDock?'기지 정비소로 복귀 · ESC':'전장 복귀 · ESC'}</button></header><div class="carrier-layout"><nav aria-label="개조할 함선">${sim.fleet.map(a=>`<button class="carrier-vessel ${a.slot===slot?'selected':''}" data-carrier-slot="${a.slot}"><b>${String(a.slot+1).padStart(2,'0')} · ${a.configuration.name}</b><small>내구도 ${num(a.hp)} / ${num(a.maxHp)} · 개조 ${Object.values(a.upgrades).reduce((x,y)=>x+y,0)} / 12</small></button>`).join('')}</nav><div><div class="carrier-preview"><canvas aria-label="선택한 함선의 실제 개조 외형"></canvas><strong>${String(slot+1).padStart(2,'0')} / ${d.name}</strong></div><p class="counter-advice">${armorAdvice(fleetArmor(ship.role))}</p>${sim.campaignDock==='sun'?`<div class="base-hub-links">${Object.keys(FLEET_BUILD_COST).map(role=>`<button class="secondary-button" data-refit-role="${role}" data-slot="${slot}" title="${esc(fleetRefitLock(sim,slot,role)||'비용과 성능 비교 후 재설계')}" ${fleetRefitLock(sim,slot,role)?'disabled':''}>${FLEET_ROLES[role].name} · ${role===ship.role?'현재 함종':fleetRefitCost(role)+' 아르켈륨 / 재설계'}</button>`).join('')}</div>`:''}<p class="carrier-stats">공격력 ${num(d.damage)} · 최대 내구도 ${num(ship.maxHp)} · 사거리 ${num(d.range)}m · 장갑 감소 ${num(d.resistance*100)}%<br>편대 추종 ×${(d.follow/4).toFixed(2)} · ${ship.role==='support'?'수복 ×'+d.support.toFixed(2):ship.role==='interceptor'?'요격 거리 '+d.interceptRange+'m':'복귀 속도 ×'+d.recovery.toFixed(2)}</p></div><div class="carrier-upgrades"><strong>사용 가능 아르켈륨 ${num(sim.scrap+sim.meta.bank)}</strong>${Object.entries(FLEET_UPGRADES).map(([id,item])=>{const rank=ship.upgrades[id],cost=fleetUpgradeCost(ship.upgrades,id);return `<article><h3>${item.name} <small>${rank} / 3</small></h3><p>${item.description}</p><button class="primary-button" data-fleet-upgrade="${id}" data-slot="${slot}" ${rank>=3||sim.scrap+sim.meta.bank<cost?'disabled':''}>${rank>=3?'개조 완료':num(cost)+' 아르켈륨 · 강화'}</button></article>`;}).join('')}</div></div></div></section>`, 'carrier',{slot});
    modal.querySelectorAll('[data-carrier-slot]').forEach(b=>b.addEventListener('click',()=>showCarrier(sim,Number(b.dataset.carrierSlot))));
    disposeShipPreview=renderShipPreview(modal.querySelector('.carrier-preview canvas'),sim.meta,d);
  }
  function installBaseCardArt(scope=modal){
    const equipment=UPGRADE_ART,service={repair:'skill-repair',shield:'module-shield',maintenance:'module-engine'},solar={foundation:'orbital-dock',command:'facility-command',shipyard:'facility-drydock',forge:'facility-arsenal',shield:'facility-shieldLab',reactor:'facility-reactor',logistics:'facility-hangar'},fleet={frigate:'nation-a-cruiser',support:'module-drone',destroyer:'nation-y-cruiser',interceptor:'skill-sentry',cruiser:'nation-a-carrier'},assets={};
    for(const button of scope.querySelectorAll('[data-base-service],[data-base-equipment],[data-construction],[data-solar-build],[data-fleet-build],[data-defense-type],[data-research]')){
      const article=button.closest('article');if(article?.closest('details')&&!article.closest('details').open)continue;if(!article||article.classList.contains('loadout-card')||article.querySelector('.base-card-model'))continue;
      const id=button.dataset.baseEquipment||button.dataset.baseService,asset=id?(equipment[id]||service[id]):button.dataset.construction?'facility-'+button.dataset.construction:button.dataset.solarBuild?solar[button.dataset.solarBuild]:button.dataset.fleetBuild?fleet[button.dataset.fleetBuild]:button.dataset.research?({hull:'module-armor',reactor:'module-reactor',salvage:'module-salvage'})[button.dataset.research]:({rail:'rail-turret',interceptor:'interceptor-turret',aegis:'aegis-generator',repair:'repair-generator'})[button.dataset.defenseType];
      if(!asset)continue;assets[asset]=asset;article.classList.add('base-asset-card');const canvas=document.createElement('canvas');canvas.className='base-card-model';canvas.dataset.skillArt=asset;canvas.setAttribute('aria-hidden','true');article.prepend(canvas);
    }
    for(const canvas of scope.querySelectorAll('canvas.base-card-model')){const img=document.createElement('img');img.className='base-card-model';img.src='/assets/meshy/'+canvas.dataset.skillArt+'.png';img.alt='';img.loading='lazy';img.decoding='async';canvas.replaceWith(img);img.closest('article').classList.add('has-meshy-art');}
  }
  function showGrowthPreparation(){show('<section class="overlay-screen departure-screen"><div class="departure-panel"><span class="eyebrow">함선 성장</span><h2>새 함선을 준비하고 있습니다</h2><p role="status" data-growth-status>선택한 성장을 반영하고 있습니다</p><div class="departure-progress" aria-hidden="true"></div><p>준비 중에는 전투 시간과 피해가 멈춥니다.<br>완료되면 전투가 계속됩니다.</p><button class="primary-button" data-action="retry-growth" hidden>다시 준비</button><button class="secondary-button" data-action="cancel-growth" data-autofocus>일시정지로 이동 · ESC</button></div></section>','growth');}
  function growthStatus(text,failed=false){const label=modal.querySelector('[data-growth-status]');if(label)label.textContent=text;const retry=modal.querySelector('[data-action="retry-growth"]');if(retry)retry.hidden=!failed;}
  function showDeparture(index,chapter){const target=(chapter==='andromeda'?ANDROMEDA_STAGES:SOLAR_STAGES)[index];show('<section class="overlay-screen departure-screen"><div class="departure-panel"><span class="eyebrow">SORTIE / PREPARING</span><h2>'+esc(target?.name||'행성')+' 출격 준비</h2><p role="status" data-departure-status>출격 화면을 준비하고 있습니다</p><div class="departure-progress" aria-hidden="true"></div><p>준비 중에는 전투 시간과 피해가 멈춥니다.<br>화면이 열리면 WASD로 이동하고 1~3으로 스킬을 사용하세요.<br>공격은 자동으로 진행됩니다.</p><button class="secondary-button" data-action="cancel-departure" data-autofocus>기지로 돌아가기 · ESC</button></div></section>','departure');}
  function departureStatus(text){const label=modal.querySelector('[data-departure-status]');if(label)label.textContent=text;}
  function showBase(sim) {
    const preparationStart=performance.now();
    const previousTop=modalKind==='base'?modal.querySelector('.base-screen')?.scrollTop||0:0;
    const openGroups=modalKind==='base'?[...modal.querySelectorAll('[data-prep-group][open]')].map(group=>group.dataset.prepGroup):[];
    if(modalKind!=='base')selectedLoadout=null;
    currentBaseSim=sim;
    const content=basePreparationMarkup(sim,{solarPanel:solarBasePanel,defensePanel,selectedLoadout}),markupEnd=performance.now();show(content, 'base');const domEnd=performance.now();
    for(const key of openGroups){const group=modal.querySelector('[data-prep-group="'+key+'"]');if(group)group.open=true;}
    modal.querySelector('.base-screen').scrollTop=previousTop;
    installBaseCardArt();for(const group of modal.querySelectorAll('.prep-group[open]'))group.dataset.artMounted='true';
    const ship=renderShipPreview(modal.querySelector('.base-ship-preview'),sim.meta);let station=null;
    const facilities=modal.querySelector('[data-prep-group="facilities"]');
    for(const group of modal.querySelectorAll('.prep-group'))group.addEventListener('toggle',()=>{
      if(group.open&&!group.dataset.artMounted){group.dataset.artMounted='true';installBaseCardArt(group);}
      if(group===facilities&&sim.campaignDock){if(group.open&&!station)station=renderSpaceBase(group.querySelector('.station-preview'),sim.meta,sim.campaignDock);else if(!group.open&&station){station();station=null;}}
    });
    disposeShipPreview=()=>{station?.();ship();};
    timings.preparation={markupMs:markupEnd-preparationStart,domMs:domEnd-markupEnd,previewScheduleMs:performance.now()-domEnd,totalMs:performance.now()-preparationStart};
  }
  function showDock(meta = currentMeta) {
    currentMeta = { ...currentMeta, ...meta, research: { ...currentMeta.research, ...meta.research } };
    const researches = [
      { id: 'hull', name: '강화 선체', sub: 'HULL REINFORCEMENT', description: '출격할 때 더 단단한 선체로 시작합니다.', gain: '연구당 최대 선체 +20', effect: (lv) => `최대 선체 +${lv * 20}`, base: 70 },
      { id: 'reactor', name: '고효율 반응로', sub: 'REACTOR OPTIMIZATION', description: '전술 스킬을 더 자주 사용할 수 있습니다.', gain: '연구당 스킬 재사용 시간 −5%', effect: (lv) => `스킬 재사용 시간 −${lv * 5}%`, base: 90 },
      { id: 'salvage', name: '잔해 회수 기술', sub: 'SALVAGE ENGINEERING', description: '같은 전투에서도 더 많은 아르켈륨을 회수합니다.', gain: '연구당 획득 아르켈륨 +10%', effect: (lv) => `획득 아르켈륨 +${lv * 10}%`, base: 60 },
    ];
    show(`<section class="dock-screen"><div class="dock-grid"></div><header class="menu-header">${brand()}<button class="text-button" data-action="menu">${icon('arrow', 'back-arrow')} 메인 메뉴</button></header><div class="dock-content"><div class="dock-heading"><div><span class="eyebrow">ORBITAL SHIPYARD / PERMANENT RESEARCH</span><h2>다음 항해를 위한 준비.</h2><p>회수한 아르켈륨로 함선을 연구하세요. 연구는 다음 출격에도 유지됩니다.</p></div><div class="dock-bank">${icon('salvage')}<span>사용 가능한 아르켈륨<strong>${num(currentMeta.bank)}</strong></span></div></div><button class="secondary-button tree-entry" data-action="tree">테크트리 열기 · 무장 / 함대 / 방어 / 기동</button><div class="research-grid">${researches.map((item) => { const lv = clamp(currentMeta.research[item.id], 0, 5); const cost = item.base * (lv + 1) ** 2; const max = lv >= 5; return `<article class="research-card"><span class="eyebrow">${item.sub}</span><div class="research-art">${icon(item.id)}<i></i><i></i></div><div class="research-title"><h3>${item.name}</h3><span>LV. ${lv}<small> / 5</small></span></div><p>${item.description}</p><div class="research-gain">${item.gain}</div><div class="tech-appearance">외형 · ${RESEARCH_VISUALS.find(v=>v.id===item.id).appearance}</div><div class="research-levels">${Array.from({ length: 5 }, (_, i) => `<span class="${i < lv ? 'filled' : ''}"></span>`).join('')}</div><div class="research-current">현재 효과 <b>${lv > 0 ? item.effect(lv) : '아직 연구하지 않았습니다'}</b></div><button class="${max ? 'secondary-button' : 'primary-button'} research-button" data-research="${item.id}" ${max || currentMeta.bank < cost ? 'disabled' : ''}><span>${max ? '연구 완료' : currentMeta.bank < cost ? '아르켈륨이 부족합니다' : '연구하기'}</span><b>${max ? icon('check') : `${icon('salvage')} ${num(cost)}`}</b></button></article>`; }).join('')}</div><div class="dock-bottom"><span>${icon('check')} 연구와 기록은 이 브라우저에 자동 저장됩니다.</span><button class="primary-button" data-action="start" data-autofocus><span>기지에서 출격 준비</span>${icon('arrow')}</button></div></div><footer class="menu-footer"><span>BUILD. REPAIR. EXPAND. SURVIVE.</span><span>ORBITAL DOCK 0${currentMeta.sector || 1} <b>로컬 저장</b></span></footer></section>`, 'dock', currentMeta);
    installBaseCardArt();
    hud.classList.remove('is-playing');
  }
  function toast(message, type = 'info') {
    const currentStack=mount.querySelector('.toast-stack');
    if(currentStack&&[...currentStack.children].some(el=>el.dataset.message===message))return;
    const stack = mount.querySelector('.toast-stack');
    const el = document.createElement('div');
    el.className = `game-toast ${type}`;
    el.dataset.id = ++toastId;el.dataset.message=message;
    el.innerHTML = `${icon(type === 'warning' ? 'shield' : type === 'success' ? 'check' : 'salvage')}<span>${esc(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 350); }, 3300);
    while (stack.children.length > 2) stack.firstElementChild.remove();
  }
  function announce(title, sub = '') {
    const box = mount.querySelector('.screen-announcement');
    clearTimeout(announceTimer);
    box.querySelector('strong').textContent = title;
    box.querySelector('p').textContent = sub;
    box.classList.remove('visible');
    void box.offsetWidth;
    box.classList.add('visible');
    announceTimer = setTimeout(() => box.classList.remove('visible'), 3300);
  }
  function setSound(enabled) {
    soundEnabled = !!enabled;
    mount.querySelectorAll('.sound-button').forEach((button) => {
      const isIcon = button.classList.contains('icon-button');
      button.innerHTML = `${icon(soundEnabled ? 'sound' : 'muted')}${isIcon ? '' : ` ${soundEnabled ? '음향 켜짐' : '음향 꺼짐'}`}`;
      button.setAttribute('aria-label', soundEnabled ? '음향 끄기' : '음향 켜기');
      button.setAttribute('aria-pressed', String(soundEnabled));
    });
  }
  const timings={radar:0};
  function drawRadar(snapshot) {const radarStart=performance.now();const view=tacticalMap.update(snapshot);timings.radar=performance.now()-radarStart;updateRadarDisplay(view);}

  function update(snapshot) {
    timings.radar=0;
    const boundary=snapshot.campaign?.boundary,boundaryAlert=hud.querySelector('.boundary-alert');
    boundaryAlert.hidden=!boundary?.outside;
    if(boundary?.outside){const returnNav=navigationPlan(snapshot);boundaryAlert.classList.toggle('draining',boundary.draining);text('boundaryTitle',boundary.draining?'⚠ 전장 이탈 · 에너지 급감':'⚠ 전장 이탈 · 복귀 유예 '+boundary.grace.toFixed(1)+'초');text('boundaryDetail','경계 밖 '+Math.ceil(boundary.distance)+'m · '+returnNav.direction+' · '+returnNav.height+' · SHIFT 부스트');}

    text('cameraZoom','휠 줌 '+(snapshot.cameraZoom||1).toFixed(2)+'×');
    text('walletBank',num(snapshot.economy?.bank||0));text('walletHelio',num(snapshot.economy?.helionite||0));
    let ore=null,oreDistance=Infinity;for(const mineral of snapshot.minerals||[]){if(mineral.remaining<=0)continue;const p=mineral.position,d=Math.hypot(p.x-snapshot.player.x,p.y-snapshot.player.y,p.z-snapshot.player.z);if(d<oreDistance){ore=mineral;oreDistance=d;}}
    text('mining',ore?'◆ 광맥 '+Math.ceil(oreDistance)+'m · '+(oreDistance<=14?'M 누르고 채굴':'청록 결정에 접근')+' / J 상점 · V 수복 · X 충전':'J 광물 거래소 · V 수복 · X 충전');
    lastSnapshot = snapshot;
    mount.querySelector('.galaxy-entry').hidden=!['galaxy','campaign'].includes(snapshot.mode)||snapshot.phase!=='playing';
    const hostile=mount.querySelector('.hostile-fleet'),leader=snapshot.hostileFleet,advice=snapshot.priorityAdvice;hostile.hidden=!leader||snapshot.phase!=='playing';hostile.classList.toggle('priority-mode',!!advice);if(leader){hostile.style.setProperty('--captain-color',leader.color);const content=advice?'<span>적 전단 · '+esc(advice.leaderName)+' · '+leader.ships+'척</span><strong>우선 공격 · '+esc(advice.name)+' · '+advice.distance+'m</strong><small>'+esc(advice.reason)+'</small><small class="priority-state">수복 '+advice.supports+' / 방패 '+advice.guards+' · '+({hidden:'모델 숨김 · 안내만',behind:'후방 방향 확인',offscreen:'화면 밖 방향 확인',onscreen:'주황 표식에 접근'})[advice.visibility]+'</small>':'<span>HOSTILE / CARRIER · '+leader.ships+'척</span><strong>'+esc(leader.name)+' · '+esc(leader.title)+'</strong><small>'+esc(leader.trait)+'</small><div><i style="width:'+Math.max(0,leader.hp/leader.maxHp*100)+'%"></i></div>';if(values.get('hostile-content')!==content){values.set('hostile-content',content);hostile.innerHTML=content;} }
    const fleet=snapshot.fleet,console=mount.querySelector('.fleet-command');console.hidden=!fleet?.rank||snapshot.phase!=='playing';
    if(fleet?.rank){console.querySelector('.fleet-heading').textContent=fleet.name+' · '+fleet.ships.filter(a=>a.hp>0).length+'/'+fleet.ships.length+'척';console.querySelector('.fleet-next').textContent='T 지휘 전환 · '+(fleet.next?'LV.'+fleet.next+'에서 선단 확장':'최대 편성');const signature=fleet.ships.map(a=>a.id+':'+Math.ceil(a.hp/a.maxHp*10)+':'+Math.ceil(a.disabled)).join(',');if(console.dataset.signature!==signature){console.dataset.signature=signature;console.querySelector('.fleet-vessels').innerHTML=fleet.ships.map(a=>'<span class="fleet-vessel '+(a.hp<=0?'disabled':'')+'" title="'+a.name+' · '+Math.ceil(a.hp)+'/'+Math.ceil(a.maxHp)+(a.disabled?' · 복귀 '+Math.ceil(a.disabled)+'초':'')+'">'+ '<img src="/assets/meshy/'+hullAsset(FLEET_ROLES[a.role]?.ship||'aegis',1)+'.png" alt="'+a.name+'" decoding="async">' +'<i style="width:'+Math.max(0,a.hp/a.maxHp*100)+'%"></i></span>').join('');}for(const button of console.querySelectorAll('[data-fleet-command]'))button.setAttribute('aria-pressed',String(button.dataset.fleetCommand===fleet.command));}
    const dog=snapshot.dogfight||{},alert=mount.querySelector('.dogfight-alert'),evade=mount.querySelector('.evade-button');
    alert.hidden=!dog.missiles&&!dog.tailThreats&&!dog.tailTarget;
    alert.classList.toggle('tail-success',!!dog.tailTarget&&!dog.missiles&&!dog.tailThreats);
    alert.textContent=dog.missiles?'⚠ 유도탄 '+dog.missiles+'발 접근 · Z/C 회피로 추적 해제':dog.tailThreats?'⚠ 후방 적 추적 · 락온 '+Math.round(dog.lock*100)+'% · 고도/방향 변경':dog.tailTarget?'꼬리잡기 성공 · 기관포/유도탄/레이저 피해 +'+Math.round((dog.tailBonus??.3)*100)+'%':'';
    evade.hidden=snapshot.phase!=='playing';evade.disabled=dog.evadeCooldown>0||snapshot.boost<(snapshot.vessel?.evadeCost||25);
    evade.querySelector('.evade-label').textContent=dog.evadeCooldown>0?'Z / C · 회피 '+dog.evadeCooldown.toFixed(1)+'s':snapshot.boost<(snapshot.vessel?.evadeCost||25)?'회피 에너지 부족':'Z / C · 회피 기동 · 추진 '+(snapshot.vessel?.evadeCost||25);
    const baseButton=mount.querySelector('.base-entry');
    const baseDistance=snapshot.player?dist(snapshot.player,BASE_POSITION):0;
    baseButton.hidden=snapshot.phase!=='playing'||!!snapshot.campaign;
    baseButton.textContent=snapshot.galaxyId&&snapshot.galaxyId!=='milky'?'외부 은하 · G에서 정비 기지로 귀환':baseDistance<=(snapshot.baseRange||18)?'F · 기지 입항':'정비 기지 '+Math.round(baseDistance)+'m · 녹색 링으로 귀환';
    baseButton.disabled=baseDistance>(snapshot.baseRange||18);
    const now = performance.now();
    if (now - lastUpdate < 95) return;
    lastUpdate = now;
    const active = ['playing', 'running', 'paused', 'upgrade', 'upgrades', 'base', 'gameover', 'victory'].includes(snapshot.phase);
    hud.classList.toggle('is-playing', active || (snapshot.time > 0 && !['menu', 'dock'].includes(snapshot.phase)));
    hud.classList.toggle('danger', snapshot.hp / snapshot.maxHp < .25);
    if(modalKind==='galaxy'&&snapshot.territory){for(const el of modal.querySelectorAll('[data-war-time]')){const w=snapshot.territory.wars.find(w=>w.id===el.dataset.warTime);const node=el.previousSibling;if(node&&w){node.textContent=node.textContent.replace(/남은 \d+$/, '남은 '+Math.ceil(w.remaining));}}}
    text('objective', (snapshot.actor?.startsWith('pilot-')?'ONLINE · ':'')+snapshot.objective || '함선을 성장시키고 6분간 생존하세요');
    text('time', formatTime(snapshot.time)); text('duration', snapshot.mode==='campaign'?(snapshot.campaign.chapter==='andromeda'?'원정 ':'작전 ')+String((snapshot.campaign.localIndex??snapshot.campaign.index)+1).padStart(2,'0'):snapshot.mode==='galaxy'?'∞':formatTime(snapshot.duration || 360)); text('kills', num(snapshot.kills)); text('scrap', num(snapshot.scrap));
    text('hp', Math.ceil(Math.max(0, snapshot.hp))); text('maxHp', Math.ceil(snapshot.maxHp)); text('shield', Math.ceil(Math.max(0, snapshot.shield))); fill('hpFill', snapshot.hp / snapshot.maxHp); fill('shieldFill', snapshot.shield / snapshot.maxShield);
    const stageNum = typeof snapshot.stage === 'number' ? snapshot.stage + 1 : 1;
    text('stage', String(stageNum).padStart(2, '0')); text('stageName', hullDisplayName(snapshot)); text('stageProgress', `${snapshot.vessel?.name||'아크 선발대'} · LV. ${snapshot.level || 1}`);
    text('level', snapshot.level || 1); text('xp', num(snapshot.xp)); text('xpNeed', num(snapshot.xpNeed)); fill('xpFill', snapshot.xp / snapshot.xpNeed);text('xpCaption',snapshot.campaign?`영구 개조 ${snapshot.campaign.tuningEarned}/${snapshot.campaign.tuningLimit} · 호위 성장`:'다음 증축');
    text('altitude', `${Math.round(snapshot.altitude || 0) > 0 ? '+' : ''}${Math.round(snapshot.altitude || 0)}`); text('speed', Math.round(snapshot.speed || 0)); fill('boostFill', snapshot.boost / (snapshot.boostMax || 100));
    const altitudePercent = `${(clamp(((snapshot.altitude || 0) + (snapshot.mode==='galaxy'?400:65)) / (snapshot.mode==='galaxy'?800:130)) * 100).toFixed(1)}%`;
    if (values.get('altitudeMarker') !== altitudePercent) { hudNodes.altitudeMarker.style.bottom = altitudePercent; values.set('altitudeMarker', altitudePercent); }
    text('fps', Math.round(snapshot.fps || 60)); text('sector', String(snapshot.sector || 1).padStart(2, '0'));
    const weaponsKey = JSON.stringify(snapshot.weapons || []);
    if (values.get('weapons') !== weaponsKey) { values.set('weapons', weaponsKey); hudNodes.weapons.innerHTML = (snapshot.weapons || []).map((weapon) => `<span style="--weapon-color:${esc(weapon.color || '#7cdddf')}"><i></i>${esc(weapon.name)}<b>${weapon.level || 1}</b></span>`).join(''); }
    const skillsKey=(snapshot.skills||[]).map(s=>s.id).join(',');
    if(values.get('skills-layout')!==skillsKey){
      values.set('skills-layout',skillsKey);
      hud.querySelector('.skills').innerHTML='<div class="skill-link-readout"><span class="link-caption">SKILL CHAIN</span><strong class="link-message">1~9 · 전투 스킬</strong><span class="link-timer"></span></div><div class="skill-orbit">'+(snapshot.skills||[]).map((s,i)=>`<button class="skill-card" style="--skill-color:${s.color}" data-skill-index="${i}" aria-keyshortcuts="${s.key}"><svg class="skill-rim" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><circle class="rim-inner" cx="32" cy="32" r="25"/><path d="M24 2h16M24 62h16M2 24v16M62 24v16"/></svg><span class="skill-key">${s.key}</span><span class="skill-icon"><canvas class="skill-model-art" data-skill-art="${s.id}" aria-hidden="true"></canvas><span class="skill-fallback">${icon(normalizedSkill(s.icon||s.id))}</span></span><span class="skill-name"></span><span class="skill-state"></span><span class="skill-cooldown"></span><span class="skill-link-badge">↗</span><span class="skill-ready-gem"></span><span class="skill-tooltip" aria-hidden="true"></span></button>`).join('')+'</div><div class="skill-flow"><span class="overcharge-clock"></span><span>숫자키 / 클릭 · 빛나는 스킬로 연계</span></div>';
      disposeSkillArt?.();disposeSkillArt=installSkillArt(hud);
      skillNodes=[...hud.querySelectorAll('.skill-card')];
    }
    skillNodes.forEach((node, index) => {
      const skill = snapshot.skills?.[index];
      if (!skill) return;
      const remaining = Math.max(0, skill.remaining || 0), isReady = remaining === 0 && skill.learned;
      node.classList.toggle('is-locked',!skill.learned);node.classList.toggle('is-link',!!skill.link&&isReady);node.setAttribute('aria-label',skill.key+' · '+skill.name+' · '+(!skill.learned?'테크트리에서 연구 필요':isReady?'사용 가능':remaining.toFixed(1)+'초 남음')+(skill.link?' · 연계 '+skill.link.name+' · '+skill.link.detail:''));
      node.classList.toggle('on-cooldown', !isReady);
      node.classList.toggle('is-ready', isReady);
      node.setAttribute('aria-disabled', String(!isReady));
      node.dataset.skill = skill.id;
      const name = node.querySelector('.skill-name'); if (name.textContent !== skill.short) name.textContent = skill.short;
      const state = node.querySelector('.skill-state'); const label = !skill.learned?'잠금':isReady?'':remaining<10?remaining.toFixed(1):Math.ceil(remaining)+'s'; if (state.textContent !== label) state.textContent = label;
      node.style.setProperty('--cooldown', `${clamp(remaining / (skill.cooldown || 1)) * 360}deg`);
      node.title = `${skill.key} · ${skill.name} / ${skill.role} · ${!skill.learned?'테크트리 연구 필요':remaining?remaining.toFixed(1)+'초 후 준비':'준비 완료'}${skill.link?' / '+skill.link.name+' · '+skill.link.detail:''}`;
      node.querySelector('.skill-tooltip').textContent=node.title;
    });
    const link=snapshot.skillLink||{},next=(snapshot.skills||[]).filter(s=>s.learned&&s.link);const message=hud.querySelector('.link-message');message.textContent=link.notice?link.notice.name+' · '+link.notice.detail:next.length?'다음: '+next.map(s=>s.key+' '+s.short).join(' / '):link.chain>1?'연계 완료 · 다음 공격을 준비하세요':'1~9 · 스킬로 연계를 시작하세요';hud.querySelector('.link-timer').textContent=link.chain>0?link.chain+' CHAIN · '+link.remaining.toFixed(1)+'s':'';hud.querySelector('.overcharge-clock').textContent=link.overcharge>0?'과충전 '+link.overcharge.toFixed(1)+'s · 쿨타임 회복 ×1.35':link.guard>0?'보호 '+link.guard.toFixed(1)+'s':'7초 안에 다음 스킬';
    const defense=snapshot.defenseAlert||{},raidEl=mount.querySelector('.raid-alert'),raids=defense.raids||[];raidEl.hidden=!raids.length||snapshot.phase!=='playing';const raidKey=JSON.stringify(raids.map(w=>w.id));if(values.get('raidAlert')!==raidKey){values.set('raidAlert',raidKey);raidEl.innerHTML='<strong>긴급 통신 · 내 영토 피습</strong>'+raids.map(w=>`<article><b></b><span class="raid-count"></span><small class="raid-source"></small><button data-defend="${esc(w.id)}"><span class="return-caption"></span><small>추진 25 · 침공당 1회</small></button></article>`).join('');}
    const raidCards=raidEl.querySelectorAll('article');raids.forEach((w,i)=>{const card=raidCards[i];card.querySelector('b').textContent=(w.headquarters?'본부 SOS · ':'')+w.name;card.querySelector('.raid-count').textContent=Math.ceil(w.remaining)+'초 · 적 '+w.attackers+'/'+w.strength+'척';card.querySelector('.raid-source').textContent=(civilizationForOwner(w.attacker)?.name||FACTIONS[Number(w.attacker.split('-')[1])]?.name||'적 조종사')+' 접근 · '+(w.onSite?'현지 방어 중':'지원 함대 요청');const button=card.querySelector('button');button.disabled=!!defense.recall||w.used||snapshot.boost<25;card.querySelector('.return-caption').textContent=defense.recall?.id===w.id?'도약 준비 '+defense.recall.remaining.toFixed(1)+'초':w.used?'귀환 완료 · 직접 방어':w.onSite?'엄호 지점 집결 · H':'선단 긴급 귀환 · H';});
    const cosmicEl=mount.querySelector('.cosmic-alert'),cosmic=(snapshot.cosmic||[]).filter(h=>h.distance<h.radius+80);cosmicEl.hidden=!cosmic.length;cosmicEl.textContent=cosmic.map(h=>({blackhole:'블랙홀',storm:'태양 폭풍',meteor:'유성'}[h.type])+' '+(h.warning>0?'발생 '+h.warning.toFixed(1)+'초':Math.round(h.distance)+'m · '+Math.ceil(h.life)+'초')).join(' / ');
    const bossEl = mount.querySelector('.boss-hud'); bossEl.hidden = !snapshot.boss;
    if (snapshot.boss) { text('bossName', snapshot.boss.name); mount.querySelector('.boss-label').textContent='위협 감지';text('bossTactic',snapshot.boss.status||'');mount.querySelector('.boss-tactic').hidden=!snapshot.boss.status; text('bossHp', `${Math.ceil(clamp(snapshot.boss.hp / snapshot.boss.maxHp) * 100)}%`); fill('bossFill', snapshot.boss.hp / snapshot.boss.maxHp); const hint = mount.querySelector('.incoming-hint'); hint.hidden = !(snapshot.boss.distance > 80); text('bossDistance', `${Math.round(snapshot.boss.distance || 0)} m`); }
    else mount.querySelector('.incoming-hint').hidden = true;
    mount.querySelector('.hud-bottom-left').classList.toggle('hints-faded', snapshot.time > 24);
    if(snapshot.campaign){const dock=hud.querySelector('[data-action=base]')||hud.querySelector('[data-action=enter-base]');if(dock){dock.disabled=true;dock.textContent='지구 정비 · 작전 종료 후 귀환';}const map=mount.querySelector('.galaxy-entry')||mount.querySelector('[data-action=galaxy]');if(map)map.textContent=snapshot.campaign.chapter==='andromeda'?'G · 안드로메다 원정 지도':'G · 태양계 작전 지도';}
    drawRadar(snapshot);
  }
  function restoreHelpPrevious() {
    const previous = modalData;
    if (previous?.kind === 'menu') showMenu(previous.data);
    else if (previous?.kind === 'dock') showDock(previous.data);
    else if (previous?.kind === 'upgrades') showUpgrades(previous.data,upgradeSim);
    else if (previous?.kind === 'end') showEnd(previous.data.result, previous.data.meta);
    else { showPause(); }
  }
  async function onClick(event) {
    const target = event.target.closest('button');
    if (!target || target.disabled) return;
    if(target.dataset.mapScope){tacticalMap.setScope(target.dataset.mapScope);for(const b of mount.querySelectorAll('[data-map-scope]'))b.setAttribute('aria-pressed',String(b===target));if(lastSnapshot)drawRadar(lastSnapshot);return;}
    if(target.dataset.solar!==undefined){hud.classList.add('is-playing');actions.startStage(Number(target.dataset.solar),target.dataset.chapter);return;}
    if(target.dataset.mapFocus){mapFocus=target.dataset.mapFocus==='near';showGalaxy(currentGalaxySim,modalData.regionId);return;}
    if(target.dataset.navigate){navigationTarget=target.dataset.navigate;if(modalKind==='galaxy')showGalaxy(currentGalaxySim,PLANETS.find(p=>p.id===navigationTarget)?.region);return;}
    if(target.dataset.market){actions.tradeItem?.(target.dataset.market,target.dataset.operation);return;}
    if(target.dataset.fleetUpgrade){disposeConfirmation=confirmBaseUpgrade({mount,sim:currentCarrierSim,button:target,fleetSlot:Number(target.dataset.slot),apply:()=>actions.upgradeFleet?.(target.dataset.slot,target.dataset.fleetUpgrade)});return;}
    if(target.dataset.bossInvestment){const q=bossInvestmentReport(currentBaseSim,preparationState(currentBaseSim)).rows.find(q=>q.key===target.dataset.bossInvestment);if(q?.affordable){target.dataset.confirmName=q.name;target.dataset.confirmCost=q.cost;target.dataset.confirmVerb=q.verb;disposeConfirmation=confirmBaseUpgrade({mount,sim:currentBaseSim,button:target,beforeConfiguration:q.beforeConfiguration,afterConfiguration:q.afterConfiguration,noBeforeShip:q.kind==='build',apply:()=>actions.bossInvestment?.(q.key,q.token)});}return;}
    if(target.dataset.fleetCommand){actions.commandFleet?.(target.dataset.fleetCommand);return;}
    if(target.dataset.galaxy){actions.warpGalaxy?.(target.dataset.galaxy);return;}
    if(target.dataset.defenseType){actions.buildDefense?.(target.dataset.defenseTarget,target.dataset.defenseType);return;}
    if(target.dataset.defend){actions.requestDefense?.(target.dataset.defend);return;}
    if(target.dataset.headquarters){actions.designateHeadquarters?.(target.dataset.headquarters);return;}
    if(target.dataset.raid){actions.launchRaid?.(target.dataset.raid);return;}
    if(target.dataset.warp){navigationTarget=target.dataset.warp;actions.warpPlanet?.(target.dataset.warp);return;}
    if(target.dataset.campaignBase){actions.campaignBase?.(target.dataset.campaignBase);return;}
    if(target.dataset.solarBuild||target.dataset.capitalBuild||target.dataset.fleetBuild){
      const kind=target.dataset.solarBuild?'solar':target.dataset.capitalBuild?'capital':'fleet',id=target.dataset.solarBuild||target.dataset.capitalBuild||target.dataset.fleetBuild;
      const transaction=createSolarPurchase(currentBaseSim,kind,id),q=transaction.quote;
      if(!q.eligible){toast(q.reason,'warning');return;}
      target.dataset.confirmName=q.name;target.dataset.confirmCost=q.cost;target.dataset.confirmEffect=q.effect;target.dataset.confirmVerb=q.verb;
      disposeConfirmation=confirmBaseUpgrade({mount,sim:currentBaseSim,button:target,basePreview:kind==='solar',afterConfiguration:q.afterConfiguration,noBeforeShip:kind==='fleet',onCancel:()=>transaction.cancel(),apply:()=>actions.solarPurchase?.(transaction)});return;
    }
    if(target.dataset.capitalSelect){actions.selectCapital?.(target.dataset.capitalSelect);return;}
    if(target.dataset.refitRole){
      const transaction=createFleetRefit(currentCarrierSim,target.dataset.slot,target.dataset.refitRole),q=transaction.quote;
      if(!q.eligible){toast(q.reason,'warning');return;}
      target.dataset.confirmName=q.name;target.dataset.confirmCost=q.cost;target.dataset.confirmEffect=q.effect;target.dataset.confirmVerb=q.verb;
      disposeConfirmation=confirmBaseUpgrade({mount,sim:currentCarrierSim,button:target,fleetSlot:q.slot,onCancel:()=>transaction.cancel(),apply:()=>actions.refitFleetShip?.(transaction)});return;
    }
    if(target.dataset.construction){disposeConfirmation=confirmBaseUpgrade({mount,sim:currentBaseSim,button:target,facility:true,apply:()=>actions.constructBase?.(target.dataset.construction)});return;}
    if(target.dataset.loadoutPlan){if(STARTER_LOADOUTS.some(d=>d.id===target.dataset.loadoutPlan)){selectedLoadout=target.dataset.loadoutPlan;showBase(currentBaseSim);}return;}
    if(target.dataset.baseSection){const group=modal.querySelector('[data-prep-group="'+target.dataset.baseSection+'"]');if(group){group.open=true;group.scrollIntoView({behavior:'smooth',block:'start'});}return;}
    if(target.dataset.baseEquipment){disposeConfirmation=confirmBaseUpgrade({mount,sim:currentBaseSim,button:target,apply:()=>actions.baseEquipment?.(target.dataset.baseEquipment)});return;}
    if(target.dataset.baseService){disposeConfirmation=confirmBaseUpgrade({mount,sim:currentBaseSim,button:target,apply:()=>actions.baseService?.(target.dataset.baseService)});return;}
    if(target.hasAttribute("data-upgrade-confirm")){if(selectedUpgrade){const id=selectedUpgrade;selectedUpgrade=null;actions.chooseUpgrade?.(id);}return;}
    if (target.dataset.upgrade) { previewUpgrade(target.dataset.upgrade); return; }
    if(target.dataset.ship){const meta=actions.selectShip?.(target.dataset.ship);if(meta)showFleet(meta,modalData?.family??-1);return;}
    if(target.dataset.treeFilter){treeFilter=target.dataset.treeFilter;showTree(currentMeta);return;}
    if(target.dataset.tree){const top=modal.querySelector('.tree-screen')?.scrollTop||0;const result=actions.buyTree?.(target.dataset.tree);if(result){showTree(result);modal.querySelector('.tree-screen').scrollTop=top;}return;}
    if (target.dataset.research) {
      const result = await actions.buyResearch?.(target.dataset.research);
      if (result && typeof result === 'object' && 'bank' in result) showDock(result);
      return;
    }
    if (target.dataset.skillIndex != null) { const skill = lastSnapshot?.skills?.[Number(target.dataset.skillIndex)]; if (skill && skill.learned && skill.remaining===0) actions.castSkill?.(skill.id); return; }
    switch (target.dataset.action) {
      case 'market':actions.openMarket?.();break;
      case 'market-close':actions.closeMarket?.();break;
      case 'bank-minerals':actions.bankMinerals?.();break;
      case 'carrier':actions.openCarrier?.();break;
      case 'carrier-close':actions.closeCarrier?.();break;
      case 'galaxy':actions.openGalaxy?.();break;
      case 'galaxy-close':actions.closeGalaxy?.();break;
      case 'evade':actions.evade?.();break;
      case 'enter-base': actions.enterBase?.();break;
      case 'cancel-growth': actions.cancelGrowth?.();break;
      case 'retry-growth': actions.retryGrowth?.();break;
      case 'cancel-departure': actions.cancelDeparture?.();break;
      case 'leave-base': actions.leaveBase?.();break;
      case 'start': hideModal(); hud.classList.add('is-playing'); actions.start?.(); break;
      case 'restart': hideModal(); hud.classList.add('is-playing'); actions.restart?.(); break;
      case 'prepare-expedition': actions.prepareExpedition?.(target.dataset.planEquipment);if(['weapon','survival','escort'].includes(target.dataset.planEquipment))requestAnimationFrame(()=>mount.querySelector('[data-investment-card="'+target.dataset.planEquipment+'"]')?.scrollIntoView({block:'center'}));break;
      case 'resume': actions.resume?.(); break;
      case 'pause': if (modalKind) break; if (actions.pause?.() !== false && modalKind !== 'pause') showPause(); break;
      case 'online':await actions.connectOnline?.();break;
      case 'camera-reset': actions.cameraReset?.();break;
      case 'fleet': {const meta=await actions.openFleet?.();showFleet(meta||currentMeta);break;}
      case 'tree': {const meta=await actions.openTree?.();showTree(meta||currentMeta);break;}
      case 'dock': { const meta = await actions.openDock?.(); showDock(meta && typeof meta === 'object' ? meta : currentMeta); break; }
      case 'menu': { const meta = await actions.openMenu?.(); showMenu(meta && typeof meta === 'object' ? meta : currentMeta); break; }
      case 'sound': { const value = actions.toggleSound?.(); setSound(typeof value === 'boolean' ? value : !soundEnabled); break; }
      case 'help': showHelp(); break;
      case 'help-close': restoreHelpPrevious(); break;
      case 'quit-confirm': show(`<section class="overlay-screen pause-screen"><div class="pause-panel"><span class="eyebrow">ABORT OPERATION</span><h2>이번 작전을 종료할까요?</h2><p>이번 출격에서 회수한 아르켈륨은 저장되지 않습니다.<br>사용한 보급품은 돌아오지 않습니다.${lastSnapshot?.mode==='campaign'?'<br>함선의 선체·실드와 선단 손상은 저장됩니다.':''}<br>이미 완료한 조선소 연구는 유지됩니다.</p><button class="primary-button" data-action="resume" data-autofocus><span>전투 계속하기</span>${icon('arrow')}</button><button class="quiet-button" data-action="menu">종료하고 메뉴로</button></div></section>`, 'confirm'); break;
    }
  }
  function onChange(event) { if (event.target.dataset.setting === 'quality') { quality = event.target.value; actions.setQuality?.(quality); } }
  mount.addEventListener('click', onClick);
  mount.addEventListener('change', onChange);
  return { showGrowthPreparation,growthStatus,showDeparture,departureStatus,beginBattleArt,endBattleArt,skillArtDiagnostics,battleHUDReady:()=>disposeSkillArt?.ready||Promise.resolve(),cancelBattleHUDPreparation(){disposeSkillArt?.();disposeSkillArt=null;endBattleArt();values.delete('skills-layout');},preparationVisible:()=>['base','fleet','carrier'].includes(modalKind),timings,previewUpgrade,update, showCampaign, showMarket, showCarrier, refreshGalaxy, showFleet, showGalaxy, showBase, showMenu, showUpgrades, showPause, showEnd, showDock, showTree, toast, announce, hideModal, setSound, dispose() { disposeConfirmation?.();disposeUpgradeArt?.();disposeSkillArt?.();endBattleArt();clearTimeout(announceTimer); mount.removeEventListener('click', onClick); mount.removeEventListener('change', onChange); mount.innerHTML = ''; } };
}












