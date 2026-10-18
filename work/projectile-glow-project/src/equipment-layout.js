export function equipmentLayout(id,rank,width,length){
 const count=Math.min(3,Math.ceil(rank/2)),slots=[];
 const z={cannon:-.26,chain:-.1,missile:.04,laser:-.34,fighter:.3,armor:.16,shield:.24,magnet:.36,reactor:.12}[id]??0;
 if(id==='reactor')return [{position:[0,.9+rank*.06,length*z],size:1.15+rank*.22}];
 for(let row=0;row<count;row++)for(const side of [-1,1])slots.push({position:[side*width*(id==='armor'?.35:.34),.65+rank*.045,length*z+(row-(count-1)/2)*.7],size:(id==='armor'?.7:1)+rank*.12});
 return slots;
}
