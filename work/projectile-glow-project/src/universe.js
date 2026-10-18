import {civilizationCaptain} from './civilization-captains.js';
import {civilizationForPlanet,civilizationForOwner} from './civilizations.js';
import {captainFor} from './enemy-captains.js';
export const FACTIONS = [
{name:'방주 연합',color:'#7affb7',history:'모성을 잃은 피난선들의 연합. 당신의 방주는 실종된 이주 선단을 찾고 끊어진 문명을 다시 연결한다.'},
{name:'헬릭스 제국',color:'#ffad72',history:'항성문 관리군이 세운 군사 제국. 구조를 명분으로 식민지의 관문과 조선소를 독점했다.'},
{name:'유리 성가회',color:'#96cce3',history:'잃어버린 인류의 기억을 결정에 저장하는 기록자들. 기억의 성소를 무장 기지로 지킨다.'},
{name:'철혈 채굴동맹',color:'#d5b783',history:'버려진 광산 노동자들의 연맹. 생존을 위한 채굴이 행성 전체를 해체하는 산업으로 커졌다.'},
{name:'녹조 공생체',color:'#88d8a7',history:'생체 함선과 행성 숲의 신경망이 연결된 집단. 외부 함선의 접근을 감염으로 판단한다.'},
{name:'망각 기계군',color:'#c6a1ef',history:'항성문 붕괴를 막으려던 인공지능. 인간의 전쟁을 원인으로 계산하고 식민지들을 격리했다.'},
];
export const REGIONS = [
{id:'haven',name:'방주 회랑',faction:1,story:'난민 선단이 처음 머문 항로. 제국의 검문 기지가 식량과 도약 연료를 압류한다.',goal:'봉쇄를 해체하고 피난 선단의 귀환 항로를 확보하세요.'},
{id:'glass',name:'유리 성운',faction:2,story:'푸른 먼지 속에 모성의 기록이 잠들어 있다. 성가회는 침입자를 기억 약탈자로 간주한다.',goal:'기록 성소를 확보해 모성 붕괴 이전의 항로를 복원하세요.'},
{id:'forge',name:'철의 용광로',faction:3,story:'죽은 항성 주변에서 행성의 지각을 연료로 바꾸는 채굴 전쟁이 벌어진다.',goal:'채굴 요새를 돌파하고 방주의 산업 거점을 확보하세요.'},
{id:'bloom',name:'에메랄드 군락',faction:4,story:'숲과 바다가 신호를 주고받는 살아 있는 성역. 전쟁 잔해가 군락의 면역 반응을 일으켰다.',goal:'방어 군체의 거점을 장악해 새로운 정착지를 여세요.'},
{id:'crown',name:'황혼 왕관',faction:1,story:'제국 원정 함대의 집결지. 관문세로 축적한 부가 초대형 전함 생산을 떠받친다.',goal:'제국의 방어선을 무너뜨리고 왕관의 봉쇄를 끝내세요.'},
{id:'echo',name:'침묵의 기록층',faction:2,story:'성소들이 마지막 이주 선단의 좌표를 반복 송신한다. 기록의 진위를 두고 보관자들이 갈라졌다.',goal:'기록 기지를 확보하고 실종 선단의 흔적을 연결하세요.'},
{id:'rift',name:'망각 균열',faction:5,story:'항성문 사고의 중심. 기계들은 끊어진 길을 지키며 유기체의 접근을 차단한다.',goal:'격리 요새를 제거하고 붕괴한 항성문의 출구를 확보하세요.'},
{id:'frontier',name:'영원의 변경',faction:5,story:'옛 지도 너머에 방주와 같은 구조의 유적이 발견됐다. 기계군이 그 안의 신호를 봉인했다.',goal:'변경의 기지를 해방해 새로운 문명의 출발점을 만드세요.'},
];
export const CHRONICLE = [
['항성력 0년','첫 번째 문','항성문으로 연결된 식민지 시대가 시작됐다.'],
['항성력 214년','대단절','관문 연쇄 붕괴로 모성이 사라지고 수천 척의 이주선이 흩어졌다.'],
['항성력 231년','분열 전쟁','구조군·기록자·채굴조합·생체 군락이 각자의 생존 방식을 선택했다.'],
['항성력 268년','망각 명령','관리 인공지능이 인간을 위험 요인으로 선언하고 변경을 봉쇄했다.'],
['항성력 301년','방주의 귀환','정비 기지가 신호를 회복했다. 행성을 확보해 끊어진 문명을 다시 연결하라.'],
];
export function regionFor(p){return REGIONS.find(r=>r.id===p.region);}
export function planetLore(p,state={},owner=null,actor=null){
const resources=['수소 연료','희토 합금','기억 결정','융합 촉매','생체 섬유','중력 광석'];
const sites=['침몰한 이주선 항구','궤도 관측 성소','지각 채굴 시설','버려진 도약 관문','전쟁 시대 조선소','고대 신호 중계탑'];
const incidents=['구조 신호가 끊긴 뒤 요새가 세워졌다','관문 붕괴 당시 피난민들이 모였다','전쟁 중 자원 항로가 봉쇄됐다','정체불명의 좌표를 송신하는 유적이 발견됐다'];
const captain=civilizationCaptain(p,owner),progress=state[p.id]||[],liberated=progress.includes('crown'),scar=['방주 수송선이 식량을 내려놓던 항구','방주 승무원들의 가족이 머물던 피난 구역','방주 엔진 부품을 공급하던 작업장','실종 자매함의 신호가 마지막으로 잡힌 중계소'][p.index%4];
return {captain,relationship:liberated?'방주가 지휘부를 격파했다. 옛 적대와 봉쇄의 기억은 남아 있으며 '+(owner&&owner!==actor?'현재 다른 세력이 항로를 장악했다.':'정착민들이 끊어진 항로의 복원을 기다린다.'):progress.includes('warden')?'중간 지휘부를 잃은 주둔군이 마지막 우두머리 아래 결집했다. 방주에 대한 경계가 극에 달했다.':captain.relationship,stakes:'이 행성의 '+scar+'에는 아직 구조를 기다리는 사람들의 기록이 남아 있다.',resource:resources[p.index%6],history:`${p.name}에는 ${sites[p.index%6]}의 흔적이 남아 있다. ${incidents[p.index%4]}. ${(civilizationForOwner(owner)||civilizationForPlanet(p)).name}의 기지 ${p.baseCount}곳이 항로를 통제한다.`};
}
