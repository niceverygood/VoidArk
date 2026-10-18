// Presentation from accepted damage only. Does not sample RNG or change combat.
const positive=n=>Number.isFinite(n)?Math.max(0,n):0;
// These are emitted damage sources, not inferred weapon types.
const sourceGuides=Object.freeze({projectile:'적 탄환 · 회피',solarBeam:'보스 주포 · 사선 이탈',andromedaBeam:'보스 주포 · 사선 이탈',titanBeam:'보스 주포 · 사선 이탈',contact:'접촉 · 거리 벌리기',gravity:'중력장 · 범위 이탈',meteor:'운석 · 경로 이탈',storm:'우주 폭풍 · 범위 이탈',blackhole:'블랙홀 · 범위 이탈'});
export function receivedImpactText(response){
 const state=response.kind==='break'?'방어막 파괴'+(response.hull?' · 선체 −'+Math.ceil(response.hullAmount):''):response.hull?'선체 피격 −'+Math.ceil(response.hullAmount):'방어막 충격 −'+Math.ceil(response.shielded);
 const guide=Object.hasOwn(sourceGuides,response.source)?sourceGuides[response.source]:'';
 return state+(guide?' · '+guide:'');
}
export function receivedImpact(event={},reduced=false){
 const amount=positive(event.amount),shielded=Math.min(amount,positive(event.shielded)),hull=amount-shielded;
 const broken=amount>0&&shielded>0&&event.shieldBreak===true,kind=broken?'break':hull>0?'hull':'shield',s=Math.min(1,Math.sqrt(amount/70)),active=amount>0;
 const life=kind==='break'?.42:kind==='hull'?.24+s*.2:.18+s*.18;
 const opacity=kind==='break'?.42:kind==='hull'?.14+s*.25:.08+s*.16;
 const source=typeof event.source==='string'&&Object.hasOwn(sourceGuides,event.source)?event.source:'unknown';
 return {active,amount,shielded,hullAmount:hull,kind,source,hull:hull>0,severity:s,reduced,life:active?(reduced?Math.min(.2,life):life):0,opacity:active?opacity*(reduced?.6:1):0,
  kick:active&&!reduced?(kind==='break'?.48+s*.12:kind==='hull'?.1+s*.4:.055+s*.22):0,
  energy:active&&!reduced?(kind==='break'?.12:kind==='hull'?.025+s*.075:.015+s*.055):0,
  sound:hull>0?'damage':'shield',volume:active?(kind==='break'?1.15:kind==='hull'?.6+s*.55:.4+s*.55):0,
  scale:.45+s*.55,burst:active?Math.min(reduced?12:82,Math.round((hull>0?28:18)+(hull>0?54:42)*s)):0,
  size:hull>0?1.8+s*2.2:1.2+s*1.7,spill:hull>0&&shielded>0,spillBurst:reduced?0:Math.round(8+s*16),
  flash:active&&hull>0&&!reduced,pulse:active&&shielded>0&&!reduced,lightLife:active?.035+s*.1:0};
}
