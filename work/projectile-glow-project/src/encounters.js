// Distributed approach lanes: alternating opposites prevents one-sided reinforcements.
const LANES=[0,4,2,6,1,5,3,7];
export function approachPosition(player,index,random,mode='survival'){
 const lane=LANES[index%8],angle=lane*Math.PI/4+(random()-.5)*.28;
 const radius=60+random()*18,height=(index%2?1:-1)*(8+random()*16);
 const limit=mode==='galaxy'?380:28;
 return {x:player.position.x+Math.cos(angle)*radius+player.velocity.x*.65,y:Math.max(-limit,Math.min(limit,player.position.y+height)),z:player.position.z+Math.sin(angle)*radius+player.velocity.z*.65};
}
export function encounterPressure(time,sector=1){const late=Math.max(0,time-45);return {hp:1+(sector-1)*.22+time/650+Math.min(late,315)/180,damage:1+(sector-1)*.12+Math.min(late,315)/420,speed:1+Math.min(late,315)/1800};}
export const nextLevelXp=level=>7+Math.floor(level*3.7+Math.max(0,level-8)**2*.22);

