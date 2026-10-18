import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/sim.js';
import {permanentEquipmentCost} from '../src/campaign-economy.js';
import {SOLAR_STAGES,updateSolarCampaign} from '../src/solar-campaign.js';
test('zero-loot first three captures pay the advertised minimum once and fund distinct permanent choices',()=>{
 for(let index=0;index<3;index++){const s=new Simulation({campaign:{cleared:index},spaceBase:{initialized:true}});s.startCampaign(index);s.scrap=0;s.campaign.phase='landing';s.campaign.landing={...s.player.position};updateSolarCampaign(s,.01);assert.equal(s.result.banked,SOLAR_STAGES[index].reward+120);const bank=s.meta.bank;updateSolarCampaign(s,.01);assert.equal(s.meta.bank,bank);s.openCampaignBase('earth');assert.equal(s.installEquipment('cannon'),true);assert.equal(s.installEquipment('missile'),true);assert.ok(s.meta.bank>=210);assert.equal(s.meta.campaign.cleared,index+1);}
});
test('first supplies allow two new systems or a primary upgrade but not a maxed gun',()=>{
 const s=new Simulation();s.openCampaignBase('earth');assert.equal(s.meta.bank,80);
 assert.equal(s.equipmentCost('cannon'),70);assert.equal(s.installEquipment('cannon'),true);assert.equal(s.meta.bank,10);assert.equal(s.installEquipment('cannon'),false);
 const wide=new Simulation();wide.openCampaignBase('earth');assert.equal(wide.installEquipment('missile'),true);assert.equal(wide.installEquipment('shield'),true);assert.equal(wide.meta.bank,0);
 assert.equal([1,2,3,4].reduce((a,l)=>a+permanentEquipmentCost(l),0),660);
});
test('zero-loot repeated early defeats always fund full repair and shield without progress loss',()=>{
 for(const cleared of [0,1,2]){const s=new Simulation({bank:0,campaign:{cleared},spaceBase:{initialized:true},campaignShip:{gear:{armor:5,shield:5,missile:3}},research:{hull:2},conquest:{'planet-0':[0]}});
 const originalConquest=structuredClone(s.meta.conquest);for(let i=0;i<3;i++){s.openCampaignBase('earth');s.startCampaign(cleared);s.player.hp=0;s.player.shield=0;s.finish(false);assert.equal(s.result.banked,12);s.openCampaignBase('earth');assert.equal(s.baseServices().repair,8);assert.equal(s.baseServices().shield,4);assert.equal(s.serviceBase('repair'),true);assert.equal(s.serviceBase('shield'),true);assert.equal(s.meta.bank,0);assert.equal(s.player.hp,s.player.maxHp);assert.equal(s.meta.campaign.cleared,cleared);assert.equal(s.meta.campaignShip.gear.missile,3);}
 assert.deepEqual(s.meta.conquest,originalConquest);assert.equal(s.meta.research.hull,2);
 }
});
test('support ends after Mars and leaves live field repairs and discounts unchanged',()=>{
 const s=new Simulation({campaign:{cleared:3},spaceBase:{initialized:true}});s.openCampaignBase('earth');s.player.hp=30;s.player.shield=0;assert.equal(s.baseServices().repair,14);assert.equal(s.baseServices().shield,6);
 const field=new Simulation();field.start();field.phase='base';field.player.hp=30;assert.equal(field.baseServices().repair,14);assert.equal(field.equipmentCost('cannon'),25);
 const discounted=new Simulation({base:{arsenal:2},bank:100,spaceBase:{initialized:true}});discounted.openCampaignBase('earth');assert.equal(discounted.equipmentCost('cannon'),56);
});
test('permanent purchases survive serialization and cannot duplicate initial supplies',()=>{
 const s=new Simulation({bank:700,campaign:{cleared:2},campaignShip:{gear:{missile:2}},spaceBase:{initialized:true}});s.openCampaignBase('earth');assert.equal(s.installEquipment('missile'),true);const saved=structuredClone(s.meta);const loaded=new Simulation(JSON.parse(JSON.stringify(saved)));loaded.openCampaignBase('earth');assert.equal(loaded.meta.bank,saved.bank);assert.equal(loaded.upgrades.missile,3);assert.equal(loaded.meta.campaign.cleared,2);assert.equal(loaded.equipmentCost('missile'),190);
});
