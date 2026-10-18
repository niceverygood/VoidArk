import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlanetEnemy} from '../src/models.js';
import {PLANET_ENEMIES} from '../src/planet-enemies.js';
const plan=JSON.parse(fs.readFileSync(new URL('../enemy-asset-plan.json',import.meta.url)));
test('bounded generation plan covers every runtime planetary model without player vessel reuse',()=>{
 assert.equal(plan.assets.length,51);assert.equal(new Set(plan.assets.map(a=>a.id)).size,51);assert.equal(plan.maxCredits,1530);
 const planned=new Set(plan.assets.map(a=>a.id));
 for(const planet of Object.keys(PLANET_ENEMIES))for(const e of [{fleetRole:'guard',kind:'swarm'},{fleetRole:'gunner',kind:'sniper'},{fleetRole:'support',kind:'carrier'},{fleetRole:'striker',kind:'interceptor'},{fleetRole:'flagship',kind:'carrier'},{campaignBase:true,kind:'planetBase'},{campaignBoss:'warden',kind:'boss'},{campaignBoss:'crown',kind:'boss'}]){
  const root=createPlanetEnemy({...e,planetTheme:planet,radius:3});assert.ok(planned.has(root.userData.planetAssetId));assert.equal(root.userData.planetAssetId,`enemy-${planet}-${e.campaignBase?'fortress':e.campaignBoss||e.fleetRole==='flagship'?'capital':'fighter'}`);root.userData.dispose();
 }
 assert.ok(plan.assets.every(a=>a.polycount<=10000&&a.prompt.includes('No base')&&a.texture.includes('PBR')));
});
