const MIN_NORMAL=2.2250738585072014e-308;

// Conservative rejection only. Native Math.hypot still decides accepted
// candidates, ties and range boundaries in the caller's original order.
export function distanceMayBeInside(x,y,z,radius){
 if(typeof radius!=='number')return true;
 if(radius<=0)return false;
 const squared=x*x+y*y+z*z,limit=radius*radius,scale=Math.max(squared,limit);
 // Squared subnormals lose relative precision; NaN/overflow/Infinity retain
 // the native path rather than attempting to order rounded squared values.
 if(scale<MIN_NORMAL||!Number.isFinite(scale))return true;
 return squared-limit<=Number.EPSILON*scale*8;
}
