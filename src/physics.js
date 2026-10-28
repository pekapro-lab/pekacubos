import { isSolid } from './blocks.js'
// Axis-separated AABB vs voxel collision. body: { pos, vel, w (half width), h, onGround }
export function boxHits(world, p, w, h) {
  for (let y = Math.floor(p.y); y <= Math.floor(p.y + h - 1e-4); y++)
    for (let z = Math.floor(p.z - w); z <= Math.floor(p.z + w - 1e-4); z++)
      for (let x = Math.floor(p.x - w); x <= Math.floor(p.x + w - 1e-4); x++) if (isSolid(world.get(x, y, z))) return true
  return false
}
function moveAxis(world, b, ax, d) {
  const p = b.pos; if (!d) return false
  p[ax] += d
  if (!boxHits(world, p, b.w, b.h)) return false
  if (ax === 'y') { if (d < 0) { p.y = Math.floor(p.y) + 1; b.onGround = true } else p.y = Math.floor(p.y + b.h) - b.h - 1e-3 }
  else p[ax] = d > 0 ? Math.floor(p[ax] + b.w) - b.w - 1e-3 : Math.floor(p[ax] - b.w) + 1 + b.w + 1e-3
  b.vel[ax] = 0
  return true
}
export function moveBody(world, b, dt) {
  b.onGround = false; let hitX = false
  const steps = Math.ceil(Math.max(Math.abs(b.vel.x), Math.abs(b.vel.y), Math.abs(b.vel.z)) * dt / 0.3) || 1
  for (let i = 0; i < steps; i++) {
    moveAxis(world, b, 'y', b.vel.y * dt / steps)
    if (moveAxis(world, b, 'x', b.vel.x * dt / steps)) hitX = true
    if (moveAxis(world, b, 'z', b.vel.z * dt / steps)) hitX = true
  }
  return hitX
}
