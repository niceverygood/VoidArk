import {civilizationPriority} from './civilizations.js';
export const ARMORS={light:'경량',heavy:'중장갑',energy:'에너지 장갑',bio:'생체',structure:'요새'};
export const WEAPONS={cannon:'기관포',missile:'유도탄',laser:'관통 광선',chain:'아크 방전',fighter:'요격기',pulse:'전자기 펄스',lance:'성간 관통 창',nova:'플라즈마 신성'};
// Rows: light, heavy, energy, bio, structure. Contact and reactor ruptures remain neutral.
export const MATCHUPS={cannon:[1,.7,.8,1.3,.75],missile:[.75,1.4,.75,1,1.5],laser:[1,1.35,.7,.8,1.2],chain:[1.25,.7,1.5,1,.65],fighter:[1.35,.65,.85,1.2,.6],pulse:[1,.8,1.5,1,.7],lance:[.8,1.5,1,1,1.4],nova:[1,.85,.8,1.5,1]};
const types=Object.keys(ARMORS);
export const damageMultiplier=(weapon,armor)=>MATCHUPS[weapon]?.[types.indexOf(armor)]??1;
export const shipArmor=ship=>['light','heavy','heavy','heavy','energy','light'][ship.family]||'light';
export const fleetArmor=role=>({frigate:'heavy',support:'light',destroyer:'heavy',interceptor:'light',cruiser:'energy',guard:'heavy',gunner:'heavy',striker:'light',flagship:'heavy'}[role]||'light');
export const enemyArmor=kind=>({swarm:'light',interceptor:'light',sniper:'light',gravity:'energy',carrier:'heavy',boss:'heavy',planetBase:'structure'}[kind]||'light');
export const planetArmor=p=>({'숲':'bio','빙하':'energy','가스':'energy','화산':'heavy','사막':'structure','해양':'structure'}[p.biome]||'structure');
export function armorAdvice(armor){const rows=Object.entries(WEAPONS).map(([id,name])=>({name,value:damageMultiplier(id,armor)}));return `${ARMORS[armor]} · 취약: ${rows.filter(x=>x.value>1).map(x=>`${x.name} ×${x.value}`).join(' / ')} · 저항: ${rows.filter(x=>x.value<1).map(x=>`${x.name} ×${x.value}`).join(' / ')}`;}
export const RELATIONS=[
{a:'haven',b:'crown',kind:'왕위 경쟁',text:'발렌은 난민 봉쇄로 황권을 지키지만 카시안은 그 실패를 빌미로 함대 지휘권을 빼앗으려 한다.'},
{a:'glass',b:'echo',kind:'기록 동맹',text:'세린은 기억 결정을 공급하고 이오나는 실종 선단의 좌표를 돌려준다. 두 기록 성역은 서로를 공격하지 않는다.'},
{a:'forge',b:'bloom',kind:'공급과 원한',text:'브라크의 엔진은 미라의 생체 냉각재에 의존한다. 미라는 광산 폐수가 숲을 죽인 대가를 요구한다.'},
{a:'haven',b:'forge',kind:'연료 봉쇄',text:'발렌이 연료 수송선을 압류했다. 브라크는 방주 회랑의 검문 요새를 우선 타격한다.'},
{a:'rift',b:'frontier',kind:'창조자와 집행자',text:'널은 액시엄의 격리 명령 원본을 보관한다. 기계군은 서로의 항성문을 방어하며 인간 영토를 노린다.'},
{a:'crown',b:'glass',kind:'기억 약탈',text:'카시안은 정통성을 증명할 왕실 기록을 원하고 세린은 그 기록에 남은 학살 명령을 숨기지 않으려 한다.'},
{a:'bloom',b:'rift',kind:'생명과 격리',text:'액시엄은 군락의 확산을 오염으로 판정했다. 미라의 생체 함대는 격리망을 깨뜨리려 한다.'}
];
export const relationsFor=p=>RELATIONS.filter(r=>r.a===p.region||r.b===p.region);
// Faction 2 and 5 each keep their regional pacts; industrial/biological and imperial/industrial grudges have priority.
export function invasionPriority(attacker,defender){if(attacker===defender)return 0;if(attacker?.startsWith('nation-')||defender?.startsWith('nation-'))return civilizationPriority(attacker,defender);if(!defender?.startsWith('faction-'))return 1.5;const a=Number(attacker.split('-')[1]),b=Number(defender.split('-')[1]);return [[1,3],[3,4],[4,5],[1,2]].some(([x,y])=>a===x&&b===y||a===y&&b===x)?2:1;}
