import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {ProjectileVisuals,PROJECTILE_LOOKS,projectileLook} from '../src/projectile-visuals.js';
test('friendly missiles, barrage, hostile seekers and boss ordnance have distinct generated bodies',()=>{
 const kinds=[{type:'missile',friendly:true},{type:'missile',friendly:true,visualVariant:'barrage'},{type:'enemyMissile',friendly:false},{type:'boss',friendly:false},{type:'cannon',friendly:true},{type:'enemy',friendly:false}].map(projectileLook);
 assert.equal(new Set(kinds).size,6);
 for(const kind of kinds){const b=fs.readFileSync('public/assets/meshy/'+PROJECTILE_LOOKS[kind].asset+'.glb');assert.equal(b.subarray(0,4).toString(),'glTF');const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert.ok(j.materials.length);assert.ok(j.images.length);}
});
test('projectile wake remains in world space, fades when shots disappear and has bounded instances',()=>{
 const scene=new THREE.Scene(),v=new ProjectileVisuals(scene),s={id:1,type:'missile',friendly:true,position:{x:0,y:0,z:0},direction:{x:1,y:0,z:0}},root=v.create(s);v.update(root,s,.02,0);s.position.x=1;v.update(root,s,.02,.02);assert.equal(v.mesh.count,1);const before=new THREE.Matrix4();v.mesh.getMatrixAt(0,before);assert.ok(Math.abs(before.elements[12]-.5)<.001);
 for(let i=0;i<5000;i++){s.position.x+=.1;v.update(root,s,.02,i*.02);}assert.equal(v.mesh.count,4096);v.tick(2);assert.ok(v.alpha.every(a=>Number.isFinite(a)&&a===0));v.clear();assert.equal(v.mesh.count,0);root.userData.dispose();v.dispose();assert.equal(scene.children.length,0);
});
