import {PLANETS,planetBases,basesDestroyed} from './galaxy.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function navigationPlan(s,selected){
 if(s.campaign){const c=s.campaign,returning=c.boundary?.outside,target=returning?c.boundary.target:c.target?.position||s.player,dx=target.x-s.player.x,dy=target.y-s.player.y,dz=target.z-s.player.z,a=Math.atan2(-dx,-dz)-(s.heading||0),signed=Math.atan2(Math.sin(a),Math.cos(a));const planet={id:c.id,name:returning?'전장 복귀 지점':c.target?.name||c.name,level:c.index+1,region:'solar',position:target};return {planet,recommended:planet,position:target,distance:distance(target,s.player),step:returning?'경계 안으로 복귀하세요':c.objective,reason:returning?'전장 이탈 · 항로를 따라 복귀':'태양계 정복 작전',direction:(returning||c.target)?(Math.abs(signed)<.35?'정면':Math.abs(signed)>2.5?'뒤로 선회':signed>0?'왼쪽으로 선회':'오른쪽으로 선회'):'사방의 봉쇄 함대 격파',height:Math.abs(dy)<10?'고도 유지':dy>0?'E 상승 '+Math.round(dy)+'m':'Q 하강 '+Math.round(-dy)+'m'};}
 const local=PLANETS.filter(p=>p.galaxy===(s.galaxyId||'milky')),owners=s.territory?.owners||{},actor=s.actor||'player',state=s.conquest||{};
 const raid=s.territory?.wars?.find(w=>w.defender===actor&&local.some(p=>p.id===w.target));
 const candidates=local.filter(p=>owners[p.id]!==actor&&!state[p.id]?.includes('crown'));
 const suitable=candidates.filter(p=>p.level<=(s.level||1)+2),pool=suitable.length?suitable:candidates;
 pool.sort((a,b)=>(state[b.id]?.length>0?1:0)-(state[a.id]?.length>0?1:0)||a.level-b.level||distance(a.position,s.player)-distance(b.position,s.player));
 const recommended=local.find(p=>p.id===raid?.target)||pool[0]||local.find(p=>owners[p.id]===actor)||local[0];
 const planet=local.find(p=>p.id===selected)||recommended;if(!planet)return null;
 const owned=owners[planet.id]===actor,defending=raid?.target===planet.id,remaining=planetBases(planet).filter(b=>!state[planet.id]?.includes(b.index));
 remaining.sort((a,b)=>distance(a.position,s.player)-distance(b.position,s.player));
 const nearby=distance(planet.position,s.player)<320,target=!owned&&nearby&&remaining.length?remaining[0].position:planet.position;
 const step=defending?'적 침공을 막아 영토를 지키세요':owned?'점령한 거점 · 방어와 자원 생산':remaining.length?'방어 기지 '+basesDestroyed(state,planet)+' / '+planet.baseCount+' 격파 → 중간보스 → 우두머리':!state[planet.id]?.includes('warden')?'중간보스 격파 → 행성 우두머리':'행성 우두머리를 격파하면 점령';
 const dx=target.x-s.player.x,dz=target.z-s.player.z,dy=target.y-s.player.y,angle=Math.atan2(-dx,-dz)-(s.heading||0),signed=Math.atan2(Math.sin(angle),Math.cos(angle));
 return {planet,recommended,position:target,distance:distance(target,s.player),step,owned,defending,reason:selected&&selected!==recommended.id?'직접 선택한 목표':owned&&!defending?'현재 은하 정복 완료 · 연결 은하로 원정':raid?'내 영토 피습 · 방어 우선':suitable.length?'현재 레벨에 맞는 미점령 행성':'가장 낮은 난도의 다음 목표',direction:Math.abs(signed)<.35?'정면':Math.abs(signed)>2.5?'뒤로 선회':signed>0?'왼쪽으로 선회':'오른쪽으로 선회',height:Math.abs(dy)<10?'고도 유지':dy>0?'E 상승 '+Math.round(dy)+'m':'Q 하강 '+Math.round(-dy)+'m',nearby};
}
