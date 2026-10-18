export const ANDROMEDA_SYSTEMS=[
 {id:'veil',name:'아스트라 행성계',star:'아스트라 청색성',faction:'유리 항로 연맹',color:0x75dfff,story:'지구의 첫 탐사선이 남긴 신호를 독점한 항로 연맹. 태양계 통일을 위협으로 보고 관문을 봉쇄한다.',relation:'태양계와 교역하던 중개국 → 관문 봉쇄로 적대',doctrine:'에너지 장갑과 수복 호위 · 방전/펄스에 취약'},
 {id:'forge',name:'벨카르 행성계',star:'벨카르 적색성',faction:'철혈 주조 제국',color:0xffa25f,story:'항로 연맹에 전함을 공급하면서 전쟁 채무를 쌓은 산업 제국. 수복 연료를 끊고 요새를 돌파해야 한다.',relation:'연맹의 군수 후원자 · 황좌의 채권자',doctrine:'중장갑 포격 전단 · 유도탄/관통 공격에 취약'},
 {id:'crown',name:'에테르 행성계',star:'에테르 쌍성',faction:'황좌 공명 왕조',color:0xbc98ff,story:'두 세력의 분쟁을 조종해 관문 에너지를 거둬들인 왕조. 마지막 황좌를 격파하면 세 행성계가 항복한다.',relation:'연맹과 제국을 견제시키는 은하 패권국',doctrine:'고속 측면 협공 · 경량 호위부터 기관포/요격기로 정리'},
];
const rows=[
 ['iris','이리스',0x5cbad4,'빙하 관문 봉쇄',4,'energy','glacier','세리온 · 관문 감시자','엘리아 · 유리 항로 총독'],
 ['nereid','네레이드',0x4589bd,'해양 수복 전단',4,'energy','ocean','마레인 · 수복 사령관','테티스 · 심해 군주'],
 ['prism','프리즘',0x9ec8ed,'수정 수도 결전',5,'energy','crystal','리세트 · 공명 수호자','벨리스 · 연맹 의장'],
 ['cinder','신더',0xc26c38,'용광로 포격 전선',5,'heavy','volcano','헤르칸 · 주조 제독','브라가 · 용광로 총독'],
 ['ferrum','페룸',0x8b959e,'철벽 궤도 요새',6,'heavy','metal','카이론 · 철벽 장군','드라벤 · 강철 왕'],
 ['vulcan','불칸',0xd68e4a,'전함 생산 수도',6,'heavy','volcano','레오크 · 함대 제조관','바르크 · 철혈 황제'],
 ['vesper','베스퍼',0x9f79ba,'황혼 추격 전단',6,'light','shadow','네브 · 그림자 추격자','셀렌 · 황혼 총독'],
 ['auris','아우리스',0xc5a1eb,'쌍성 황실 근위대',7,'light','crystal','루시엔 · 황실 근위장','아리아 · 쌍성 여왕'],
 ['aetherion','에테리온',0xcca5ff,'은하 황좌 최종전',8,'heavy','gas','모르가 · 황좌 수호자','아르카온 · 안드로메다 패왕'],
];
export const ANDROMEDA_STAGES=Object.freeze(rows.map(([id,name,color,title,bases,armor,biome,warden,governor],localIndex)=>({id,name,color,title,bases,armor,biome,warden,governor,localIndex,index:localIndex+8,chapter:'andromeda',system:ANDROMEDA_SYSTEMS[Math.floor(localIndex/3)],kills:48+localIndex*4,reward:1100+localIndex*150+(localIndex===8?5000:0),extent:{x:750,y:300,z:750},bossScale:localIndex===8?1.6:1.15})));
