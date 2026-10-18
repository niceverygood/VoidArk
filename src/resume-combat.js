export function resumeCombat(sim,ui){
  // A level-up can replace the paused simulation while a secondary dialog is open.
  if(sim.phase==='upgrade'){ui.showUpgrades(sim.choices,sim);return true;}
  if(sim.phase==='paused'&&!sim.setPaused(false))return false;
  if(sim.phase!=='playing')return false;
  ui.hideModal();return true;
}
