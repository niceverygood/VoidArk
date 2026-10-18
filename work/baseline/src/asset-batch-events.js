// A registry belongs to one scene. Preview scenes without a registry are no-ops.
// This module does not own imported geometry/materials or retain detached models.
const scenes=new WeakMap();
export function bindAssetBatchScene(scene,batch){scenes.set(scene,batch);}
export function unbindAssetBatchScene(scene,batch){if(scenes.get(scene)===batch)scenes.delete(scene);}
export function assetInstancesFor(scene){return scenes.get(scene);}
function batchFor(root){let o=root;while(o&&!o.isScene)o=o.parent;return o?scenes.get(o):null;}
export function notifyAssetBatchAttached(root){batchFor(root)?.registerTree(root);}
export function notifyAssetBatchRemoved(root){batchFor(root)?.unregisterTree(root);}
export function notifyAssetBatchChanged(root){batchFor(root)?.markTree(root);}
