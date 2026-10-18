// Per-sortie, bounded telemetry. No render events, timers, RNG, save keys or balance changes.
export class JupiterRecord{
 constructor(){this.version=1;this.fleets=new Map();this.spawned={carrier:0,support:0,guard:0};this.killed={carrier:0,support:0,guard:0};this.healed=0;this.protectedHits=0;this.hullLoss=0;this.shieldLoss=0;this.playerHits=0;this.cleanCarriers=0;this.firstCarrierSeconds=null;this.untracked=0;}
 carrier(e,time){this.spawned.carrier++;if(this.fleets.size>=64){this.untracked++;return;}this.fleets.set(e.id,{at:time,support:0,guard:0,hadSupport:false,hadGuard:false});}
 officer(e){const f=this.fleets.get(e.leaderId);if(!f||!['support','guard'].includes(e.fleetRole))return;this.spawned[e.fleetRole]++;f[e.fleetRole]++;f[e.fleetRole==='support'?'hadSupport':'hadGuard']=true;}
 heal(amount){if(amount>0)this.healed+=amount;}
 hit(e,guarded){if(guarded&&this.fleets.has(e.id))this.protectedHits++;}
 kill(e,time,enemies){const role=e.fleetRole,key=role==='flagship'?e.id:e.leaderId,f=this.fleets.get(key);if(!f)return;if(role==='flagship'){if(f.dead)return;this.killed.carrier++;if(this.firstCarrierSeconds===null)this.firstCarrierSeconds=Math.max(0,time-f.at);if((f.hadSupport||f.hadGuard)&&!enemies.some(a=>a.hp>0&&a.leaderId===e.id&&['support','guard'].includes(a.fleetRole)))this.cleanCarriers++;f.dead=true;}else if(['support','guard'].includes(role)){this.killed[role]++;f[role]=Math.max(0,f[role]-1);}}
 damage(hull,shield){this.playerHits++;this.hullLoss+=Math.max(0,hull);this.shieldLoss+=Math.max(0,shield);}
 summary(){return {version:this.version,scope:'jupiter',spawned:{...this.spawned},killed:{...this.killed},healed:this.healed,protectedHits:this.protectedHits,hullLoss:this.hullLoss,shieldLoss:this.shieldLoss,playerHits:this.playerHits,cleanCarriers:this.cleanCarriers,firstCarrierSeconds:this.firstCarrierSeconds,untracked:this.untracked};}
}
export function recordFeedback(record){
 if(!record||record.version!==1||record.scope!=='jupiter')return ['상세 공략 기록 없음 · 이전 출격의 호위 성과나 공략 시간은 추정하지 않습니다.'];
 const rows=[];
 if(record.cleanCarriers>0)rows.push(`기록한 전단 ${record.cleanCarriers}개에서 수복·방패 호위가 남아 있지 않은 상태로 항모를 격파했습니다.`);
 if(record.healed>0)rows.push(`적이 실제 회복한 내구도 ${Math.round(record.healed)} · 다음 전투에서는 수복함을 먼저 끊어 보세요.`);
 if(record.protectedHits>0)rows.push(`방패 호위가 적용된 항모 타격 ${record.protectedHits}회 · 22m 안의 방패 호위를 먼저 제거하세요.`);
 if(record.hullLoss>0)rows.push(`누적 선체 손실 ${Math.round(record.hullLoss)} · 강화 전에 수리·실드 예산을 확보하세요.`);
 if(!rows.length)rows.push('추가 공략 판단 근거가 충분하지 않습니다. 기록된 수치와 다음 적 구성을 함께 확인하세요.');
 if(record.untracked)rows.push('전단 상세 기록 한도에 도달했습니다. 기록하지 못한 전단의 순서·시간은 평가하지 않습니다.');
 return rows;
}
