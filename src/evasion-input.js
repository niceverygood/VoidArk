// Match the camera-relative horizontal movement axes, regardless of ship heading.
export function lateralEvasion(code, yaw) {
  const side = code === 'KeyZ' ? -1 : code === 'KeyC' ? 1 : 0;
  return side ? { x: side * Math.cos(yaw), y: 0, z: -side * Math.sin(yaw) } : null;
}
