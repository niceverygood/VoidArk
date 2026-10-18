const hashCell=(x,y,z)=>Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791);
const ordered=(a,b)=>a-b;
const safeBounds=(x0,x1,y0,y1,z0,z1)=>Number.isSafeInteger(x0)&&Number.isSafeInteger(x1)&&Number.isSafeInteger(y0)&&Number.isSafeInteger(y1)&&Number.isSafeInteger(z0)&&Number.isSafeInteger(z1);

// Conservative 3D broadphase. All damage remains in the simulation's swept test.
export class ShotCollisionGrid {
  constructor(cellSize=16,maxCells=64) {
    this.inverseCell=1/cellSize;this.maxCells=maxCells;this.cells=new Map();this.buckets=[];this.indices=[];this.candidates=[];this.large=[];this.marks=new Uint32Array(0);this.stamp=0;
  }
  prepare(enemies) {
    this.enemies=enemies;this.cells.clear();this.large.length=0;let used=0;
    if(this.marks.length<enemies.length)this.marks=new Uint32Array(enemies.length);
    for(let index=0;index<enemies.length;index++) {
      const e=enemies[index];if(e.hp<=0)continue;
      const p=e.position,r=Math.max(0,e.radius),pad=Math.max(1,Math.abs(p.x),Math.abs(p.y),Math.abs(p.z),r)*Number.EPSILON*16;
      const x0=Math.floor((p.x-r-pad)*this.inverseCell),x1=Math.floor((p.x+r+pad)*this.inverseCell),y0=Math.floor((p.y-r-pad)*this.inverseCell),y1=Math.floor((p.y+r+pad)*this.inverseCell),z0=Math.floor((p.z-r-pad)*this.inverseCell),z1=Math.floor((p.z+r+pad)*this.inverseCell);
      const count=(x1-x0+1)*(y1-y0+1)*(z1-z0+1);
      if(!Number.isFinite(count)||count>this.maxCells||!safeBounds(x0,x1,y0,y1,z0,z1)){this.large.push(index);continue;}
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++) {
        const key=hashCell(x,y,z);let bucket=this.cells.get(key);
        if(!bucket){bucket=this.buckets[used]||(this.buckets[used]=[]);used++;bucket.length=0;this.cells.set(key,bucket);}
        bucket.push(index);
      }
    }
    // Reuse occupied buckets next frame; no historical cells are kept alive in the map.
    this.usedBuckets=used;return this;
  }
  query(from,to,radius) {
    const enemies=this.enemies,r=Math.max(0,radius),pad=Math.max(1,Math.abs(from.x),Math.abs(from.y),Math.abs(from.z),Math.abs(to.x),Math.abs(to.y),Math.abs(to.z),r)*Number.EPSILON*16;
    const x0=Math.floor((Math.min(from.x,to.x)-r-pad)*this.inverseCell),x1=Math.floor((Math.max(from.x,to.x)+r+pad)*this.inverseCell),y0=Math.floor((Math.min(from.y,to.y)-r-pad)*this.inverseCell),y1=Math.floor((Math.max(from.y,to.y)+r+pad)*this.inverseCell),z0=Math.floor((Math.min(from.z,to.z)-r-pad)*this.inverseCell),z1=Math.floor((Math.max(from.z,to.z)+r+pad)*this.inverseCell);
    const count=(x1-x0+1)*(y1-y0+1)*(z1-z0+1);
    if(!Number.isFinite(count)||count>this.maxCells||!safeBounds(x0,x1,y0,y1,z0,z1))return enemies;
    this.stamp=(this.stamp+1)>>>0;if(!this.stamp){this.marks.fill(0);this.stamp=1;}
    const indices=this.indices;indices.length=0;
    for(const index of this.large){this.marks[index]=this.stamp;indices.push(index);}
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++) {
      const bucket=this.cells.get(hashCell(x,y,z));if(!bucket)continue;
      for(const index of bucket)if(this.marks[index]!==this.stamp){this.marks[index]=this.stamp;indices.push(index);}
    }
    // Dense overlap is cheaper in the original array and already has stable ordering.
    if(indices.length>enemies.length*.65)return enemies;
    indices.sort(ordered);const candidates=this.candidates;candidates.length=indices.length;
    for(let i=0;i<indices.length;i++)candidates[i]=enemies[indices[i]];
    return candidates;
  }
  release(){this.enemies=null;this.cells.clear();this.candidates.length=0;this.indices.length=0;this.large.length=0;}
}
