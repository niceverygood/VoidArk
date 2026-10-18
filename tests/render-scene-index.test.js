import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RenderSceneIndex,indexedRenderScene,renderGroupsFor} from '../src/render-scene-index.js';

function queue(scene,camera){
 const items=[],lights=[];
 const walk=(o,groupOrder=0)=>{if(!o.visible)return;if(o.layers.test(camera.layers)){if(o.isGroup)groupOrder=o.renderOrder;else if(o.isLight)lights.push(o);else if(o.isMesh||o.isLine||o.isPoints||o.isSprite)items.push({object:o,groupOrder,renderOrder:o.renderOrder});}for(const c of o.children)walk(c,groupOrder);};
 walk(scene);return {items,lights};
}
function rig(){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();return {scene,camera,geometry,material,mesh(){return new THREE.Mesh(geometry,material);}};}

test('indexed view preserves layer-local visibility, inherited group order and native drawable subtrees without duplication',()=>{
 const r=rig(),root=new THREE.Group(),bar=new THREE.Group(),disabled=new THREE.Group(),parent=r.mesh(),child=r.mesh(),layered=r.mesh();
 root.renderOrder=7;bar.renderOrder=10;disabled.layers.set(2);disabled.renderOrder=99;parent.renderOrder=4;root.add(bar,disabled,parent);bar.add(r.mesh(),r.mesh());disabled.add(layered);parent.add(child,new THREE.PointLight());r.scene.add(root,new THREE.AmbientLight());
 const sourceChildren=r.scene.children,rootChildren=root.children,parentChildren=parent.children,index=new RenderSceneIndex(r.scene);
 const view=index.prepare(r.camera);assert.notStrictEqual(view,r.scene);assert.deepEqual(queue(view,r.camera),queue(r.scene,r.camera));assert.equal(queue(view,r.camera).items.filter(i=>i.object===child).length,1);
 assert.strictEqual(r.scene.children,sourceChildren);assert.strictEqual(root.children,rootChildren);assert.strictEqual(parent.children,parentChildren);assert.strictEqual(child.parent,parent);assert.equal(index.stats.covered,2);
 root.visible=false;assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));root.visible=true;bar.layers.set(2);assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));
 index.dispose();r.geometry.dispose();r.material.dispose();
});

test('nested asynchronous mounts, detach, reparent and direct mesh removal update the index synchronously',()=>{
 const r=rig(),a=new THREE.Group(),b=new THREE.Group();r.scene.add(a,b);const index=new RenderSceneIndex(r.scene),mount=new THREE.Group();a.add(mount);const mesh=r.mesh();mount.add(mesh);
 assert.equal(index.drawables.has(mesh),true);assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));b.add(mount);assert.equal(index.drawables.has(mesh),true);assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));
 b.remove(mount);assert.equal(index.drawables.has(mesh),false);assert.equal(queue(index.prepare(r.camera),r.camera).items.length,0);a.add(mount);mesh.removeFromParent();assert.equal(index.drawables.has(mesh),false);mount.add(mesh);index.prepare(r.camera);
 index.dispose();const registrations=index.nodes.size;mount.add(r.mesh());assert.equal(index.nodes.size,registrations);r.geometry.dispose();r.material.dispose();
});

test('every camera preparation observes current layers, marker visibility and source transforms',()=>{
 const r=rig(),root=new THREE.Group(),mesh=r.mesh(),marker=new THREE.Sprite(new THREE.SpriteMaterial());root.add(mesh,marker);r.scene.add(root);const index=new RenderSceneIndex(r.scene),other=r.camera.clone();other.layers.set(2);
 mesh.layers.set(2);r.scene.position.set(3,4,5);root.position.set(7,8,9);const view=index.prepare(r.camera);assert.deepEqual(queue(view,r.camera),queue(r.scene,r.camera));const matrix=mesh.matrixWorld.clone();
 marker.visible=false;assert.deepEqual(queue(index.prepare(other),other),queue(r.scene,other));assert.strictEqual(mesh.parent,root);assert.ok(mesh.matrixWorld.equals(matrix));marker.visible=true;mesh.layers.set(0);assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));
 index.dispose();r.geometry.dispose();r.material.dispose();marker.material.dispose();
});

