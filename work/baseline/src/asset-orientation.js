const horizontalModules=new Set(['module-engine','guided-missile','module-cannon','module-laser','module-missile','rail-turret','interceptor-turret']);
const authoredNegativeXHulls=new Set(['vessel-bastion','vessel-swift','vessel-raptor','vessel-seraph','vessel-chronos','vessel-foundry']);

// Verified wide hulls have authored -X bows that their bounding boxes cannot identify.
export function assetYaw(id,extent) {
  if(authoredNegativeXHulls.has(id))return -Math.PI/2;
  if(typeof id!=='string')return 0;
  const horizontal=/nation-.*-(scout|cruiser|carrier)$/.test(id)||id.startsWith('vessel-')||/^enemy-.*-(fighter|capital)$/.test(id)||horizontalModules.has(id);
  return horizontal&&extent?.x>extent?.z*1.05?-Math.PI/2:0;
}
