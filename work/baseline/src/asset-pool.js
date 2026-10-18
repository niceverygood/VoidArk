/** Reference-counted asset loading with bounded network work and an idle LRU. */
export class AssetPool {
  constructor(load,dispose,{concurrency=3,idleLimit=36}={}){
    this.load=load;this.dispose=dispose;this.concurrency=concurrency;this.idleLimit=idleLimit;
    this.entries=new Map();this.queue=[];this.active=0;this.failed=0;this.failedIds=[];this.clock=0;
  }
  acquire(id){
    let entry=this.entries.get(id);
    if(!entry){
      entry={refs:0,used:++this.clock,resource:null};
      this.entries.set(id,entry);
      entry.promise=new Promise(resolve=>{
        this.queue.push(async()=>{
          try{entry.resource=await this.load(id);resolve(entry.resource);}
          catch{this.failed++;this.failedIds.push(id);this.failedIds=this.failedIds.slice(-10);resolve(null);}
          finally{if(!entry.resource&&this.entries.get(id)===entry)this.entries.delete(id);this.trim();}
        });
      });
    }
    entry.refs++;entry.used=++this.clock;this.pump();
    let released=false;
    return {ready:entry.promise,release:()=>{if(released)return;released=true;entry.refs--;entry.used=++this.clock;this.trim();}};
  }
  pump(){while(this.active<this.concurrency&&this.queue.length){const job=this.queue.shift();this.active++;job().finally(()=>{this.active--;this.pump();});}}
  trim(){
    const idle=[...this.entries].filter(([,e])=>!e.refs&&e.resource).sort((a,b)=>a[1].used-b[1].used);
    while(idle.length>this.idleLimit){const [id,e]=idle.shift();this.dispose(e.resource);this.entries.delete(id);}
  }
  diagnostics(){return {loaded:[...this.entries.values()].filter(e=>e.resource).length,loading:this.active,queued:this.queue.length,failed:this.failed,failedIds:[...this.failedIds],instances:[...this.entries.values()].reduce((n,e)=>n+e.refs,0)};}
}
