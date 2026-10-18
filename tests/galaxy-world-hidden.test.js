import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createGalaxyWorld} from '../src/galaxy-visuals.js';
import {PLANETS} from '../src/galaxy.js';
import {propagateVisibleMatrices} from '../src/hidden-world-matrices.js';
import {cacheModelLocalMatrices} from '../src/static-model-matrices.js';
import {AssetInstanceBatch} from '../src/asset-instance-batch.js';

const before=readFileSync(new URL('../work/dense-optimization-20261017-galaxy-world-before.js',import.meta.url),'utf8').replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL('../src/'+path.slice(2),import.meta.url).href}'`).replace(/from 'three'/g,`from '${import.meta.resolve('three')}'`);
const original=await import('data:text/javascript;base64,'+Buffer.from(before).toString('base64'));
function setup(factory=createGalaxyWorld){const scene=new THREE.Scene(),world=factory(scene);return {scene,world,gates:scene.children.slice(1)};}
function elements(root){const result=[];root.traverse(o=>result.push(o));return result;}
function compareVisible(a,b){const an=elements(a),bn=elements(b);assert.equal(an.length,bn.length);let compared=0;
 for(let i=0;i<an.length;i++){let visible=true;for(let p=an[i];p;p=p.parent)visible&&=p.visible;if(!visible)continue;
  assert.equal(an[i].visible,bn[i].visible);assert.deepEqual(an[i].matrixWorld.elements,bn[i].matrixWorld.elements,'matrix '+i);if(an[i].material?.color)assert.deepEqual(an[i].material.color.toArray(),bn[i].material.color.toArray(),'color '+i);compared++;}
 return compared;
}
test('hidden safe galaxy skips 480 occupancy reads and catches up current time/state/galaxy on its first visible update',()=>{
 const a=setup(),b=setup(original.createGalaxyWorld);let reads=0;const data={},state=new Proxy(data,{get(target,key){reads++;return target[key];}});
 a.world.update(1,state,true,'milky');b.world.update(1,data,true,'milky');assert.equal(reads,PLANETS.length);
 reads=0;const heldRotation=a.world.root.children[0].rotation.y;
 for(const t of [2,20,120]){a.world.update(t,state,false,'origin');b.world.update(t,data,false,'origin');propagateVisibleMatrices(a.scene);b.scene.updateMatrixWorld();}
 assert.equal(reads,0);assert.equal(a.world.root.children[0].rotation.y,heldRotation);assert.equal(a.world.root.userData.hiddenMatrixBranch,true);
 const p=PLANETS.find(p=>p.galaxy==='origin');data[p.id]=[...Array.from({length:p.baseCount},(_,i)=>i),'crown'];
 a.world.root.position.set(10,20,30);b.world.root.position.set(10,20,30);
 for(const [time,id] of [[120.1,'origin'],[121,'andromeda'],[123,'milky']]){a.world.update(time,state,true,id);b.world.update(time,data,true,id);propagateVisibleMatrices(a.scene);b.scene.updateMatrixWorld();assert.ok(compareVisible(a.scene,b.scene)>280);assert.equal(a.gates.find(g=>g.visible).rotation.z,time*.08);}
 assert.equal(a.world.root.children[0].rotation.y,123*.015);
});

