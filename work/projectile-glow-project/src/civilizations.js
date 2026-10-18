// Independent political actors; legacy faction-1..5 saves remain valid.
const rows = [
 ['a','천상 방주국','milky','구조 선단의 항로를 계승한 공화국','피난민 보호와 안전 항로','수복','의료 합금','d'],
 ['b','철의 변경국','andromeda','변경 광부들이 요새 함대를 세웠다','광산 독립과 제련 독점','중장갑','철혈 합금','i'],
 ['c','생명 우주연방','verdant','행성의 신경망과 함선이 공생한다','생태권 확장','재생','생체 섬유','k'],
 ['d','노바 영웅왕국','milky','전쟁 영웅들이 왕관을 나눠 가진 기사국','결투를 통한 항로 통일','돌격','플라즈마 촉매','e'],
 ['e','태양 항해조합','milky','항성 풍력으로 피난선에 연료를 공급했다','항성 에너지 수출','기동','태양 연료','g'],
 ['f','프리즘 승천국','origin','결정에 정신을 보존하는 연구 문명','의식과 기억의 영속','실드','기억 결정','h'],
 ['g','무법 성좌연맹','milky','봉쇄선을 뚫던 사략선들이 독립했다','검문 요새 파괴','기동','암시장 부품','m'],
 ['h','고대 성로제국','origin','선조의 항성 주조소를 복원했다','잃어버린 생산 설계 회수','중장갑','성로 합금','u'],
 ['i','비단별 무역국','andromeda','수송선 가문들이 항로 의회를 설립했다','통행세 없는 교역망','실드','항로 결정','n'],
 ['j','심연 순례국','abyss','블랙홀 너머의 신호를 성지로 삼았다','심연 관문 순례','중력','심연 광석','o'],
 ['k','성가 군체국','verdant','군체들이 합창 신호로 전쟁을 멈췄다','공명망에 모든 군락 연결','재생','공명 포자','l'],
 ['l','백자 정원국','verdant','오염된 식민지를 생체 도자기로 정화했다','정착지 복원','실드','백자 세라믹','v'],
 ['m','유랑 도시연합','milky','모성을 잃은 도시 전체가 우주를 떠돈다','새로운 정착 행성 확보','중장갑','도시 모듈','z'],
 ['n','초광속 회로국','andromeda','도약 경주 기술이 전쟁용으로 전환됐다','가장 빠른 보급 항로 확보','기동','도약 코일','r'],
 ['o','마그네타 기사단','abyss','죽은 항성의 자기장을 무기로 봉인했다','자기장 성역 수호','실드','자성 코어','p'],
 ['p','빙하 표류국','abyss','항성의 소멸에서 냉동 이주선이 살아남았다','열원과 식민지 확보','중장갑','극저온 얼음','q'],
 ['q','월식 관측국','abyss','보이지 않는 함대로 제국의 학살을 기록했다','전쟁 지휘망 감시','기동','광학 결정','y'],
 ['r','사구 대상국','andromeda','사막 광산의 운송대를 국가로 키웠다','광물 수송로 보호','중장갑','중력 모래','s'],
 ['s','오로라 황조','andromeda','관문 관리 가문이 황위를 선포했다','항성문 세금과 황권 유지','실드','오로라 결정','t'],
 ['t','잿불 주조국','andromeda','화산 노동자들이 제국의 병기창을 탈환했다','제련 노동자 해방','돌격','용융 촉매','b'],
 ['u','접힘공간 공방국','origin','관문 붕괴 이후 공간을 꿰매는 기술을 얻었다','고장 난 은하 연결망 복구','중력','공간 실','w'],
 ['v','균사 궤도국','verdant','우주 잔해를 먹는 균사 도시가 자랐다','황폐한 행성 재순환','재생','균사 냉각재','x'],
 ['w','진자 신디케이트','origin','시간 오차를 거래하던 상인들이 무장했다','도약 시계와 계약 지배','기동','시간 결정','ab'],
 ['x','폭풍 성소국','verdant','이온 폭풍 속에 피난민의 성소를 세웠다','폭풍 에너지와 피난처 수호','실드','이온 촉매','c'],
 ['y','황혼 우주제국','abyss','오래된 원정군이 본국과 연락을 끊었다','식민지 재정복','돌격','황혼 장갑','j'],
 ['z','저항 잿불공화국','milky','황조의 학살에서 살아남은 반군들의 국가','제국 봉쇄 해체','돌격','재활용 병기','aa'],
 ['aa','외곽 대상연합','milky','지도 밖 상인들이 피난민을 숨겼다','변경 교역과 난민 항로','기동','탐사 연료','a'],
 ['ab','새벽 기사함대국','origin','붕괴한 관문에서 마지막 구조 명령을 받았다','실종 선단 구조','돌격','새벽 코어','f'],
 ['ac','공허등대 자치국','milky','외곽 대상연합에서 갈라진 등대 수호자들','해적에게 빼앗긴 중계소 탈환','실드','등대 렌즈','aa'],
 ['ad','적색 궤도노동국','andromeda','잿불 주조국의 궤도 노동자들이 독립했다','병기창 이익의 공정 분배','중장갑','적철 합금','t'],
 ['ae','씨앗 방주공화국','verdant','생명 연방의 강제 공생을 거부한 씨앗 보관자들','다양한 생물의 독립 생존','재생','보존 씨앗','l'],
 ['af','무음 기록연방','origin','프리즘 승천국의 기억 검열을 피해 출항했다','학살 기록 공개와 기억 해방','중력','무음 결정','f'],
];
export const CIVILIZATIONS=rows.map(([id,name,galaxy,history,goal,doctrine,resource,ally],index)=>({id,owner:'nation-'+id,name,galaxy,history,goal,doctrine,resource,ally,asset:index<28?id:{ac:'aa',ad:'t',ae:'c',af:'f'}[id],color:['#80e0d8','#ffad72','#c6a1ef','#9bceee','#e6cb8d','#93dfaa'][index%6]}));
export const civilizationForOwner=owner=>CIVILIZATIONS.find(n=>n.owner===owner);
export function civilizationForPlanet(p){const local=CIVILIZATIONS.filter(n=>n.galaxy===p.galaxy);return local[((p.index??Number(p.id.match(/(\d+)$/)?.[1]||0))%local.length+local.length)%local.length];}
export function diplomaticRelation(a,b){if(a===b)return '동일국';const x=civilizationForOwner(a),y=civilizationForOwner(b);if(!x||!y)return '교전';if(x.ally===y.id||y.ally===x.id)return '동맹';const local=CIVILIZATIONS.filter(n=>n.galaxy===x.galaxy),i=local.indexOf(x);if(local[(i+2)%local.length]===y||local[(i+local.length-2)%local.length]===y)return '숙적';return x.resource===y.resource?'자원 경쟁':'경계';}
export function civilizationPriority(a,b){const relation=diplomaticRelation(a,b);return relation==='동일국'||relation==='동맹'?0:relation==='숙적'?3:relation==='자원 경쟁'?2:1;}
export const DOCTRINES={'수복':{tactic:'restore',hp:1,fire:3.8,roles:['support','guard','striker']},'재생':{tactic:'restore',hp:1.15,fire:4,roles:['support','support','striker']},'중장갑':{tactic:'assault',hp:1.5,fire:3.5,roles:['guard','guard','gunner']},'기동':{tactic:'flank',hp:.9,fire:2.7,roles:['striker','striker','gunner']},'돌격':{tactic:'hunter',hp:1.1,fire:2.8,roles:['striker','guard','gunner']},'실드':{tactic:'blockade',hp:1.3,fire:3,roles:['guard','gunner','support']},'중력':{tactic:'disrupt',hp:1.05,fire:3.4,roles:['gunner','support','guard']}};
export function nationAssetForPlanet(p,owner){return (civilizationForOwner(owner)||civilizationForPlanet(p)).asset;}