test('custom scene/object/material callbacks, skin, LOD, shadows and unsorted rendering retain the original Scene',()=>{
 const r=rig(),mesh=r.mesh();r.scene.add(mesh);const index=new RenderSceneIndex(r.scene),native=THREE.Object3D.prototype.onBeforeRender;
 r.scene.onBeforeRender=()=>{};assert.strictEqual(index.prepare(r.camera),r.scene);r.scene.onBeforeRender=native;
 mesh.onAfterRender=()=>{};assert.strictEqual(index.prepare(r.camera),r.scene);mesh.onAfterRender=THREE.Object3D.prototype.onAfterRender;
 r.material.onBeforeRender=()=>{};assert.strictEqual(index.prepare(r.camera),r.scene);r.material.onBeforeRender=THREE.Material.prototype.onBeforeRender;
 mesh.isSkinnedMesh=true;assert.strictEqual(index.prepare(r.camera),r.scene);delete mesh.isSkinnedMesh;
 const lod=new THREE.LOD();r.scene.add(lod);assert.strictEqual(index.prepare(r.camera),r.scene);r.scene.remove(lod);
 assert.strictEqual(index.prepare(r.camera,{shadowMap:{enabled:true}}),r.scene);assert.strictEqual(index.prepare(r.camera,{sortObjects:false}),r.scene);assert.notStrictEqual(index.prepare(r.camera),r.scene);
 index.dispose();r.geometry.dispose();r.material.dispose();
});

test('view borrows source environment, fog, background and override material without disposing or modifying resources',()=>{
 const r=rig(),texture=new THREE.Texture(),override=new THREE.MeshBasicMaterial();r.scene.environment=r.scene.background=texture;r.scene.fog=new THREE.Fog('red',1,100);r.scene.environmentIntensity=.4;r.scene.backgroundIntensity=.8;r.scene.overrideMaterial=override;r.scene.add(r.mesh());
 let disposals=0;for(const resource of [texture,r.geometry,r.material,override])resource.addEventListener('dispose',()=>disposals++);
 const index=new RenderSceneIndex(r.scene),view=index.prepare(r.camera);assert.strictEqual(view.environment,texture);assert.strictEqual(view.background,texture);assert.strictEqual(view.fog,r.scene.fog);assert.strictEqual(view.overrideMaterial,override);assert.strictEqual(view.environmentRotation,r.scene.environmentRotation);assert.equal(view.environmentIntensity,.4);assert.equal(view.backgroundIntensity,.8);
 const own=r.scene.children[0],parent=own.parent;index.dispose();assert.equal(disposals,0);assert.strictEqual(own.parent,parent);assert.strictEqual(r.scene.children[0],own);assert.strictEqual(index.prepare(r.camera),r.scene);
 texture.dispose();r.geometry.dispose();r.material.dispose();override.dispose();
});

test('registry is scene-local and transient never-rendered nodes cancel without a whole-scene rebuild',()=>{
 const r=rig(),mesh=r.mesh();r.scene.add(mesh);const index=new RenderSceneIndex(r.scene),view=indexedRenderScene(r.scene,r.camera);assert.strictEqual(view,index.view);const rebuilds=index.rebuilds;
 for(let i=0;i<12;i++){const transient=r.mesh();r.scene.add(transient);r.scene.remove(transient);assert.strictEqual(indexedRenderScene(r.scene,r.camera),view);assert.equal(index.rebuilds,rebuilds);}
 const geometry=r.geometry,material=r.material;mesh.geometry=new THREE.SphereGeometry();mesh.material=[material,null];assert.deepEqual(queue(indexedRenderScene(r.scene,r.camera),r.camera),queue(r.scene,r.camera));assert.equal(index.rebuilds,rebuilds);assert.strictEqual(mesh.geometry,view.children[0].geometry);
 const other=new THREE.Scene();assert.strictEqual(indexedRenderScene(other,r.camera),other);index.dispose();assert.strictEqual(indexedRenderScene(r.scene,r.camera),r.scene);mesh.geometry.dispose();geometry.dispose();material.dispose();
});

