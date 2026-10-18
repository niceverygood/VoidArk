// One bounded, numeric-only campaign record. No samples per frame, RNG or UI work.
const finite=(v,max=2e6)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
const rounded=v=>Math.round(finite(v)*100)/100;
const causes=['projectile','beam','contact','gravity','boundary','other'];
const signatureKeys=['ship','research','base','tree','fleetRank','fleetUpgrades'];
const stable=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export function sortieConfiguration(meta){
 const input=Object.fromEntries(signatureKeys.map(k=>[k,meta[k]??null]));input.gear=meta.campaignShip?.gear??null;input.tuning=meta.campaignShip?.tuning??null;
 const b=meta.spaceBase||{};input.solar={sunBuilt:!!b.sunBuilt,facilities:b.facilities||{},capital:b.capital||null,roster:b.roster||[]};
 let hash=2166136261;for(const c of JSON.stringify(stable(input))){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');
}
export function cleanSortieRecord(value){
 if(!value||value.version!==1||!Number.isInteger(value.stage)||value.stage<0||value.stage>16||!['victory','defeat'].includes(value.outcome)||!/^[0-9a-f]{8}$/.test(value.configuration||''))return null;
 const record={version:1,stage:value.stage,outcome:value.outcome,at:finite(value.at,4e12),run:Math.floor(finite(value.run,1e8)),configuration:value.configuration,duration:rounded(value.duration),kills:Math.floor(finite(value.kills)),hull:rounded(value.hull),shield:rounded(value.shield),causes:Object.fromEntries(causes.map(k=>[k,rounded(value.causes?.[k])])),fleetLoss:rounded(value.fleetLoss),fleetDisabled:Math.floor(finite(value.fleetDisabled)),intercepts:Math.floor(finite(value.intercepts)),supportHull:rounded(value.supportHull),supportShield:rounded(value.supportShield),supportFleet:rounded(value.supportFleet),bosses:[]};
 const bosses=Array.isArray(value.bosses)?value.bosses.slice(0,2):[];
 for(const rank of ['warden','crown']){const b=bosses.find(b=>b?.rank===rank);if(b)record.bosses.push({rank,seen:true,defeated:b.defeated===true,hits:Math.floor(finite(b.hits)),damage:rounded(b.damage),deviceDamage:rounded(b.deviceDamage),device:Math.floor(finite(b.device)),interrupt:Math.floor(finite(b.interrupt)),attack:Math.floor(finite(b.attack))});}
 return record;
}
export class SortieRecord{
 constructor(stage){this.stage=stage;this.hull=0;this.shield=0;this.causes=Object.fromEntries(causes.map(k=>[k,0]));this.fleetLoss=0;this.fleetDisabled=0;this.intercepts=0;this.supportHull=0;this.supportShield=0;this.supportFleet=0;this.bosses=[];}
 boss(e){const rank=e.campaignBoss==='warden'?'warden':'crown';let b=this.bosses.find(b=>b.rank===rank);if(!b){b={rank,seen:true,defeated:false,hits:0,damage:0,deviceDamage:0,device:0,interrupt:0,attack:0};this.bosses.push(b);}return b;}
 hitBoss(e,hp,guard){const b=this.boss(e);b.hits++;b.damage+=Math.min(hp,Math.max(0,hp-e.hp));b.deviceDamage+=Math.max(0,guard-(e.tactics?.guard||0));if(e.hp<=0)b.defeated=true;}
 opening(e,kind){this.boss(e)[kind]++;}
 damage(hull,shield,source){this.hull+=Math.max(0,hull);this.shield+=Math.max(0,shield);const key=source==='projectile'?'projectile':source==='andromedaBeam'||source==='solarBeam'?'beam':source==='contact'?'contact':source==='gravity'?'gravity':source==='boundary'?'boundary':'other';this.causes[key]+=Math.max(0,hull)+Math.max(0,shield);}
 finish(sim,victory,at=Date.now()){return cleanSortieRecord({version:1,stage:this.stage,outcome:victory?'victory':'defeat',at,run:sim.meta.runs,configuration:sortieConfiguration(sim.meta),duration:sim.time,kills:sim.kills,hull:this.hull,shield:this.shield,causes:this.causes,fleetLoss:this.fleetLoss,fleetDisabled:this.fleetDisabled,intercepts:this.intercepts,supportHull:this.supportHull,supportShield:this.supportShield,supportFleet:this.supportFleet,bosses:this.bosses});}
}
