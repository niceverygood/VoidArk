import test from 'node:test';import assert from 'node:assert/strict';import {Simulation,v} from '../src/sim.js';import {SKILL_LINKS} from '../src/skill-links.js';
const setup=()=>{const s=new Simulation({tree:{nova:1,stasis:1,repair:1,lance:1,countermeasure:1,sentry:1}});s.start('galaxy');s.enemies=[];s.shots=[];s.pickups=[];s.spawnTimer=999;return s;};
test('twelve distinct researched links advertise followups and amplify actual outgoing missiles and cooldowns',()=>{
 assert.equal(SKILL_LINKS.length,12);assert.equal(new Set(SKILL_LINKS.map(x=>x.from+':'+x.to)).size,12);const s=setup(),e=s.spawn('carrier',v(0,0,-15));e.hp=e.maxHp=10000;
 assert.ok(s.castSkill('overcharge'));assert.ok(s.snapshot().skills.find(x=>x.id==='pulse').link);assert.ok(s.castSkill('pulse'));assert.equal(s.linkChain,2);assert.ok(s.snapshot().skills.find(x=>x.id==='barrage').link);assert.ok(s.castSkill('barrage'));assert.equal(s.linkChain,3);assert.ok(s.shots.filter(x=>x.type==='missile').every(x=>Math.abs(x.damage-38*s.power()*1.35)<.001));
 const fresh=setup();fresh.castSkill('nova');fresh.castSkill('pulse');assert.ok(Math.abs(fresh.skillTimers.pulse-12*fresh.cooldownFactor()*.7)<.001);assert.equal(fresh.snapshot().skills.find(x=>x.id==='pulse').cooldown,fresh.skillTimers.pulse);
});
test('link expiry, invalid casts and paused time cannot award or extend a chain; cooldown recovery accelerates only in combat',()=>{
 const s=setup();s.castSkill('overcharge');const before=s.skillTimers.overcharge,last={...s.lastSkill};assert.equal(s.castSkill('overcharge'),false);assert.deepEqual(s.lastSkill,last);s.setPaused(true);s.step(.05,{});assert.equal(s.skillTimers.overcharge,before);s.setPaused(false);s.step(.05,{});assert.ok(Math.abs(s.skillTimers.overcharge-(before-.05*1.35))<.001);
 s.time=last.at+7.01;s.castSkill('pulse');assert.equal(s.linkChain,1);assert.equal(s.linkNotice,null);const locked=new Simulation();locked.start('galaxy');assert.equal(locked.castSkill('nova'),false);assert.equal(locked.snapshot().skills.find(x=>x.id==='nova').learned,false);assert.equal(locked.lastSkill,null);
});
test('defensive chain restores real HP, adds finite protection and escort linkage prolongs actual temporary allies',()=>{
 const s=setup();s.player.hp=1;s.player.shield=0;s.castSkill('countermeasure');s.castSkill('repair');assert.ok(s.player.hp>1+(35+s.tech.repair)*(1+s.tech.repairPower));assert.equal(s.comboGuard,2);const hp=s.player.hp;s.damagePlayer(100);assert.equal(s.player.hp,hp);for(let i=0;i<41;i++)s.step(.05,{});s.damagePlayer(10);assert.ok(s.player.hp+s.player.shield<hp+53);
 const escort=setup();escort.castSkill('repair');escort.castSkill('sentry');assert.ok(escort.allies.some(a=>a.expires===17));escort.castSkill('overcharge');assert.equal(escort.player.overcharge,11+escort.tech.overTime);
});
test('control to precision amplifies aligned actual 3D hits without damaging distant or elevated enemies',()=>{
 const s=setup(),front=s.spawn('carrier',v(0,0,-20)),high=s.spawn('carrier',v(0,30,-20));front.armor='neutral';front.hp=front.maxHp=high.hp=high.maxHp=10000;s.castSkill('stasis');assert.ok(front.stun>0);s.castSkill('lance');assert.ok(Math.abs(10000-front.hp-(140+s.tech.lance)*s.power()*1.6)<.001);assert.equal(high.hp,10000);assert.equal(s.linkNotice.name,'정지 표적 관통');
});
