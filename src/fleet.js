export const FLEET_TIERS=[{level:1,count:0,name:'단독 항해'},{level:6,count:2,name:'호위 전대'},{level:10,count:3,name:'지원 전단'},{level:15,count:5,name:'기동 함대'},{level:22,count:7,name:'전투 선단'},{level:30,count:10,name:'성간 원정 선단'}];
export const FLEET_ROLES={
 frigate:{name:'호위함',hp:240,radius:3,range:85,damage:24,cooldown:1.3,stage:1,scale:.55,ship:'aegis',gear:{cannon:2,shield:1},color:'#89e5dc'},
 support:{name:'수복 지원함',hp:300,radius:3.5,range:65,damage:9,cooldown:2,stage:1,scale:.6,ship:'mule',gear:{shield:2,magnet:2},color:'#9affad'},
 destroyer:{name:'미사일 구축함',hp:420,radius:4,range:105,damage:62,cooldown:3,stage:1,scale:.78,ship:'basilisk',gear:{missile:3,cannon:1},color:'#ffbd82'},
 interceptor:{name:'요격함',hp:170,radius:2.6,range:75,damage:19,cooldown:.7,stage:0,scale:.65,ship:'raptor',gear:{cannon:3},color:'#8ddbff'},
 cruiser:{name:'중장 순양함',hp:700,radius:5.5,range:115,damage:92,cooldown:3.8,stage:2,scale:.7,ship:'hammer',gear:{laser:3,cannon:3,armor:2},color:'#e2b9ff'},
};
export const FLEET_ROSTER=['frigate','frigate','support','destroyer','interceptor','interceptor','cruiser','support','destroyer','cruiser'];
export const FLEET_COMMANDS={assault:{name:'돌격',description:'전방 쐐기 편대 · 사격 속도 +25%'},guard:{name:'엄호',description:'근접 방어 편대 · 적 탄환 요격'},rally:{name:'재집결',description:'후방 대열 · 사격 중지 · 수복 가속'}};
export const fleetRankFor=level=>FLEET_TIERS.reduce((rank,t,i)=>level>=t.level?i:rank,0);
export function fleetFormation(position,heading,index,command='guard',growth=1){
 const sign=index%2?1:-1,row=Math.floor(index/2)+1,spread=(command==='guard'?14:command==='assault'?18:10)*Math.max(1,Math.min(2,growth));
 const x=sign*spread*row,z=command==='assault'?-18-row*9:command==='rally'?22+row*8:8+row*7;
 return {x:position.x+Math.cos(heading)*x+Math.sin(heading)*z,y:position.y+(index%3-1)*6,z:position.z-Math.sin(heading)*x+Math.cos(heading)*z};
}
