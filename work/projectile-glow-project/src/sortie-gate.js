export class SortieGate {
 constructor(clock=()=>performance.now()){this.clock=clock;this.started=clock();this.metrics={steps:[],samples:0,violations:0};this.initial=null;this.mark('click');}
 mark(name,extra={}){this.metrics.steps.push({name,ms:this.clock()-this.started,...extra});}
 hold(sim){sim.phase='paused';this.initial={time:sim.time,hp:sim.player.hp,shield:sim.player.shield};this.mark('simulation-held',this.initial);}
 sample(sim){if(!this.initial)return;this.metrics.samples++;if(sim.time!==this.initial.time||sim.player.hp!==this.initial.hp||sim.player.shield!==this.initial.shield)this.metrics.violations++;}
 release(sim){this.sample(sim);if(this.metrics.violations)throw new Error('Preparation changed combat state');sim.phase='playing';this.mark('input-ready',{time:sim.time,hp:sim.player.hp,shield:sim.player.shield});}
}

export function restorePreparedBase(sim,meta,location){sim.meta=structuredClone(meta);sim.campaignDock=null;sim.phase='menu';return sim.openCampaignBase(location);}

