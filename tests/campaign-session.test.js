import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {closeCampaignSession} from '../src/space-bases.js';

const clearWorld=sim=>{sim.fleet=[];sim.enemies=[];sim.shots=[];};
test('damaged campaign fleet survives quit, cleared menu, and the next preparation until paid maintenance',()=>{
 const s=new Simulation({bank:3789,fleetRank:3,campaign:{cleared:3},spaceBase:{initialized:true},campaignShip:{gear:{chain:1,missile:1}}});
 s.openCampaignBase('earth');s.startCampaign(3);const ship=s.fleet[3];s.damageFleet(ship,25,'cannon');const ratio=ship.hp/ship.maxHp;assert.ok(ratio<1);s.setPaused(true);
 closeCampaignSession(s);s.phase='menu';clearWorld(s);const saved=structuredClone(s.meta);
 closeCampaignSession(s);assert.deepEqual(s.meta,saved);assert.equal(s.campaign,null);
 s.openCampaignBase('earth');assert.equal(s.fleet[3].hp,s.fleet[3].maxHp*ratio);assert.equal(s.meta.bank,3789);assert.equal(s.upgrades.chain,1);assert.equal(s.upgrades.missile,1);
 const cost=s.baseServices().maintenance;assert.ok(cost>8);assert.equal(s.serviceBase('maintenance'),true);assert.equal(s.meta.bank,3789-cost);assert.ok(s.fleet.every(a=>a.hp===a.maxHp&&a.disabled===0));
 closeCampaignSession(s);s.phase='menu';clearWorld(s);closeCampaignSession(s);s.openCampaignBase('earth');assert.ok(s.fleet.every(a=>a.hp===a.maxHp));assert.equal(s.serviceBase('maintenance'),false);assert.equal(s.meta.bank,3789-cost);
});

test('inactive market and dock transitions cannot erase disabled escorts or promote temporary weapons',()=>{
 const s=new Simulation({bank:100,fleetRank:3,campaign:{cleared:3},spaceBase:{initialized:true,fleetHealth:[1,0,.5,1,1]},campaignShip:{gear:{chain:1,missile:1},hp:.6,shield:.2}});
 s.openCampaignBase('earth');assert.equal(s.fleet[1].hp,0);s.upgrades.missile=4;closeCampaignSession(s);const saved=structuredClone(s.meta);clearWorld(s);
 for(const phase of ['menu','market','dock','menu']){s.phase=phase;closeCampaignSession(s);assert.deepEqual(s.meta,saved);}
 const loaded=new Simulation(JSON.parse(JSON.stringify(s.meta)));loaded.openCampaignBase('earth');assert.equal(loaded.fleet[1].hp,0);assert.equal(loaded.fleet[1].disabled,45);assert.equal(loaded.fleet[2].hp,loaded.fleet[2].maxHp*.5);assert.equal(loaded.upgrades.missile,1);assert.equal(loaded.player.hp,loaded.player.maxHp*.6);assert.equal(loaded.player.shield,loaded.player.maxShield*.2);
});
