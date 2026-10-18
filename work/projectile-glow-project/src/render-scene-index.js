import * as THREE from 'three';

const beforeRender=THREE.Object3D.prototype.onBeforeRender;
const afterRender=THREE.Object3D.prototype.onAfterRender;
const materialRender=THREE.Material.prototype.onBeforeRender;
const sceneProperties=['background','backgroundBlurriness','backgroundIntensity','backgroundRotation','environment','environmentIntensity','environmentRotation','fog','overrideMaterial'];
const drawable=o=>o.isMesh||o.isLine||o.isPoints||o.isSprite||o.isLight||o.isLOD;
const scenes=new WeakMap();
export function indexedRenderScene(scene,camera,renderer){return scenes.get(scene)?.prepare(camera,renderer)||scene;}
// A live, read-only group view reuses the existing structural registry. Consumers
// must still read current renderOrder/visible/layers; those fields have no events.
export function renderGroupsFor(scene){return scenes.get(scene)?.groupView||null;}
function lastDrawable(root){for(let i=root.children.length-1;i>=0;i--){const found=lastDrawable(root.children[i]);if(found)return found;}return drawable(root)?root:null;}

// Borrow native renderables without cloning resources, changing their parents,
// or replacing the source Scene's children. Native subtrees stay intact: a
// drawable parent covers its descendants once, including nested lights.
export class RenderSceneIndex {
 constructor(scene){
  this.scene=scene;this.view=new THREE.Scene();this.view.name='indexed-render-view';this.view.matrixAutoUpdate=false;this.view.matrixWorldAutoUpdate=false;
  this.nodes=new Map();this.drawables=new Set();this.groups=new Set();this.groupRevision=0;this.ordered=[];this.pendingAdded=new Set();this.structureChanged=true;this.selected=new Set();this.usedWrappers=[];this.dirty=true;this.closed=false;this.reconcileNeeded=false;this.rebuilds=0;this.reconciles=0;this.appends=0;this.insertions=0;this.removals=0;this.tailRemovals=0;this.selections=0;this.stats={};
  const index=this;
  this.groupView=Object.freeze({get ready(){return !index.closed&&!index.reconcileNeeded;},get closed(){return index.closed;},get size(){return index.groups.size;},get revision(){return index.groupRevision;},[Symbol.iterator](){return index.groups.values();}});
  // Three reuses its child event objects. An earlier reentrant listener can
  // clear event.child; recover the registry instead of losing the outer edit.
  this.onAdded=function(e){if(!index.nodes.has(this))return;if(e.child&&e.child.parent===this)index.registerTree(e.child);else index.invalidateRegistry();};
  this.onRemoved=function(e){if(!index.nodes.has(this))return;if(e.child&&e.child.parent===null)index.unregisterTree(e.child);else index.invalidateRegistry();};
  this.registerTree(scene);scenes.set(scene,this);
 }
 registerTree(root){
  if(this.closed)return;
  if(!root){this.invalidateRegistry();return;}
  const stable=!this.dirty,added=[];let existing=false;
  root.traverse(o=>{if(this.nodes.has(o)){if(drawable(o))existing=true;return;}this.nodes.set(o,{wrapper:null,listed:false});if(o.isGroup){this.groups.add(o);this.groupRevision++;}o.addEventListener('childadded',this.onAdded);o.addEventListener('childremoved',this.onRemoved);if(drawable(o)){this.drawables.add(o);this.pendingAdded.add(o);added.push(o);this.dirty=true;}});
  if(stable&&added.length&&added.length<=2048&&!existing){
   const previous=this.previousDrawable(root),at=previous===null?0:previous?this.ordered.indexOf(previous)+1:0;
   if(previous!==undefined&&(previous===null||(at>0&&this.nodes.get(previous)?.listed))){
    if(at===this.ordered.length){for(const object of added)this.ordered.push(object);this.appends++;}
    else{this.ordered.splice(at,0,...added);this.insertions++;}
    for(const object of added){this.nodes.get(object).listed=true;this.pendingAdded.delete(object);}this.dirty=this.structureChanged||this.pendingAdded.size>0;
   }else this.invalidateRegistry();
  }
 }
 previousDrawable(root){
  for(let node=root;node!==this.scene;){
   const parent=node.parent;if(!parent)return undefined;const at=parent.children.indexOf(node);if(at<0)return undefined;
   for(let i=at-1;i>=0;i--){const previous=lastDrawable(parent.children[i]);if(previous)return previous;}
   if(drawable(parent))return parent;node=parent;
  }
  return null;
 }
 invalidateRegistry(){this.reconcileNeeded=true;this.structureChanged=true;this.dirty=true;}
 reconcileRegistry(){
  const live=new Set();this.scene.traverse(o=>live.add(o));
  for(const [object,entry] of this.nodes)if(!live.has(object)){entry.wrapper?.children.splice(0);object.removeEventListener('childadded',this.onAdded);object.removeEventListener('childremoved',this.onRemoved);this.nodes.delete(object);this.drawables.delete(object);if(this.groups.delete(object))this.groupRevision++;}
  this.registerTree(this.scene);this.rebuildOrder();this.reconcileNeeded=false;this.reconciles++;
 }
 rebuildOrder(){this.ordered.length=0;this.scene.traverse(o=>{if(this.drawables.has(o)){this.ordered.push(o);this.nodes.get(o).listed=true;}});this.pendingAdded.clear();this.structureChanged=false;this.dirty=false;this.rebuilds++;}
 unregisterTree(root){
  if(!root){this.invalidateRegistry();return;}
  const removed=[];
  root.traverse(o=>{const entry=this.nodes.get(o);if(!entry)return;entry.wrapper?.children.splice(0);o.removeEventListener('childadded',this.onAdded);o.removeEventListener('childremoved',this.onRemoved);if(entry.listed)removed.push(o);this.pendingAdded.delete(o);this.nodes.delete(o);this.drawables.delete(o);if(this.groups.delete(o))this.groupRevision++;});
  if(removed.length){
   const start=this.ordered.indexOf(removed[0]);
   if(!this.dirty&&start>=0&&removed.every((object,i)=>this.ordered[start+i]===object)){if(start+removed.length===this.ordered.length){this.ordered.length=start;this.tailRemovals++;}else{this.ordered.splice(start,removed.length);this.removals++;}}
   else this.structureChanged=true;
  }
  this.dirty=this.structureChanged||this.pendingAdded.size>0;
 }
 fallback(reason,started){this.stats={...this.stats,fallback:reason,selectionMs:performance.now()-started,registeredNodes:this.nodes.size,registeredDrawables:this.drawables.size};return this.scene;}
 prepare(camera,renderer){
  const started=performance.now();this.selections++;
  if(this.closed)return this.fallback('closed',started);
  if(this.reconcileNeeded){this.reconcileRegistry();return this.fallback('registry-reconcile',started);}
  const source=this.scene;
  if(!source.isScene||source.onBeforeRender!==beforeRender||source.onAfterRender!==afterRender)return this.fallback('scene-callback',started);
  if(renderer?.shadowMap?.enabled)return this.fallback('shadows',started);
  if(renderer?.sortObjects===false)return this.fallback('unsorted',started);
  if(source.overrideMaterial?.onBeforeRender!==undefined&&source.overrideMaterial.onBeforeRender!==materialRender)return this.fallback('override-callback',started);
  if(this.dirty)this.rebuildOrder();
  for(const wrapper of this.usedWrappers)wrapper.children.length=0;this.usedWrappers.length=0;this.view.children.length=0;this.selected.clear();
  let active=0,covered=0;
  for(const object of this.ordered){
   // Layers are local: a disabled ancestor must not hide an enabled child.
   if(!object.visible||!object.layers.test(camera.layers))continue;
   let group=null,parent=object.parent,visible=true,ancestorSelected=false;
   while(parent&&parent!==source){if(!parent.visible){visible=false;break;}if(!group&&parent.isGroup&&parent.layers.test(camera.layers))group=parent;if(this.selected.has(parent))ancestorSelected=true;parent=parent.parent;}
   if(!visible||parent!==source||!source.visible)continue;
   if(object.isLOD)return this.fallback('lod',started);
   if(object.isSkinnedMesh)return this.fallback('skinned',started);
   if(object.onBeforeRender!==beforeRender||object.onAfterRender!==afterRender)return this.fallback('object-callback',started);
   const materials=object.material;
   if(Array.isArray(materials)){for(const material of materials)if(material&&material.onBeforeRender!==materialRender)return this.fallback('material-callback',started);}
   else if(materials&&materials.onBeforeRender!==materialRender)return this.fallback('material-callback',started);
   active++;
   if(ancestorSelected){covered++;continue;}
   this.selected.add(object);
   // groupOrder is separate from the drawable's renderOrder. A small wrapper
   // preserves both, and source DFS order also preserves the light order.
   if(group?.renderOrder){
    const entry=this.nodes.get(object);
    const wrapper=entry.wrapper??=new THREE.Group();wrapper.matrixAutoUpdate=false;wrapper.matrixWorldAutoUpdate=false;wrapper.layers.mask=-1;wrapper.renderOrder=group.renderOrder;wrapper.children.push(object);this.usedWrappers.push(wrapper);this.view.children.push(wrapper);
   }else this.view.children.push(object);
  }
  // Match ordinary renderer ownership: keep authored world matrices and update
  // the source only when the renderer would normally update it itself.
  if(source.matrixWorldAutoUpdate)source.updateMatrixWorld();
  this.view.visible=source.visible;this.view.matrix.copy(source.matrix);this.view.matrixWorld.copy(source.matrixWorld);
  for(const property of sceneProperties)this.view[property]=source[property];
  this.stats={fallback:null,registeredNodes:this.nodes.size,registeredDrawables:this.drawables.size,active,covered,frontiers:this.selected.size,wrappers:this.usedWrappers.length,rebuilds:this.rebuilds,reconciles:this.reconciles,appends:this.appends,insertions:this.insertions,removals:this.removals,tailRemovals:this.tailRemovals,selections:this.selections,selectionMs:performance.now()-started};
  return this.view;
 }
 dispose(){
  if(this.closed)return;this.closed=true;
  for(const [object,entry] of this.nodes){object.removeEventListener('childadded',this.onAdded);object.removeEventListener('childremoved',this.onRemoved);if(entry.wrapper)entry.wrapper.children.length=0;}
  this.view.children.length=0;this.nodes.clear();this.drawables.clear();this.groups.clear();this.groupRevision++;this.pendingAdded.clear();this.ordered.length=0;this.usedWrappers.length=0;this.selected.clear();if(scenes.get(this.scene)===this)scenes.delete(this.scene);
 }
}
