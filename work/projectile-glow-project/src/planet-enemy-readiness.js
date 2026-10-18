// A discarded planetary model must settle its preparation promise even when
// mountAsset correctly ignores the later GLB completion callback.
export function beginPlanetAssetReadiness(root){
 let resolve,settled=false,disposed=false;root.userData.assetReady=new Promise(done=>{resolve=done;});
 const complete=value=>{if(settled)return false;settled=true;resolve(value);return true;};
 const previous=root.userData.dispose;root.userData.dispose=()=>{if(disposed)return;disposed=true;complete(false);previous?.();};
 return {complete};
}
