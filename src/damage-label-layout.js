// Presentation only. Keep every damage accumulator; suppress overlapping paint.
export function selectDamageLabels(labels,width,height,limit=16){
 const selected=[],ordered=labels.map((label,index)=>({...label,index})).sort((a,b)=>Number(!!b.killed)-Number(!!a.killed)||Number(!!b.critical)-Number(!!a.critical)||a.index-b.index);
 for(const label of ordered){
  if(!Number.isFinite(label.x+label.y+label.width+label.height)||label.width<0||label.height<0)continue;
  const box={left:label.x-label.width/2-5,right:label.x+label.width/2+5,top:label.y-label.height+2,bottom:label.y+(label.killed?20:6)};
  if(box.right<0||box.left>width||box.bottom<0||box.top>height)continue;
  if(selected.some(other=>box.left<other.box.right&&box.right>other.box.left&&box.top<other.box.bottom&&box.bottom>other.box.top))continue;
  selected.push({...label,box});if(selected.length>=limit)break;
 }
 return selected;
}
