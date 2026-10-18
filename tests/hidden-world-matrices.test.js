import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {markHiddenMatrixBranch,propagateVisibleMatrices,compareHiddenMatrices} from '../src/hidden-world-matrices.js';
const close=(a,b)=>a.elements.forEach((v,i)=>assert.ok(Math.abs(v-b.elements[i])<1e-10));
function rig(){const scene=new THREE.Scene(),parent=new THREE.Group(),branch=new THREE.Group(),leaf=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(parent);parent.add(branch);branch.add(leaf);branch.position.set(2,3,4);leaf.position.set(1,-2,3);markHiddenMatrixBranch(branch);return {scene,parent,branch,leaf};}
test('hidden branch avoids local updates and catches up all descendants on the first visible frame',()=>{
 const a=rig(),b=rig();a.scene.updateMatrixWorld();b.scene.updateMatrixWorld();const old=a.leaf.matrixWorld.clone();let calls=0;const original=a.leaf.updateMatrix;a.leaf.updateMatrix=function(){calls++;original.call(this);};
 a.branch.visible=b.branch.visible=false;
 for(let i=1;i<=10;i++){for(const r of [a,b]){r.parent.position.set(i,2*i,-i);r.parent.rotation.set(.1*i,-.2*i,.05*i);r.branch.scale.set(2,3,4);r.leaf.position.x=i;}
  const stats=propagateVisibleMatrices(a.scene);b.scene.updateMatrixWorld();assert.equal(stats.deferred,1);assert.ok(a.leaf.matrixWorld.equals(old));}
 assert.equal(calls,0);a.branch.visible=b.branch.visible=true;propagateVisibleMatrices(a.scene);b.scene.updateMatrixWorld();close(a.leaf.matrixWorld,b.leaf.matrixWorld);assert.equal(calls,1);
 for(const r of [a,b]){r.leaf.geometry.dispose();r.leaf.material.dispose();}
});
test('direct world queries remain fresh while hidden and late mounts/reparenting recover accurately',()=>{
 const a=rig();a.branch.visible=false;a.parent.position.x=20;a.branch.rotation.y=.8;propagateVisibleMatrices(a.scene);
 const position=a.leaf.getWorldPosition(new THREE.Vector3());a.scene.updateMatrixWorld();assert.ok(position.distanceTo(new THREE.Vector3().setFromMatrixPosition(a.leaf.matrixWorld))<1e-10);
 const late=new THREE.Group();late.position.y=11;a.branch.add(late);a.parent.rotation.z=.3;propagateVisibleMatrices(a.scene);a.branch.visible=true;propagateVisibleMatrices(a.scene);const expected=late.matrixWorld.clone();a.scene.updateMatrixWorld();close(expected,late.matrixWorld);
 const another=new THREE.Group();another.scale.set(2,2,2);a.scene.add(another);another.add(a.branch);propagateVisibleMatrices(a.scene);const relocated=a.leaf.matrixWorld.clone();a.scene.updateMatrixWorld();close(relocated,a.leaf.matrixWorld);
 a.leaf.geometry.dispose();a.leaf.material.dispose();
});
test('manual world matrices, custom propagation and unsafe animation branches retain native contracts',()=>{
 const scene=new THREE.Scene(),manual=new THREE.Group(),custom=new THREE.Group(),bones=new THREE.Group(),morph=new THREE.Mesh();
 manual.matrixAutoUpdate=false;manual.matrixWorldAutoUpdate=false;manual.matrix.makeTranslation(4,5,6);manual.matrixWorld.makeTranslation(7,8,9);scene.add(manual,custom,bones,morph);let calls=0;custom.updateMatrixWorld=function(force){calls++;THREE.Object3D.prototype.updateMatrixWorld.call(this,force);};bones.add(new THREE.Bone());morph.morphTargetInfluences=[0];
 assert.equal(markHiddenMatrixBranch(bones),false);assert.equal(markHiddenMatrixBranch(morph),false);const expected=manual.matrixWorld.clone();propagateVisibleMatrices(scene);assert.equal(calls,1);close(manual.matrixWorld,expected);
});
test('same-scene diagnostic preserves visible matrices through LOD hiding, clone and removal',()=>{
 const a=rig();const sibling=a.leaf.clone();sibling.userData.hiddenMatrixBranch=true;sibling.visible=false;a.parent.add(sibling);const clone=a.branch.clone(true);clone.position.x=8;a.scene.add(clone);const result=compareHiddenMatrices(a.scene,4);assert.equal(result.mismatches,0);assert.ok(result.hiddenNodes>0);assert.equal(result.samples.length,4);
 sibling.visible=true;propagateVisibleMatrices(a.scene);const expected=sibling.matrixWorld.clone();a.scene.updateMatrixWorld();close(expected,sibling.matrixWorld);sibling.removeFromParent();assert.equal(compareHiddenMatrices(a.scene,2).mismatches,0);a.leaf.geometry.dispose();a.leaf.material.dispose();
});


test('late animated children invalidate an earlier hidden fallback opt-in',()=>{
 const a=rig();a.branch.visible=false;const bone=new THREE.Bone();a.leaf.add(bone);
 assert.equal(a.branch.userData.hiddenMatrixBranch,undefined);
 a.parent.position.x=17;propagateVisibleMatrices(a.scene);const expected=bone.matrixWorld.clone();
 a.scene.updateMatrixWorld();close(expected,bone.matrixWorld);a.leaf.geometry.dispose();a.leaf.material.dispose();
});

test('LOD mesh under an imported animation clip stays on the native path',()=>{
 const model=new THREE.Group(),mesh=new THREE.Mesh();model.userData.meshyAnimated=true;model.add(mesh);
 assert.equal(markHiddenMatrixBranch(mesh),false);mesh.visible=false;model.position.x=9;
 const stats=propagateVisibleMatrices(model);assert.equal(stats.deferred,0);
 assert.equal(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).x,9);
});
