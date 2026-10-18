import {SortieGate} from './sortie-gate.js';

// The selected upgrade has already been applied by Simulation. This gate owns
// no model, material or texture; the live world keeps their existing lifetimes.
export class GrowthPreparation extends SortieGate {
 constructor(sim,clock){super(clock);this.attemptStarted=this.started;this.state='painting';this.closed=false;this.renders=0;this.hold(sim);}
 painted(){if(this.closed)return false;this.state='build';this.mark('loading-ui-painted');return true;}
 built(extra={}){if(this.closed||this.state!=='build')return false;this.state='assets';this.mark('models-created',extra);return true;}
 assetsReady(textures,extra={}){if(this.closed||this.state!=='assets')return false;this.textures=textures;this.textureIndex=0;this.state='textures';this.mark('assets-ready',extra);return true;}
 texturesReady(){if(this.closed||this.state!=='textures')return false;this.state='render';this.renders=0;this.mark('textures-ready');return true;}
 rendered(){if(this.closed||this.state!=='render')return false;this.mark('warm-frame-'+(++this.renders));if(this.renders===2){this.state='present';return true;}return false;}
 finish(sim){if(this.closed||this.state!=='present'||sim.phase!=='paused')return false;this.release(sim);this.closed=true;this.state='ready';return true;}
 cancel(){if(this.closed)return false;this.closed=true;this.state='cancelled';this.textures=null;this.mark('cancelled');return true;}
 fail(error){if(this.closed)return;this.state='failed';this.mark('preparation-error',{message:String(error?.message||error)});}
 retry(){if(this.closed||this.state!=='failed')return false;this.attemptStarted=this.clock();this.state='build';this.textures=null;this.textureIndex=0;this.renders=0;this.hudRequested=false;this.hudReady=false;this.mark('retry');return true;}
}
