export class CombatResolution {
 constructor(){this.scale=1;this.elapsed=0;this.slow=0;this.fast=0;this.slowFPS=40;this.fastFPS=55;}
 setBudget(slowFPS=40){this.slowFPS=Math.max(40,Math.min(55,Number(slowFPS)||40));this.elapsed=this.slow=this.fast=0;}
 update(seconds,fps,active){if(!active){this.elapsed=0;return false;}this.elapsed+=seconds;if(this.elapsed<2)return false;this.elapsed=0;this.slow=fps<this.slowFPS?this.slow+1:0;this.fast=fps>this.fastFPS?this.fast+1:0;const old=this.scale;if(this.slow>=1){this.scale=Math.max(.7,this.scale-.1);this.slow=0;}else if(this.fast>=3){this.scale=Math.min(1,this.scale+.05);this.fast=0;}return Math.abs(old-this.scale)>.001;}
}