test('new final Scene roots append native DFS order and rendered tail subtrees pop without a rebuild',()=>{
 const r=rig(),first=r.mesh();r.scene.add(first,new THREE.AmbientLight());const index=new RenderSceneIndex(r.scene);index.prepare(r.camera);const rebuilds=index.rebuilds,sourceChildren=r.scene.children;
 for(let n=0;n<12;n++){
  const root=new THREE.Group(),mesh=r.mesh(),child=r.mesh(),light=new THREE.PointLight();root.renderOrder=n%2?10:0;mesh.add(child);root.add(mesh,light);r.scene.add(root);
  assert.equal(index.dirty,false);assert.deepEqual(index.ordered.slice(-3),[mesh,child,light]);assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));assert.equal(index.rebuilds,rebuilds);
  r.scene.remove(root);assert.equal(index.dirty,false);assert.equal(index.nodes.has(child),false);assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));assert.equal(index.rebuilds,rebuilds);assert.strictEqual(mesh.parent,root);assert.strictEqual(child.parent,mesh);
 }
 assert.equal(index.appends,12);assert.equal(index.tailRemovals,12);assert.strictEqual(r.scene.children,sourceChildren);index.dispose();r.geometry.dispose();r.material.dispose();
});

test('nested GLB insertion, middle removal and reparenting splice exact native DFS without a rebuild',()=>{
 const r=rig(),early=new THREE.Group(),late=new THREE.Group(),a=r.mesh(),b=r.mesh();early.add(a);late.add(b);r.scene.add(early,late);const index=new RenderSceneIndex(r.scene);index.prepare(r.camera);let rebuilds=index.rebuilds;
 const nested=r.mesh(),atEnd=r.mesh();early.add(nested);assert.equal(index.dirty,false);r.scene.add(atEnd);assert.equal(index.dirty,false);index.prepare(r.camera);assert.deepEqual(index.ordered,[a,nested,b,atEnd]);assert.equal(index.rebuilds,rebuilds);assert.deepEqual(queue(index.view,r.camera),queue(r.scene,r.camera));
 early.remove(a);assert.equal(index.dirty,false);index.prepare(r.camera);assert.deepEqual(index.ordered,[nested,b,atEnd]);assert.equal(index.rebuilds,rebuilds);
 late.add(nested);assert.equal(index.dirty,false);index.prepare(r.camera);assert.deepEqual(index.ordered,[b,nested,atEnd]);assert.equal(index.rebuilds,rebuilds);assert.deepEqual(queue(index.view,r.camera),queue(r.scene,r.camera));
 // A listener inserted before registration adds another root during childadded.
 const other=rig(),trigger=other.mesh(),following=other.mesh();other.scene.addEventListener('childadded',e=>{if(e.child===trigger)other.scene.add(following);});const second=new RenderSceneIndex(other.scene);second.prepare(other.camera);other.scene.add(trigger);assert.strictEqual(second.prepare(other.camera),other.scene);assert.equal(second.reconciles,1);assert.deepEqual(second.ordered,[trigger,following]);assert.deepEqual(queue(second.prepare(other.camera),other.camera),queue(other.scene,other.camera));
 // The inverse listener order is also native DFS, even though both take append.
 const third=rig(),thirdIndex=new RenderSceneIndex(third.scene),x=third.mesh(),y=third.mesh();thirdIndex.prepare(third.camera);third.scene.addEventListener('childadded',e=>{if(e.child===x)third.scene.add(y);});third.scene.add(x);thirdIndex.prepare(third.camera);assert.deepEqual(thirdIndex.ordered,[x,y]);assert.deepEqual(queue(thirdIndex.view,third.camera),queue(third.scene,third.camera));
 index.dispose();second.dispose();thirdIndex.dispose();for(const q of [r,other,third]){q.geometry.dispose();q.material.dispose();}
});

