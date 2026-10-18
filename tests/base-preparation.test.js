import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {preparationState,equipmentEffect,basePreparationMarkup} from '../src/base-preparation.js';

test('Mercury equipment panel exposes starter choices without spending and later stages retain their boss investments',()=>{
 const s=new Simulation();s.openCampaignBase('earth');const before=structuredClone(s.meta),panels={solarPanel:()=>'',defensePanel:()=>'',selectedLoadout:'spread'};
 const first=basePreparationMarkup(s,panels);assert.match(first,/data-loadout-plan="spread"/);assert.match(first,/data-base-equipment="chain"/);assert.match(first,/조합 전체가 자동 구매되지 않습니다/);assert.deepEqual(s.meta,before);
 s.meta.campaign={cleared:1};const next=basePreparationMarkup(s,panels);assert.doesNotMatch(next,/data-loadout-plan=/);assert.match(next,/data-boss-investment="weapon"/);
});
test('shield equipment installation and shield charging are separate atomic operations',()=>{
 const s=new Simulation({bank:100});s.openCampaignBase('earth');const bank=s.meta.bank,max=s.player.maxShield,cost=s.equipmentCost('shield');
 assert.equal(s.installEquipment('shield'),true);assert.equal(s.player.maxShield,max+25);assert.equal(s.upgrades.shield,1);assert.equal(s.meta.campaignShip.gear.shield,1);assert.equal(s.meta.bank,bank-cost);
 s.player.shield=0;const before=s.meta.bank,charge=s.baseServices().shield;assert.equal(s.serviceBase('shield'),true);assert.equal(s.player.shield,s.player.maxShield);assert.equal(s.player.maxShield,max+25);assert.equal(s.upgrades.shield,1);assert.equal(s.meta.bank,before-charge);
 s.meta.bank=0;assert.equal(s.installEquipment('shield'),false);assert.equal(s.upgrades.shield,1);assert.equal(s.player.maxShield,max+25);
});
test('preparation explains damage without blocking legal launches and chooses the actual next stage',()=>{
 const s=new Simulation();s.openCampaignBase('earth');let state=preparationState(s);assert.equal(state.next.name,'수성');assert.equal(state.money,80);s.player.hp=30;assert.equal(preparationState(s).damaged,true);
 s.meta.campaign={cleared:3};assert.equal(preparationState(s).next.name,'목성');s.meta.campaign={cleared:8,andromedaCleared:4};state=preparationState(s);assert.equal(state.chapter,'andromeda');assert.equal(state.index,4);
 assert.equal(s.startExpedition(state.index),true);assert.equal(s.campaign.index,12);assert.equal(s.player.hp>=s.player.maxHp*.25,true);
});
test('weapon effect preview matches the basic upgraded projectile damage',()=>{
 const s=new Simulation({bank:100});s.openCampaignBase('earth');assert.match(equipmentEffect(s,'cannon'),/24 → 30/);s.installEquipment('cannon');s.leaveBase();s.startCampaign(0);s.enemies=s.enemies.slice(0,1);s.enemies[0].position={x:0,y:0,z:10};s.weaponTimers.cannon=0;s.updateWeapons(0);const shot=s.shots.find(q=>q.type==='cannon');assert.ok(shot);assert.equal(shot.damage,30*s.power());
});
