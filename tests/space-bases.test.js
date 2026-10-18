import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,cleanMeta} from '../src/sim.js';
import {SOLAR_CAPITALS,cleanSpaceBase} from '../src/space-bases.js';
import {createPlayer} from '../src/models.js';
test('Earth prep grants supplies once, buys bank-funded permanent gear, repairs and launches the saved hull',()=>{
 let s=new Simulation();assert.equal(s.openCampaignBase('earth'),true);assert.equal(s.phase,'base');assert.equal(s.meta.bank,80);
 assert.equal(s.serviceBase('missile'),true);assert.equal(s.meta.bank,40);assert.equal(s.meta.campaignShip.gear.missile,1);
 s.player.hp=s.player.maxHp*.5;s.leaveBase();s=new Simulation(structuredClone(s.meta));s.openCampaignBase('earth');assert.equal(s.meta.bank,40);assert.equal(s.player.hp,s.player.maxHp*.5);
 assert.equal(s.serviceBase('repair'),true);const bank=s.meta.bank;s.openCampaignBase('earth');assert.equal(s.meta.bank,bank);assert.equal(s.player.hp,s.player.maxHp);
 s.constructBase('command');assert.equal(s.meta.base.command,1);s.leaveBase();s.startCampaign(0);assert.equal(s.upgrades.missile,1);assert.equal(s.player.hp,s.player.maxHp);
 // Temporary experience choices remain sortie rewards, not free permanent purchases.
 s.upgrades.laser=4;s.player.hp=s.player.maxHp*.4;s.finish(false);s.openCampaignBase('earth');assert.equal(s.upgrades.laser,0);assert.equal(s.player.hp,s.player.maxHp*.4);
});
test('solar development is gated by all eight conquests, costs are atomic, and facilities directly support the ship',()=>{
 const locked=new Simulation({bank:10000,campaign:{cleared:7}});assert.equal(locked.openCampaignBase('sun'),false);locked.openCampaignBase('earth');const bank=locked.meta.bank;assert.equal(locked.buildSolar('foundation'),false);assert.equal(locked.buildCapital('helios'),false);assert.equal(locked.meta.bank,bank);
 const s=new Simulation({bank:10000,campaign:{cleared:8}});s.openCampaignBase('sun');assert.equal(s.buildSolar('shipyard'),false);assert.equal(s.buildSolar('foundation'),true);assert.equal(s.buildSolar('foundation'),false);
 assert.equal(s.buildSolar('command'),true);const hp=s.player.maxHp;assert.equal(s.buildSolar('shipyard'),true);assert.equal(s.player.maxHp,hp+60);assert.equal(s.buildSolar('shipyard'),false);
 const power=s.power();s.buildSolar('forge');assert.ok(s.power()>power);const shield=s.player.maxShield;s.buildSolar('shield');assert.equal(s.player.maxShield,shield+40);
 s.meta.bank=0;const old=structuredClone(s.meta.spaceBase);assert.equal(s.buildSolar('reactor'),false);assert.deepEqual(s.meta.spaceBase,old);
});
test('three capital designs, custom fleet composition and individual upgrades survive reload without repeated stat gains',()=>{
 let s=new Simulation({bank:100000,campaign:{cleared:8}});s.openCampaignBase('sun');s.buildSolar('foundation');for(let i=0;i<3;i++)s.buildSolar('command');for(let i=0;i<3;i++)s.buildSolar('shipyard');
 for(const d of SOLAR_CAPITALS){assert.equal(s.buildCapital(d.id),true);assert.equal(s.vessel.id,d.ship);assert.equal(s.solar.capital.id,d.id);assert.equal(s.stage,2);const hp=s.player.maxHp;s.openCampaignBase('sun');assert.equal(s.player.maxHp,hp);assert.equal(s.buildCapital(d.id),false);}
 assert.equal(s.buildFleetShip('support'),true);assert.equal(s.buildFleetShip('cruiser'),true);assert.deepEqual(s.fleet.map(a=>a.role),['support','cruiser']);assert.ok(s.fleet[0].maxHp>300);
 assert.equal(s.openCarrier(),true);assert.equal(s.upgradeFleet('1','engine'),true);assert.equal(s.closeCarrier(),true);assert.equal(s.phase,'base');
 assert.equal(s.openCarrier(),true);assert.equal(s.refitFleetShip('0','destroyer'),true);assert.equal(s.closeCarrier(),true);assert.equal(s.fleet[0].role,'destroyer');
 const saved=structuredClone(s.meta);s=new Simulation(saved);s.openCampaignBase('sun');assert.deepEqual(s.fleet.map(a=>a.role),['destroyer','cruiser']);assert.equal(s.fleet[1].upgrades.engine,1);
 s.leaveBase();s.startCampaign(0);assert.equal(s.fleet[0].role,'destroyer');assert.equal(s.fleet[1].upgrades.engine,1);assert.equal(s.stage,2);assert.equal(s.snapshot().fleet.name,'태양 원정 선단');
});
test('solar metadata rejects invalid ranks, ships and rosters; every owned capital adds actual distinct geometry',()=>{
 const b=cleanSpaceBase({facilities:{command:Infinity,forge:90},owned:['bad','helios'],capital:'bad',roster:['bad','cruiser']});assert.equal(b.facilities.command,0);assert.equal(b.facilities.forge,3);assert.equal(b.capital,null);assert.deepEqual(b.roster,['cruiser']);assert.equal(cleanMeta({campaign:{cleared:7,systemOwned:true}}).campaign.systemOwned,false);
 for(const d of SOLAR_CAPITALS){const base=createPlayer(2,{}, {},{},d.ship);const solar=createPlayer(2,{}, {},{},d.ship,{solar:{sunBuilt:true,owned:[d.id],capital:d.id,facilities:{shipyard:3,forge:3,shield:3,reactor:3,logistics:3}}});assert.ok(solar.userData.solarModules.children.length>20);assert.ok(solar.userData.visualRoot.scale.x>base.userData.visualRoot.scale.x);base.userData.dispose();solar.userData.dispose();}
});

test('fleet damage persists on return, paid maintenance restores every ship, and leveling cannot downgrade a capital',()=>{
 const s=new Simulation({bank:5000,campaign:{cleared:8},spaceBase:{initialized:true,sunBuilt:true,owned:['helios'],capital:'helios',facilities:{command:1,shipyard:1},roster:['support','frigate']},ship:'sovereign'});
 s.openCampaignBase('sun');s.leaveBase();s.startCampaign(0);s.fleet[0].hp=0;s.fleet[1].hp=s.fleet[1].maxHp*.5;
 s.xp=s.xpNeed;s.levelUp();assert.equal(s.chooseUpgrade(s.choices[0].id),true);assert.equal(s.stage,2);
 s.finish(false);s.openCampaignBase('sun');assert.equal(s.fleet[0].hp,0);assert.equal(s.fleet[1].hp,s.fleet[1].maxHp*.5);const bank=s.meta.bank;
 assert.equal(s.serviceBase('maintenance'),true);assert.ok(s.meta.bank<bank);assert.ok(s.fleet.every(a=>a.hp===a.maxHp));s.openCampaignBase('earth');assert.ok(s.fleet.every(a=>a.hp===a.maxHp));assert.doesNotThrow(()=>s.snapshot());
});
