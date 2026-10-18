import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../src/sim.js';
import {orbitHeading} from '../src/dogfight.js';
const nose=heading=>new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),heading);
const directions=[{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1},{x:1,z:-1},{x:-1,z:1}];

test('player physics yaw keeps the normalized model bow aligned with actual movement',()=>{
 for(const direction of directions){const sim=new Simulation({ship:'bastion'});sim.start();sim.spawnTimer=Infinity;sim.patrolTimer=Infinity;sim.cosmicTimer=Infinity;sim.nextTitan=Infinity;
  for(let i=0;i<180;i++)sim.step(1/60,direction);
  const velocity=new THREE.Vector3(sim.player.velocity.x,0,sim.player.velocity.z).normalize();
  assert.ok(nose(sim.player.heading).dot(velocity)>.99999,JSON.stringify(direction));
 }
});

test('allied ships face their actual firing targets in every horizontal sector',()=>{
 for(const direction of directions){const sim=new Simulation({fleetRank:1});sim.start();sim.enemies=[];const ship=sim.fleet[0];
  for(const ally of sim.fleet)ally.cooldown=Infinity;
  const target=sim.spawn('carrier',{x:ship.position.x+direction.x*18,y:ship.position.y,z:ship.position.z+direction.z*18});
  sim.updateFleet(1/60);
  const aim=new THREE.Vector3(target.position.x-ship.position.x,0,target.position.z-ship.position.z).normalize();
  assert.ok(nose(ship.heading).dot(aim)>.99999,JSON.stringify(direction));
 }
});

test('orbiting interceptor bows follow the tangent of actual simulation positions',()=>{
 for(const angle of [0,.4,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2-.01]){const sim=new Simulation();sim.start();sim.upgrades.fighter=2;sim.syncAllies();const ally=sim.allies[0];ally.angle=angle;sim.updateAllies(0);const before={...ally.position};sim.updateAllies(1/600);
  const movement=new THREE.Vector3(ally.position.x-before.x,0,ally.position.z-before.z).normalize();
  assert.ok(nose(orbitHeading(ally.angle)).dot(movement)>.99999,String(angle));
 }
});
