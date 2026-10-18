// Velocity steering preserves momentum when formations or attack targets change.
export function moveEnemy(ship, direction, speed, dt) {
  const heavy=ship.fleetRole==='flagship'||ship.kind==='carrier'||ship.kind==='boss';
  const blend=1-Math.exp(-dt*(heavy?1.8:4));
  ship.velocity??={x:0,y:0,z:0};
  for(const axis of ['x','y','z']) {
    ship.velocity[axis]+=(direction[axis]*speed-ship.velocity[axis])*blend;
    ship.position[axis]+=ship.velocity[axis]*dt;
  }
  if(Math.hypot(ship.velocity.x,ship.velocity.z)>.15) {
    const target=Math.atan2(-ship.velocity.x,-ship.velocity.z);
    const delta=Math.atan2(Math.sin(target-ship.heading),Math.cos(target-ship.heading));
    const limit=dt*(heavy?1.1:2.8);
    ship.heading+=Math.max(-limit,Math.min(limit,delta));
  }
}
export function arriveEnemy(ship, destination, dt) {
  const delta={x:destination.x-ship.position.x,y:destination.y-ship.position.y,z:destination.z-ship.position.z};
  const distance=Math.hypot(delta.x,delta.y,delta.z);
  const speed=Math.min(ship.speed,distance/(ship.fleetRole==='flagship'?1.4:.85));
  const direction=distance>.01?{x:delta.x/distance,y:delta.y/distance,z:delta.z/distance}:{x:0,y:0,z:0};
  moveEnemy(ship,direction,speed,dt);
}
