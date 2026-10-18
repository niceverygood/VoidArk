import test from 'node:test';import assert from 'node:assert/strict';import {beginPlanetAssetReadiness} from '../src/planet-enemy-readiness.js';
test('discarded planetary model settles without waiting for an ignored GLB callback',async()=>{
 let released=0;const root={userData:{dispose:()=>released++}},gate=beginPlanetAssetReadiness(root);root.userData.dispose();root.userData.dispose();assert.equal(await root.userData.assetReady,false);assert.equal(released,1);assert.equal(gate.complete(true),false);
});
test('successful and unavailable planetary loads settle once and retain disposal ownership',async()=>{
 for(const success of [true,false]){let released=0;const root={userData:{dispose:()=>released++}},gate=beginPlanetAssetReadiness(root);assert.equal(gate.complete(success),true);root.userData.dispose();assert.equal(await root.userData.assetReady,success);assert.equal(gate.complete(!success),false);assert.equal(released,1);}
});
