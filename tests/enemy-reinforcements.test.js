import test from 'node:test';
import assert from 'node:assert/strict';
import {ENEMY_CAPTAINS,ENEMY_OFFICERS} from '../src/enemy-captains.js';
import {selectEnemyReinforcementRole} from '../src/enemy-reinforcements.js';

const leader=roles=>({id:7,hp:100,captain:{roles}});
const escort=(fleetRole,options={})=>({leaderId:7,fleetRole,hp:100,...options});
const count=(enemies,role)=>enemies.filter(e=>e.fleetRole===role).length;

test('lost repair and shield escorts are replaced instead of turning their fleet into strikers',()=>{
  const l=leader(['guard','support','gunner']),fleet=[];
  for(let i=0;i<3;i++)for(const role of l.captain.roles)fleet.push(escort(role));
  fleet.find(e=>e.fleetRole==='support').hp=0;
  assert.equal(selectEnemyReinforcementRole(l,fleet),'support');
  fleet.find(e=>e.fleetRole==='support').hp=100;
  fleet.find(e=>e.fleetRole==='guard').hp=0;
  assert.equal(selectEnemyReinforcementRole(l,fleet),'guard');
});

test('repeated replenishment preserves authored role weights for repair, artillery and mixed fleets',()=>{
  for(const roles of [['support','support','striker'],['guard','gunner','gunner'],['guard','striker','gunner','support']]) {
    const l=leader(roles),fleet=[];
    for(let i=0;i<roles.length*4;i++)fleet.push(escort(selectEnemyReinforcementRole(l,fleet)));
    for(const role of new Set(roles))assert.equal(count(fleet,role),roles.filter(r=>r===role).length*4);
    const lost=roles[0];fleet.find(e=>e.fleetRole===lost).hp=0;
    assert.equal(selectEnemyReinforcementRole(l,fleet),lost);
  }
});

test('equal deficits follow authored order deterministically without random input',()=>{
  const l=leader(['support','guard','gunner']),fleet=l.captain.roles.map(role=>escort(role));
  assert.equal(selectEnemyReinforcementRole(l,[]),'support');
  assert.equal(selectEnemyReinforcementRole(l,fleet),'support');
  assert.equal(selectEnemyReinforcementRole(l,[...fleet].reverse()),'support');
  assert.equal(selectEnemyReinforcementRole(leader(['gunner','support','guard']),fleet),'gunner');
});

test('dead escorts, another carrier and unsupported units cannot mask a missing repair escort',()=>{
  const l=leader(['guard','support','gunner']);
  const fleet=[escort('guard'),escort('gunner'),escort('support',{hp:0}),escort('support',{hp:-5}),escort('support',{hp:NaN}),escort('support',{leaderId:8}),escort('support',{leaderId:'7'}),escort('flagship'),escort('__proto__'),null];
  assert.equal(selectEnemyReinforcementRole(l,fleet),'support');
});

test('surviving roles outside the desired doctrine count toward fleet size while missing weighted roles recover',()=>{
  const l=leader(['guard','gunner','gunner']),fleet=[];
  for(let i=0;i<3;i++)fleet.push(escort('guard'));
  for(let i=0;i<4;i++)fleet.push(escort('gunner'));
  fleet.push(escort('striker'),escort('striker'));
  assert.equal(selectEnemyReinforcementRole(l,fleet),'gunner');
});

test('invalid doctrine roles are ignored and empty or missing definitions preserve the striker fallback',()=>{
  for(const roles of [undefined,null,'support',{},[],['unknown',null,'__proto__','constructor']])assert.equal(selectEnemyReinforcementRole(leader(roles),[]),'striker');
  assert.equal(selectEnemyReinforcementRole(null,[]),'striker');
  assert.equal(selectEnemyReinforcementRole({captain:{roles:['support']}},[]),'striker');
  assert.equal(selectEnemyReinforcementRole(leader(['unknown','support',null,'support','striker']),[]),'support');
  assert.equal(selectEnemyReinforcementRole(leader(['gunner']),null),'gunner');
});

test('selection is pure with frozen shared captain roles and frozen escorts',()=>{
  for(const captain of ENEMY_CAPTAINS) {
    const roles=Object.freeze([...captain.roles]),l=Object.freeze({id:7,hp:100,captain:Object.freeze({...captain,roles})});
    const fleet=Object.freeze(roles.map(role=>Object.freeze(escort(role))));
    const before=JSON.stringify({l,fleet}),selected=selectEnemyReinforcementRole(l,fleet);
    assert.ok(Object.hasOwn(ENEMY_OFFICERS,selected));assert.ok(roles.includes(selected));
    assert.equal(JSON.stringify({l,fleet}),before);
  }
});
