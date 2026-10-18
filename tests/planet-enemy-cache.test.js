import test from 'node:test';import assert from 'node:assert/strict';import {createPlanetEnemy} from '../src/models.js';
test('repeated known archetypes share fallback hulls but keep live cores and shields independent',()=>{
 const e={planetTheme:'saturn',fleetRole:'guard',kind:'swarm',radius:3},a=createPlanetEnemy(e),b=createPlanetEnemy(e);
 assert.equal(b.userData.reusedPlanetFallback,true);assert.notEqual(a.userData.core,b.userData.core);assert.notEqual(a.userData.hitFlash.material,b.userData.hitFlash.material);
 const aHull=a.userData.visualRoot.children.find(x=>x.name==='baked-armor'),bHull=b.userData.visualRoot.children.find(x=>x.name==='baked-armor');assert.equal(aHull.geometry,bHull.geometry);
 a.userData.dispose();const c=createPlanetEnemy(e);assert.equal(c.userData.visualRoot.children.find(x=>x.name==='baked-armor').geometry,bHull.geometry);b.userData.dispose();c.userData.dispose();
});
test('unknown roles and unknown boss ranks do not expand the planetary fallback cache',()=>{
 for(const e of [{fleetRole:'custom-unlisted',kind:'carrier'},{campaignBoss:'custom-unlisted',kind:'boss'}]){const a=createPlanetEnemy({...e,planetTheme:'saturn',radius:3}),b=createPlanetEnemy({...e,planetTheme:'saturn',radius:3});assert.equal(a.userData.reusedPlanetFallback,false);assert.equal(b.userData.reusedPlanetFallback,false);a.userData.dispose();b.userData.dispose();}
});
