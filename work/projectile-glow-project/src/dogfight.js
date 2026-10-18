export function forward(heading=0){return {x:-Math.sin(heading),y:0,z:-Math.cos(heading)};}
// Orbit positions use (cos angle, sin angle); increasing angle flies along (-sin, cos).
export function orbitHeading(angle=0){return Math.PI-angle;}
export function tailPosition(attacker,target,heading,range=55){
  const x=attacker.x-target.x,y=attacker.y-target.y,z=attacker.z-target.z,d=Math.hypot(x,y,z);
  const f=forward(heading);return d>4&&d<range&&Math.abs(y)<18&&(x*f.x+z*f.z)/d<-.65;
}
export function tailTarget(player,enemies){
  const f=forward(player.heading);
  return enemies.filter(e=>e.hp>0&&tailPosition(player.position,e.position,e.heading,55)).find(e=>{
    const x=e.position.x-player.position.x,z=e.position.z-player.position.z;
    return (x*f.x+z*f.z)/(Math.hypot(x,z)||1)>.65;
  });
}
