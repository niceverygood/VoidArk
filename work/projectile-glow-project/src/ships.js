export const SHIP_FAMILIES=[
{id:'scout',name:'정찰 · 요격',color:'#78ddff',shape:[.8,.8,1.2]},
{id:'siege',name:'포격 · 공성',color:'#ffc485',shape:[1.1,1.1,1.4]},
{id:'carrier',name:'항모 · 함대',color:'#bda8ff',shape:[1.5,1,1.1]},
{id:'bulwark',name:'중장갑 · 수호',color:'#83ecc9',shape:[1.3,1.35,.9]},
{id:'science',name:'특수 · 제어',color:'#ff96d7',shape:[1.05,1.1,1.15]},
{id:'salvage',name:'산업 · 지원',color:'#ffe198',shape:[1.15,1.25,1]},
];
const rows=[
['ark','아크 선발대',0,120,55,1,'cannon',0,{},'균형형 기본 함선. 모든 무장을 고르게 성장시킬 수 있습니다.'],
['swift','스위프트',0,80,40,1.5,'cannon',.15,{evadeCost:15,evadeCooldown:5},'속도 +50%, 회피 소모15·대기5초. 가벼운 선체로 접근전을 피하세요.'],
['raptor','랩터',0,100,35,1.3,'missile',.4,{boostEconomy:.25},'유도탄 피해 +40%, 부스트 소모 -25%. 추격과 측면 기동에 특화.'],
['needle','니들',0,75,65,1.35,'laser',.45,{bossDamage:.15},'레이저 +45%, 보스 피해 +15%. 얇고 빠른 관통 공격함.'],
['hammer','해머',1,175,40,.85,'cannon',.45,{bossDamage:.2},'기관포 +45%, 보스 피해 +20%. 강한 함체 대신 느린 기동.'],
['basilisk','바실리스크',1,140,50,.9,'missile',.6,{cooldown:.1},'미사일 +60%, 스킬 대기 -10%. 기지와 대형 표적을 포격.'],
['lance','랜스',1,110,70,1,'laser',.7,{shieldRegen:2},'레이저 +70%, 실드 재생 +1/초 (총량 상한 적용). 긴 포신의 관통 구축함.'],
['dread','드레드노트',1,230,30,.7,'cannon',.6,{bossDamage:.3,evadeCost:35},'기관포 +60%, 보스 +30%. 두꺼운 선체와 무거운 회피 소모35.'],
['nest','네스트',2,130,65,.9,'fighter',.3,{escorts:1},'호위기 피해 +30%, 추가 호위기1대. 함대 운용 입문 항모.'],
['hive','하이브',2,110,55,1,'fighter',.2,{escorts:3},'추가 호위기3대. 많은 전투기로 분산 공격하지만 선체는 가벼움.'],
['seraph','세라프',2,150,95,.8,'fighter',.45,{regen:1},'호위기 +45%, 선체 재생 +1/초. 느리지만 안정적인 함대 지원.'],
['sovereign','소버린',2,180,80,.7,'fighter',.7,{escorts:2,evadeCost:35},'호위기 +70%, 추가2대. 중항모의 강력한 함대와 느린 기동.'],
['aegis','이지스',3,145,130,.85,'cannon',0,{shieldRegen:4},'실드130, 실드 재생 +2/초 (총량 상한 적용). 전선을 오래 유지하는 수호함.'],
['bastion','바스티온',3,260,35,.65,'cannon',.2,{resist:.2},'선체260, 받는 피해 -20%. 가장 느린 장갑 요새함.'],
['paladin','팔라딘',3,160,100,.9,'chain',.35,{regen:1.5},'번개 +35%, 선체 재생 +1.5/초. 근거리 적을 정리하는 수호함.'],
['mirror','미러',3,90,180,1,'laser',.2,{shieldRegen:6},'실드180·재생 +3/초 (총량 상한 적용). 방어막이 무너지면 빠르게 이탈해야 함.'],
['oracle','오라클',4,90,70,1.1,'chain',.55,{cooldown:.2},'번개 +55%, 스킬 대기 -20%. 스킬 순환과 연쇄 공격에 특화.'],
['singularity','싱귤래리티',4,115,65,.9,'chain',.3,{pulseRadius:12,cooldown:.15},'펄스 반경 +12m, 스킬 대기 -15%. 넓은 공간의 탄막을 정리.'],
['phoenix','피닉스',4,125,60,1,'missile',.25,{regen:3,cooldown:.1},'선체 재생 +3/초, 스킬 대기 -10%. 피격 후 거리를 벌려 회복.'],
['chronos','크로노스',4,80,90,1.2,'laser',.3,{cooldown:.3,evadeCooldown:4},'스킬 대기 -30%, 회피 대기4초. 연속 기동으로 낮은 선체를 보완.'],
['mule','뮬',5,180,40,.8,'cannon',0,{magnet:12,salvage:.25},'회수 반경 +12m, 격파 고철 +25%. 견고한 잔해 수집선.'],
['prospector','프로스펙터',5,100,55,1.2,'laser',.2,{magnet:8,salvage:.15},'회수 반경 +8m, 고철 +15%. 빠르게 이동하는 탐사 채굴선.'],
['foundry','파운드리',5,200,70,.7,'fighter',.25,{escorts:1,salvage:.35},'고철 +35%, 추가 호위기1대. 느린 이동식 산업 항모.'],
['wayfarer','웨이페어러',5,125,75,1.1,'missile',.15,{boostEconomy:.4,magnet:6},'부스트 소모 -40%, 회수 반경 +6m. 장거리 항해와 잔해 수집에 특화.'],
];
export const SHIPS=rows.map(([id,name,family,hull,shield,speed,weapon,bonus,perks,description],variant)=>({id,name,family,hull,shield,speed,weapon,bonus,perks,description,variant:variant%4}));
export function shipDefinition(id){return SHIPS.find(s=>s.id===id)||SHIPS[0];}
export function shipStats(id){const s=shipDefinition(id);return {...s,evadeCost:25,evadeCooldown:8,cooldown:0,regen:0,shieldRegen:0,boostEconomy:0,magnet:0,salvage:0,bossDamage:0,resist:0,escorts:0,pulseRadius:0,...s.perks};}
