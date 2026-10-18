import {ENEMY_CAPTAINS} from './enemy-captains.js';

// Campaign command is assigned before carrier/escort creation. Political fleets
// keep their civilization commander; these plans reuse the existing 3D tactics.
export const SOLAR_COMMANDERS=Object.freeze([
 {planet:'mercury',captain:'serin',title:'근일점 포격 사령관',tactic:'siege',trait:'정밀한 계산가 · 장거리 포격',history:'수성의 태양 관측소를 포격 지휘망으로 바꾸었다. 열에 지워지는 항로 기록을 지키려 함대를 멀리 배치한다.',quote:'너의 항로는 이미 계산했다. 사격선 사이의 빈틈을 찾아봐라.',roles:['gunner','gunner','guard','gunner','gunner','guard','gunner','gunner','guard']},
 {planet:'venus',captain:'myra',title:'폭풍 수복망 사령관',tactic:'restore',trait:'집요한 보호자 · 수복 연결',history:'금성의 폭풍 구름 아래 피난 선단을 숨겼다. 흩어진 수복함의 연결이 끊기는 일을 항로의 붕괴로 여긴다.',quote:'한 척이 숨을 쉬는 동안, 우리의 연결은 끝나지 않는다.',roles:['support','support','guard','support','support','striker','support','support','guard']},
 {planet:'mars',captain:'brakk',title:'붉은 궤도 돌격 사령관',tactic:'assault',trait:'성급한 돌파자 · 중장 돌격',history:'화성의 궤도 노동자들이 남긴 장갑을 전단에 두른다. 피난 항로를 막은 함대를 정면에서 밀어낸 기억을 되풀이한다.',quote:'뒤로 물러설 항로는 없다. 붉은 장갑이 먼저 닿을 것이다.',roles:['guard','guard','striker','guard','striker','striker','guard','striker','striker']},
 {planet:'jupiter',captain:'cassian',ship:'dread',title:'대적점 항모 전단 사령관',tactic:'hunter',trait:'끈질긴 포위자 · 중장 항모와 추적탄',history:'목성의 폭풍을 선단의 훈련장으로 삼았다. 장갑 항모를 중심으로 방패와 포격선을 겹쳐 퇴로를 좁힌다.',quote:'폭풍은 길을 열지 않는다. 네가 어느 쪽으로 돌아도 포위는 따라간다.',roles:['guard','guard','gunner','guard','gunner','striker','guard','gunner','support']},
 {planet:'saturn',captain:'valen',title:'고리 방어선 사령관',tactic:'blockade',trait:'신중한 방벽 설계자 · 고리 방패',history:'토성의 고리 사이에 구조 항로를 남겨 두었으나 봉쇄 명령을 거두지 못했다. 방패 호위가 지키는 틈만이 그 항로의 입구다.',quote:'고리는 닫혀 있다. 호위를 넘어서야 내 항로에 닿을 수 있다.',roles:['guard','guard','support','guard','guard','gunner','guard','support','gunner']},
 {planet:'uranus',captain:'iona',title:'빙결 궤도 협공 사령관',tactic:'flank',trait:'조용한 항로 추적자 · 입체 측면 협공',history:'천왕성의 기울어진 궤도에 실종 선단의 좌표를 숨겼다. 앞뒤와 위아래로 흩어진 편대가 접근하는 함선을 교차 추적한다.',quote:'앞만 보고 있군. 돌아오는 신호는 위와 뒤에서 들릴 것이다.',roles:['striker','gunner','support','striker','gunner','striker','striker','gunner','support']},
 {planet:'neptune',captain:'axiom',title:'심해 중력 봉쇄 사령관',tactic:'disrupt',trait:'비정한 항로 관리자 · 중력 봉쇄',history:'해왕성의 중력 항로를 관리하며 관문 사고의 재발을 막는다. 접근하는 방주의 코어를 격리 절차의 위험 신호로 분류했다.',quote:'진입 벡터 차단. 중력 예고 구역에서 즉시 이탈하라.',roles:['guard','gunner','support','guard','gunner','gunner','guard','gunner','support']},
 {planet:'pluto',captain:'null',title:'최후 관문 혼성 전대 사령관',tactic:'mirror',trait:'기원을 시험하는 관찰자 · 혼성 관문 방어',history:'명왕성 관문에 최초 방주의 설계 기록을 보관한다. 방패·추격·포격·수복을 함께 운용해 귀환자의 선택을 시험한다.',quote:'한 역할만 무너뜨려서는 관문이 열리지 않는다. 네가 지킬 것을 보여라.',roles:['guard','striker','gunner','support','guard','striker','gunner','support','guard']}
].map(plan=>Object.freeze({...plan,roles:Object.freeze(plan.roles)})));

export function campaignFleetConfiguration(stage,base){
 if(stage.chapter==='andromeda'){
  const roles=stage.system.id==='veil'?['guard','support','gunner']:stage.system.id==='forge'?['guard','gunner','gunner']:['striker','striker','guard'];
  return {captain:{...base,name:stage.system.faction,title:stage.title,trait:stage.system.doctrine,color:'#'+stage.system.color.toString(16),tactic:stage.system.id==='veil'?'restore':stage.system.id==='forge'?'hunter':'assault',roles:Array.from({length:9},(_,i)=>roles[i%3])},officerFactor:1+stage.index*.09};
 }
 const plan=SOLAR_COMMANDERS.find(p=>p.planet===stage.id);
 if(!plan)return {captain:base};
 const person=ENEMY_CAPTAINS.find(c=>c.id===plan.captain);
 // Preserve the stage's existing HP/fire scaling; the authored change is command,
 // formation, tactic and appearance, rather than a new difficulty multiplier.
 return {captain:{...base,id:'solar-'+stage.id+'-'+person.id,name:person.name,title:plan.title,ship:plan.ship||person.ship,color:person.color,tactic:plan.tactic,trait:plan.trait,history:plan.history,relationship:person.relationship,quote:plan.quote,roles:[...plan.roles]},officerFactor:(slot,nativeFactor)=>slot<base.roles.length?nativeFactor:1+stage.index*.09};
}
