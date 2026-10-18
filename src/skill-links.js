// Short, intentional links: no automatic casting and no full cooldown resets.
export const SKILL_LINKS=[
 {from:'overcharge',to:'pulse',name:'공명 개방',power:1.4,detail:'펄스 피해 +40%'},
 {from:'pulse',to:'barrage',name:'전자기 추적',power:1.35,detail:'유도탄 피해 +35%'},
 {from:'barrage',to:'nova',name:'폭쇄 점화',power:1.45,detail:'신성 피해 +45%'},
 {from:'nova',to:'pulse',name:'잔열 방전',power:1.2,cooldown:.7,detail:'펄스 피해 +20% · 이번 재사용 -30%'},
 {from:'pulse',to:'stasis',name:'중력 봉쇄',control:1.5,detail:'구속 지속 +1.5초'},
 {from:'stasis',to:'lance',name:'정지 표적 관통',power:1.6,detail:'관통 창 피해 +60%'},
 {from:'stasis',to:'nova',name:'동결 붕괴',power:1.5,detail:'신성 피해 +50%'},
 {from:'overcharge',to:'lance',name:'반응로 직결',power:1.4,detail:'관통 창 피해 +40%'},
 {from:'barrage',to:'countermeasure',name:'역추적 회피',boost:25,detail:'추진 에너지 +25'},
 {from:'countermeasure',to:'repair',name:'안전 재구성',heal:1.5,guard:2,detail:'회복 +50% · 2초 피해 면역'},
 {from:'repair',to:'sentry',name:'정비 출격',escort:5,detail:'긴급 호위대 지속 +5초'},
 {from:'sentry',to:'overcharge',name:'함대 동조',duration:3,detail:'과충전 지속 +3초'},
];
export const LINK_WINDOW=7;
export const SKILL_STYLE={pulse:{color:'#6eeaff',short:'펄스',role:'제어'},barrage:{color:'#ffb66f',short:'폭우',role:'추적'},overcharge:{color:'#ff9bcf',short:'과충전',role:'가속'},nova:{color:'#ff865e',short:'신성',role:'폭발'},stasis:{color:'#b79aff',short:'구속',role:'제어'},repair:{color:'#8effb5',short:'수복',role:'회복'},lance:{color:'#ffdc8d',short:'관통',role:'직선'},countermeasure:{color:'#e6abff',short:'교란',role:'방어'},sentry:{color:'#9fcfff',short:'호위',role:'함대'}};
export const skillLearned=(meta,id)=>['pulse','barrage','overcharge'].includes(id)||meta.tree?.[id]>0;
export function nextLinks(meta,last,time){return last&&time-last.at<=LINK_WINDOW?SKILL_LINKS.filter(r=>r.from===last.id&&skillLearned(meta,r.to)):[];}
export function resolveLink(last,id,time){return last&&time-last.at<=LINK_WINDOW?SKILL_LINKS.find(r=>r.from===last.id&&r.to===id)||null:null;}