test('late cached GLB members remain culled under hidden galaxy and restore exact instance/world matrices',()=>{
 const a=setup(),b=setup(original.createGalaxyWorld),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),leaves=[];
 for(const row of [a,b]){row.world.update(2,{},false,'milky');propagateVisibleMatrices(row.scene);for(let i=0;i<4;i++){
  const mount=new THREE.Group(),orientation=new THREE.Group(),leaf=new THREE.Mesh(geometry,material);leaf.userData.meshy=true;leaf.position.set(1,2,3);orientation.rotation.z=.3;orientation.add(leaf);cacheModelLocalMatrices(orientation);mount.add(orientation);mount.position.set(2,4,6);row.world.root.children[i*3].add(mount);if(row===a)leaves.push(leaf);
 }}
 const batch=new AssetInstanceBatch(a.scene);a.world.update(4,{},false,'milky');batch.update(4000);assert.equal(a.world.root.userData.hiddenMatrixBranch,true);assert.equal(batch.stats.instances,0);
 for(const leaf of leaves){assert.equal(leaf.matrixAutoUpdate,false);assert.equal(leaf.matrixWorldAutoUpdate,true);assert.ok(leaf.userData.assetInstanceGroup);}
 a.world.root.position.set(9,-7,4);b.world.root.position.set(9,-7,4);a.world.update(7,{},true,'milky');b.world.update(7,{},true,'milky');batch.update(7000);b.scene.updateMatrixWorld();assert.equal(batch.stats.instances,4);
 // Compare the source hierarchy only; the candidate has additional InstancedMeshes.
 assert.ok(compareVisible(a.world.root,b.world.root)>280);assert.equal(batch.audit().valid,true);
 for(const leaf of leaves){const group=leaf.userData.assetInstanceGroup,entry=group.members.get(leaf),instance=new THREE.Matrix4();group.mesh.getMatrixAt(entry.slot,instance);for(let i=0;i<16;i++)assert.ok(Math.abs(instance.elements[i]-leaf.matrixWorld.elements[i])<.002);}
 a.world.update(20,{},false,'milky');batch.update(20000);assert.equal(batch.stats.instances,0);a.world.root.position.x=43;propagateVisibleMatrices(a.scene);
 const queried=leaves[0].getWorldPosition(new THREE.Vector3());a.scene.updateMatrixWorld();assert.deepEqual(queried.toArray(),new THREE.Vector3().setFromMatrixPosition(leaves[0].matrixWorld).toArray());
 a.world.update(21,{},true,'milky');b.world.root.position.x=43;b.world.update(21,{},true,'milky');batch.update(21000);b.scene.updateMatrixWorld();compareVisible(a.world.root,b.world.root);batch.dispose();geometry.dispose();material.dispose();
});

test('late custom/rig branches invalidate deferral once, remain native while unsafe and recover after removal',()=>{
 for(const type of ['custom','bone','morph','clip']){
  const a=setup();a.world.update(1,{},false);assert.equal(a.world.root.userData.hiddenMatrixBranch,true);
  const branch=new THREE.Group(),leaf=new THREE.Mesh();branch.add(leaf);let customCalls=0;
  if(type==='custom')branch.updateMatrixWorld=function(force){customCalls++;THREE.Object3D.prototype.updateMatrixWorld.call(this,force);};
  if(type==='bone')branch.add(new THREE.Bone());if(type==='morph')leaf.morphTargetInfluences=[0];if(type==='clip')branch.userData.meshyAnimated=true;
  a.world.root.children[0].add(branch);assert.equal(a.world.root.userData.hiddenMatrixBranch,undefined);
  let scans=0;const traverse=a.world.root.traverse;a.world.root.traverse=function(callback){scans++;return traverse.call(this,callback);};
  let reads=0;const state=new Proxy({},{get(){reads++;return undefined;}});a.world.update(2,state,false);assert.equal(a.world.root.userData.hiddenMatrixBranch,undefined);const checked=scans;assert.ok(checked>0);
  for(let i=0;i<8;i++){a.world.root.position.x=i;branch.position.y=i*2;a.world.update(3+i,state,false);propagateVisibleMatrices(a.scene);const expected=leaf.matrixWorld.clone();a.scene.updateMatrixWorld();assert.deepEqual(leaf.matrixWorld.elements,expected.elements);}
  assert.equal(scans,checked);assert.equal(reads,9*PLANETS.length);if(type==='custom')assert.ok(customCalls>=16);
  branch.removeFromParent();a.world.update(20,{},false);assert.equal(a.world.root.userData.hiddenMatrixBranch,true);assert.ok(scans>checked);
 }
});

test('repeated late mounts reuse bounded callbacks on existing and newly observed nodes',()=>{
 const a=setup();a.world.update(1,{},false);const root=a.world.root,body=root.children[0];
 const listeners=o=>({added:o._listeners?.childadded?.length||0,removed:o._listeners?.childremoved?.length||0});
 const beforeRoot=listeners(root),beforeBody=listeners(body),late=new THREE.Group();late.add(new THREE.Mesh());
 for(let i=0;i<30;i++){body.add(late);a.world.update(i+2,{},false);assert.equal(root.userData.hiddenMatrixBranch,true);assert.deepEqual(listeners(root),beforeRoot);assert.deepEqual(listeners(body),beforeBody);assert.deepEqual(listeners(late),{added:1,removed:1});late.removeFromParent();a.world.update(i+2.5,{},false);}
 assert.deepEqual(listeners(root),beforeRoot);assert.deepEqual(listeners(body),beforeBody);
});
