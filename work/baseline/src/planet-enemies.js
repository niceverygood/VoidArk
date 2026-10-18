export const PLANET_ENEMIES = Object.freeze({
 mercury:{name:'태양풍 방열 가오리',shape:'radiator',hull:0x635d59,glow:0xffb34d},
 venus:{name:'황산 안개 잠수정',shape:'pressure',hull:0x9b8237,glow:0xdfff61},
 mars:{name:'적철 전갈 전차',shape:'scorpion',hull:0xa3442d,glow:0xff6534},
 jupiter:{name:'대적점 폭풍 거인',shape:'storm',hull:0xb88c64,glow:0xffcc9b},
 saturn:{name:'고리 궤도 수호자',shape:'ring',hull:0xb4a16b,glow:0xffe2a2},
 uranus:{name:'빙결 횡축 감시자',shape:'tilted',hull:0x488f9e,glow:0x9effee},
 neptune:{name:'심해 삼지창 사냥꾼',shape:'trident',hull:0x244f99,glow:0x628aff},
 pluto:{name:'빙암 관문 망령',shape:'shard',hull:0x665869,glow:0xd9c3ff},
 iris:{name:'빙하 날개 파수꾼',shape:'glacier',hull:0x4e9eaf,glow:0xc0ffff},
 nereid:{name:'심해 해파리 수복자',shape:'jellyfish',hull:0x305b81,glow:0x63f9cf},
 prism:{name:'수정 공명 광학체',shape:'crystal',hull:0x8eabc8,glow:0xe0b6ff},
 cinder:{name:'화산 분화구 주조병',shape:'caldera',hull:0x51423a,glow:0xff7826},
 ferrum:{name:'철벽 궤도 공성차',shape:'iron',hull:0x66747c,glow:0xb4d2ee},
 vulcan:{name:'용광로 쌍동 전함',shape:'furnace',hull:0x945d3b,glow:0xffb344},
 vesper:{name:'황혼 초승달 추격자',shape:'crescent',hull:0x514366,glow:0xbd82ff},
 auris:{name:'쌍성 왕관 근위대',shape:'twin',hull:0xafa078,glow:0xffe2fa},
 aetherion:{name:'황좌 공명 천체',shape:'crown',hull:0x80619f,glow:0xdbb1ff}
});
const roleLabel=e=>e.campaignBoss?(e.campaignBoss==='warden'?'수호자':'총독'):e.campaignBase?'궤도 요새':({flagship:'지휘 항모',guard:'방패 호위함',gunner:'포격함',striker:'추격함',support:'수복함'}[e.fleetRole]||'전투함');
export function planetCarrierIdentity(leader){
 const theme=PLANET_ENEMIES[leader.planetTheme];
 if(!leader.planetEnemyLabel||!theme)return leader.captain;
 return {name:leader.planetEnemyLabel,title:'지휘 항모',trait:'행성 봉쇄 전단',color:'#'+theme.glow.toString(16).padStart(6,'0')};
}
export function inheritPlanetEnemy(e,leader){
 if(!leader.planetTheme)return;
 e.planetTheme=leader.planetTheme;
 if(e.enemyAppearance)e.enemyAppearance.planetTheme=leader.planetTheme;
 if(leader.planetEnemyLabel){e.planetEnemyLabel=leader.planetEnemyLabel;e.name=e.planetEnemyLabel+' '+roleLabel(e);}
}
export function applyPlanetEnemy(e,stage){
 const theme=PLANET_ENEMIES[stage.id];if(!theme)return;
 e.planetTheme=stage.id;
 if(e.enemyAppearance)e.enemyAppearance.planetTheme=stage.id;
 if(!stage.chapter){e.planetEnemyLabel=stage.name+' · '+theme.name;e.name=e.planetEnemyLabel+' '+roleLabel(e);}else delete e.planetEnemyLabel;
}