test('incremental DFS handles empty ancestors, drawable parents, deep prior lights and FIFO removals',()=>{
 const r=rig(),empty=new THREE.Group(),middle=new THREE.Group(),tail=r.mesh(),deep=new THREE.Group(),light=new THREE.PointLight(),parent=r.mesh();deep.add(new THREE.Group());deep.children[0].add(light);middle.add(deep,parent);r.scene.add(empty,middle,tail);const index=new RenderSceneIndex(r.scene);index.prepare(r.camera);const rebuilds=index.rebuilds;
 const head=r.mesh(),under=r.mesh();empty.add(head);parent.add(under);index.prepare(r.camera);assert.deepEqual(index.ordered,[head,light,parent,under,tail]);assert.deepEqual(queue(index.view,r.camera),queue(r.scene,r.camera));
 const fifo=[];for(let i=0;i<40;i++){const mesh=r.mesh();r.scene.add(mesh);fifo.push(mesh);index.prepare(r.camera);assert.equal(index.rebuilds,rebuilds);}
 for(const mesh of fifo){mesh.removeFromParent();assert.equal(index.dirty,false);assert.equal(index.pendingAdded.size,0);index.prepare(r.camera);assert.equal(index.rebuilds,rebuilds);assert.deepEqual(queue(index.view,r.camera),queue(r.scene,r.camera));}
 middle.remove(deep);index.prepare(r.camera);assert.deepEqual(index.ordered,[head,parent,under,tail]);assert.equal(index.nodes.has(light),false);assert.equal(index.rebuilds,rebuilds);
 index.dispose();r.geometry.dispose();r.material.dispose();
});

test('reentrant removal and removal-time reattachment reconcile the full registry and preserve resource ownership',()=>{
 const r=rig(),a=r.mesh(),b=r.mesh();r.scene.add(a,b);r.scene.addEventListener('childremoved',e=>{if(e.child===a&&b.parent)r.scene.remove(b);});const index=new RenderSceneIndex(r.scene);index.prepare(r.camera);r.scene.remove(a);assert.strictEqual(index.prepare(r.camera),r.scene);assert.equal(index.nodes.has(a),false);assert.equal(index.nodes.has(b),false);assert.deepEqual(index.ordered,[]);assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));
 const other=rig(),mesh=other.mesh();other.scene.add(mesh);const reattach=e=>{if(e.child===mesh)other.scene.add(mesh);};other.scene.addEventListener('childremoved',reattach);const second=new RenderSceneIndex(other.scene);second.prepare(other.camera);other.scene.remove(mesh);second.prepare(other.camera);assert.deepEqual(second.ordered,[mesh]);assert.equal(second.nodes.has(mesh),true);assert.deepEqual(queue(second.prepare(other.camera),other.camera),queue(other.scene,other.camera));other.scene.removeEventListener('childremoved',reattach);
 const destination=new THREE.Scene();destination.add(mesh);assert.equal(second.nodes.has(mesh),false);assert.deepEqual(queue(second.prepare(other.camera),other.camera),queue(other.scene,other.camera));
 index.dispose();second.dispose();for(const q of [r,other]){q.geometry.dispose();q.material.dispose();}
});

