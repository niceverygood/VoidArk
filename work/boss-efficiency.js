// Controlled QA only: actual Simulation.step rules, fixed gear and finite boss encounter.
// No browser storage, renderer or production hooks. Natural sortie progression is excluded.
import {Simulation,rng,dist,UPGRADE_DEFS} from '../src/sim.js';
import {CAMPAIGN_STAGES,campaignCommanderStats} from '../src/solar-campaign.js';
import {configureAndromedaBoss} from '../src/andromeda-boss.js';
import {bossInvestmentReport,applyBossInvestment} from '../src/boss-investments.js';
import {preparationState} from '../src/base-preparation.js';
import {preparationBudget} from '../src/campaign-economy.js';

export const EFFICIENCY_STAGES=[0,3,8,11,14,16];
export function fixtureMeta(index,profile='growing',noFleet=false){
 const stage=CAMPAIGN_STAGES[index],gear=profile==='novice'?{cannon:1}:profile==='maximum'?Object.fromEntries(UPGRADE_DEFS.map(d=>[d.id,d.maxLevel])):{cannon:2,missile:2,chain:2,laser:2,armor:2,shield:2,reactor:1};
 const roles=stage.system?.id==='veil'?['support','frigate']:stage.system?.id==='crown'?['interceptor','frigate']:['frigate','frigate'];
 return {bank:10000,campaign:{cleared:Math.min(index,8),andromedaCleared:Math.max(0,index-8)},campaignShip:{gear,hp:1,shield:1},fleetRank:noFleet?0:1,spaceBase:{initialized:true,...(noFleet?{}:{sunBuilt:index>=8,facilities:{command:1,shipyard:1},roster:roles})},...(profile==='maximum'?{fleetUpgrades:Array.from({length:10},()=>({weapon:3,armor:3,engine:3,special:3}))}:{})};
}
export function prepareInvestment(meta,seed,category=null,budget=null){
 const sim=new Simulation(structuredClone(meta),seed);sim.openCampaignBase('earth');let spent=0,purchases=[];
 for(let i=0;category&&i<16;i++){
  const state=preparationState(sim),q=bossInvestmentReport(sim,state).rows.find(q=>q.key===category);
  if(!q.affordable||budget!==null&&spent+q.cost>budget)break;
  if(!applyBossInvestment(sim,state,category,q.token))throw Error('confirmed quote failed');
  spent+=q.cost;purchases.push({id:q.id,slot:q.slot,cost:q.cost,level:q.afterLevel,kind:q.kind});
  if(budget===null)break;
 }
 return {sim,spent,purchases};
}
function pilot(sim,boss,policy){
 const p=sim.player,dx=boss.position.x-p.position.x,dy=boss.position.y-p.position.y,dz=boss.position.z-p.position.z,d=Math.hypot(dx,dy,dz)||1;
 const radial=Math.max(-1,Math.min(1,(d-34)/8)),turn=policy==='reactive'?.32:0;
 const input={x:dx/d*radial-dz/d*turn,y:dy/d*radial,z:dz/d*radial+dx/d*turn};
 if(policy==='reactive'){
  const attack=boss.tactics?.attack,missile=sim.shots.some(q=>!q.friendly&&q.type==='enemyMissile'&&dist(q.position,p.position)<23);
  if(attack&&attack.remaining<.36||missile){input.evade=true;input.x=-dz/d;input.y=.3;input.z=dx/d;}
  const pulseRange=24+sim.stage*4+sim.vessel.pulseRadius+sim.tech.pulseRange+boss.radius;
  if(attack&&d<pulseRange)sim.castSkill('pulse');
  if(sim.time>2&&sim.time%28<.04)sim.castSkill('overcharge');
  if(sim.time>3&&sim.time%20<.04)sim.castSkill('barrage');
 }
 return input;
}
export function runEncounter({index,profile='growing',seed=101,policy='reactive',category=null,budget=null,noFleet=false,contested=true,limit=120,dt=1/30,instrument=true}){
 const meta=fixtureMeta(index,profile,noFleet),original=JSON.stringify(meta),{sim,spent,purchases}=prepareInvestment(meta,seed,category,budget),stage=CAMPAIGN_STAGES[index];
 if(!(index<8?sim.startCampaign(index):sim.startExpedition(index-8)))throw Error('stage locked');
 // Retain one real carrier group from the stage, suppress fresh waves/objective/XP changes.
 const leader=sim.enemies.find(e=>e.fleetRole==='flagship');sim.enemies=contested&&leader?sim.enemies.filter(e=>e===leader||e.leaderId===leader.id):[];
 sim.campaign={...sim.campaign,phase:'benchmark',wardenSpawned:true,crownSpawned:true,spawnTimer:Infinity};sim.xpNeed=Infinity;sim.pickups=[];sim.events=[];sim.random=rng(seed);
 // Translate the actual initial formation together; retain each officer's 3D offset.
 const shift=leader?{x:65-leader.position.x,y:-leader.position.y,z:-35-leader.position.z}:{x:0,y:0,z:0};
 for(const e of sim.enemies)for(const axis of ['x','y','z'])e.position[axis]+=shift[axis];
 const boss=sim.spawn('boss',{x:0,y:0,z:-38},false,true);Object.assign(boss,{...campaignCommanderStats(stage),campaignBoss:'crown',name:stage.governor||stage.name+' 총독',cooldown:2});if(stage.system)configureAndromedaBoss(boss,stage);
 const m={incoming:0,hullDamage:0,shieldDamage:0,bossDamage:0,fighterSourceDamage:0,healing:0,fleetHealing:0,fleetShots:0,intercepts:0,fleetDisabled:0,breaks:0,attacks:0,events:{},peakShots:0,peakEnemies:sim.enemies.length,steps:0,stepMs:0,exposedSeconds:0};
 let endHealth=null;
 if(instrument){
  const hit=sim.damageEnemy,damage=sim.damagePlayer,fleet=sim.updateFleet;
  sim.damageEnemy=function(e,amount,source,impact){const hp=e.hp,own=this.player.hp,shield=this.player.shield;hit.call(this,e,amount,source,impact);if(e===boss){const dealt=Math.min(hp,Math.max(0,hp-e.hp));m.bossDamage+=dealt;if(source==='fighter')m.fighterSourceDamage+=dealt;if(e.hp<=0)endHealth={hp:own,shield};}};
  sim.damagePlayer=function(...args){const hp=this.player.hp,shield=this.player.shield;damage.apply(this,args);m.hullDamage+=Math.max(0,hp-this.player.hp);m.shieldDamage+=Math.max(0,shield-this.player.shield);};
  sim.updateFleet=function(step){const hp=this.player.hp,ships=this.fleet.map(s=>({id:s.id,hp:s.hp,max:s.maxHp})),hostiles=new Set(this.shots.filter(s=>!s.friendly&&s.life>0).map(s=>s.id)),ids=new Set(this.shots.map(s=>s.id));fleet.call(this,step);m.fleetShots+=this.shots.filter(s=>s.friendly&&!ids.has(s.id)).length;m.healing+=Math.max(0,this.player.hp-hp);for(const before of ships){const s=this.fleet.find(s=>s.id===before.id);if(s&&before.hp>0)m.fleetHealing+=Math.max(0,s.hp-before.hp-Math.min(before.max-before.hp,step*(this.fleetCommand==='rally'?5:.4)));}const remain=new Set(this.shots.filter(s=>!s.friendly&&s.life>0).map(s=>s.id));m.intercepts+=[...hostiles].filter(id=>!remain.has(id)).length;};
 }
 while(sim.time<limit&&sim.phase==='playing'&&boss.hp>0){
  const input=pilot(sim,boss,policy),at=performance.now();sim.step(dt,input);m.stepMs+=performance.now()-at;m.steps++;
  m.peakShots=Math.max(m.peakShots,sim.shots.length);m.peakEnemies=Math.max(m.peakEnemies,sim.enemies.length);m.exposedSeconds+=boss.tactics?.exposed>0?dt:0;
  for(const e of sim.drainEvents()){m.events[e.type]=(m.events[e.type]||0)+1;if(e.type==='fleetDisabled')m.fleetDisabled++;}
 }
 m.incoming=m.hullDamage+m.shieldDamage;m.breaks=boss.tactics?.breaks||0;m.attacks=boss.tactics?.attacks||0;
 const health=endHealth||{hp:sim.player.hp,shield:sim.player.shield},fleetHp=sim.fleet.reduce((n,s)=>n+s.hp,0),fleetMax=sim.fleet.reduce((n,s)=>n+s.maxHp,0);
 return {index,stage:stage.name,profile,seed,policy,category:category||'baseline',budget,contested,noFleet,spent,purchases,kill:boss.hp<=0,survived:sim.player.hp>0,elapsed:sim.time,killSeconds:boss.hp<=0?sim.time:null,hp:health.hp,shield:health.shield,bossRemaining:Math.max(0,boss.hp),fleetHp,fleetMax,fleetCount:sim.fleet.length,postFightRepairEstimate:Math.ceil(Math.max(0,sim.player.maxHp-health.hp)*.15)+Math.ceil(Math.max(0,sim.player.maxShield-health.shield)*.1)+Math.ceil(Math.max(0,fleetMax-fleetHp)*.02),metaPreserved:JSON.stringify(meta)===original,...m};
}
export function comparisonSuite({seeds=[101,202,303],stages=EFFICIENCY_STAGES,profiles=['novice','growing','maximum'],policies=['novice','reactive'],limit=120}={}){
 const rows=[];
 for(const index of stages)for(const profile of profiles){
  const base=prepareInvestment(fixtureMeta(index,profile),seeds[0]),quotes=bossInvestmentReport(base.sim,preparationState(base.sim)).rows;
  const budget=Math.max(200,...quotes.filter(q=>q.affordable).map(q=>q.cost));
  for(const policy of policies)for(const seed of seeds){
   rows.push(runEncounter({index,profile,policy,seed,limit}));
   for(const category of ['weapon','survival','escort'])for(const amount of [null,budget])rows.push(runEncounter({index,profile,policy,seed,category,budget:amount,limit}));
  }
 }
 return rows;
}
