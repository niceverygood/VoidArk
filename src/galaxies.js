// Galaxy coordinates are separated by empty intergalactic space; gates connect local worlds.
export const GALAXIES=[
 {id:'milky',name:'우리 은하 · 방주 고향',color:'#61dfff',offset:{x:0,y:0,z:0},tier:0,links:['andromeda','verdant'],story:'흩어진 이주 선단을 다시 모으는 출발점. 방주 정비 기지가 모든 원정의 귀환항이다.'},
 {id:'andromeda',name:'안드로메다 · 황금 전선',color:'#ffbb72',offset:{x:120000,y:0,z:0},tier:1,links:['milky','abyss'],story:'제국의 원정 조선소가 은하 전체의 항로를 봉쇄했다. 더 강한 방어 기지와 우두머리를 돌파하라.'},
 {id:'verdant',name:'청록 은하 · 생명의 바다',color:'#83ffc1',offset:{x:0,y:0,z:120000},tier:2,links:['milky','abyss','origin'],story:'살아 있는 항성문이 공생체 함대를 연결한다. 고난도 군락을 점령해 방주의 생산 영역을 넓혀라.'},
 {id:'abyss',name:'심연 은하 · 검은 왕관',color:'#ba8cff',offset:{x:120000,y:0,z:120000},tier:3,links:['andromeda','verdant','origin'],story:'망각 기계군의 장갑 요새가 밀집한 암흑 항로. 은하 끝의 지배자를 쓰러뜨려 봉인을 해제하라.'},
 {id:'origin',name:'시원 은하 · 첫 번째 문',color:'#ff92be',offset:{x:240000,y:0,z:60000},tier:4,links:['verdant','abyss'],story:'모성의 마지막 신호가 도착한 미지의 은하. 가장 강한 방어군과 왕관 우두머리들이 방주의 귀환을 기다린다.'},
];
export const galaxyDefinition=id=>GALAXIES.find(g=>g.id===id)||GALAXIES[0];
export const cleanDiscoveries=value=>['milky',...GALAXIES.slice(1).filter(g=>Array.isArray(value)&&value.includes(g.id)).map(g=>g.id)];