test('shared group view is cached, read-only, source-only and independent of drawable ordering dirtiness',()=>{
 const r=rig(),root=new THREE.Group(),bar=new THREE.Group(),empty=new THREE.Group(),mesh=r.mesh();bar.renderOrder=10;bar.add(mesh);root.add(bar,empty);r.scene.add(root);
 assert.equal(renderGroupsFor(r.scene),null);const index=new RenderSceneIndex(r.scene),view=renderGroupsFor(r.scene);
 assert.equal(view,renderGroupsFor(r.scene));assert.equal(Object.isFrozen(view),true);assert.equal(view.add,undefined);assert.equal(view.delete,undefined);assert.equal(view.clear,undefined);assert.equal(view.ready,true);assert.equal(view.closed,false);assert.equal(index.dirty,true);assert.deepEqual(new Set(view),new Set([root,bar,empty]));
 index.prepare(r.camera);assert.deepEqual(new Set(view),new Set([root,bar,empty]));assert.ok(index.usedWrappers.length>0);for(const wrapper of index.usedWrappers)assert.equal(new Set(view).has(wrapper),false);
 const revision=view.revision;bar.renderOrder=0;empty.renderOrder=10;empty.visible=false;empty.layers.set(2);assert.equal(view.revision,revision);assert.equal([...view].find(group=>group===empty).renderOrder,10);assert.equal(view.size,3);
 index.dispose();assert.equal(view.closed,true);assert.equal(view.ready,false);assert.equal(view.size,0);assert.deepEqual([...view],[]);assert.equal(renderGroupsFor(r.scene),null);r.geometry.dispose();r.material.dispose();
});

test('shared groups track empty and Mesh-parented late mounts, removals and scene reparenting synchronously',()=>{
 const r=rig(),parent=r.mesh();r.scene.add(parent);const index=new RenderSceneIndex(r.scene),view=renderGroupsFor(r.scene),late=new THREE.Group(),nested=new THREE.Group();late.add(nested);let revision=view.revision;
 parent.add(late);assert.equal(view.ready,true);assert.equal(view.size,2);assert.ok(view.revision>revision);assert.deepEqual(new Set(view),new Set([late,nested]));revision=view.revision;
 late.remove(nested);assert.equal(view.size,1);assert.ok(view.revision>revision);parent.add(nested);assert.equal(view.size,2);
 const other=new THREE.Scene(),otherIndex=new RenderSceneIndex(other),otherView=renderGroupsFor(other);other.add(late);assert.deepEqual([...view],[nested]);assert.deepEqual([...otherView],[late]);late.add(nested);assert.equal(view.size,0);assert.deepEqual(new Set(otherView),new Set([late,nested]));
 index.dispose();otherIndex.dispose();r.geometry.dispose();r.material.dispose();
});

test('reentrant group events mark the shared view unready until the existing index reconciles it',()=>{
 const r=rig(),trigger=new THREE.Group(),following=new THREE.Group();trigger.add(r.mesh());following.add(r.mesh());r.scene.addEventListener('childadded',event=>{if(event.child===trigger)r.scene.add(following);});const index=new RenderSceneIndex(r.scene),view=renderGroupsFor(r.scene);index.prepare(r.camera);
 r.scene.add(trigger);assert.equal(view.ready,false);assert.equal(index.reconcileNeeded,true);assert.equal(index.prepare(r.camera),r.scene);assert.equal(view.ready,true);assert.deepEqual(new Set(view),new Set([trigger,following]));assert.deepEqual(queue(index.prepare(r.camera),r.camera),queue(r.scene,r.camera));
 const remove=event=>{if(event.child===trigger&&following.parent)r.scene.remove(following);};r.scene.removeEventListener('childadded',index.onAdded); // Restore callback order so the reentrant removal precedes the registry.
 r.scene.addEventListener('childremoved',remove);r.scene.removeEventListener('childremoved',index.onRemoved);r.scene.addEventListener('childremoved',index.onRemoved);r.scene.addEventListener('childadded',index.onAdded);
 r.scene.remove(trigger);assert.equal(view.ready,false);index.prepare(r.camera);assert.equal(view.ready,true);assert.equal(view.size,0);
 index.dispose();r.geometry.dispose();r.material.dispose();
});
