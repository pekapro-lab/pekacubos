import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WATER, GRASS, MEAT, COAL } from './blocks.js'
import { moveBody } from './physics.js'
// Original code-built creatures (one merged mesh = one draw call each).
// "Pompón": round pastel fluff ball that hops around (passive). "Sombrajo": tall shadow with glowing eyes (night, hostile).
function box(w, h, d, x, y, z, col) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z)
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { const sh = 0.82 + 0.18 * ((i >> 2) % 3) / 2; a[i * 3] = c.r * sh; a[i * 3 + 1] = c.g * sh; a[i * 3 + 2] = c.b * sh }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g
}
let GEO
function geos() {
  if (GEO) return GEO
  const pom = mergeGeometries([
    box(0.9, 0.7, 0.9, 0, 0.45, 0, 0xf2c6e8), box(0.7, 0.18, 0.7, 0, 0.88, 0, 0xf7d9ef), // body + fluffy top
    box(0.12, 0.12, 0.05, -0.18, 0.55, -0.46, 0x221622), box(0.12, 0.12, 0.05, 0.18, 0.55, -0.46, 0x221622), // eyes
    box(0.16, 0.08, 0.05, 0, 0.4, -0.46, 0xd46a9a), // mouth
    box(0.14, 0.3, 0.14, -0.28, 1.0, 0.05, 0xe3a6d6), box(0.14, 0.3, 0.14, 0.28, 1.0, 0.05, 0xe3a6d6), // antennae
    box(0.2, 0.12, 0.25, -0.25, 0.06, -0.1, 0xc98ab8), box(0.2, 0.12, 0.25, 0.25, 0.06, -0.1, 0xc98ab8), // feet
  ])
  const som = mergeGeometries([
    box(0.62, 1.1, 0.42, 0, 0.75, 0, 0x2b2350), box(0.5, 0.5, 0.5, 0, 1.55, 0, 0x352c63), // body + head
    box(0.14, 0.07, 0.05, -0.12, 1.6, -0.26, 0x6ff7ff), box(0.14, 0.07, 0.05, 0.12, 1.6, -0.26, 0x6ff7ff), // glowing eyes
    box(0.16, 0.9, 0.16, -0.42, 0.85, -0.05, 0x1f1840), box(0.16, 0.9, 0.16, 0.42, 0.85, -0.05, 0x1f1840), // arms
    box(0.5, 0.25, 0.36, 0, 0.12, 0, 0x181233), // wispy base
  ])
  GEO = { pom, som }; return GEO
}
export const MOB_TYPES = {
  pompon: { name: 'Pompón', hp: 8, w: 0.45, h: 1.0, speed: 1.6, hostile: false, drop: [MEAT, 1, 2] },
  sombrajo: { name: 'Sombrajo', hp: 16, w: 0.32, h: 1.85, speed: 3.0, hostile: true, drop: [COAL, 1, 2], dmg: 3 },
}
export class Mob {
  constructor(type, x, y, z, scene) {
    const T = MOB_TYPES[type]
    this.type = type; this.T = T; this.hp = T.hp; this.w = T.w; this.h = T.h
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3(); this.yaw = Math.random() * 6.28; this.onGround = false
    this.timer = 0; this.hurt = 0; this.cd = 0; this.flee = 0; this.anim = Math.random() * 6; this.dead = false
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true })
    this.mesh = new THREE.Mesh(type === 'pompon' ? geos().pom : geos().som, this.mat)
    scene.add(this.mesh)
  }
  update(dt, g) {
    const P = g.player.pos, T = this.T, w = g.world
    const dx = P.x - this.pos.x, dz = P.z - this.pos.z, dist = Math.hypot(dx, dz)
    let mx = 0, mz = 0, sp = T.speed
    this.timer -= dt; this.cd -= dt; this.hurt -= dt; this.flee -= dt
    if (T.hostile && dist < 20 && !g.dead) { // chase
      this.yaw = Math.atan2(-dx, -dz); mx = dx / (dist || 1); mz = dz / (dist || 1)
      if (dist < 1.1 + this.w && Math.abs(P.y - this.pos.y) < 1.6 && this.cd <= 0) { this.cd = 1; g.damage(T.dmg, this.pos) }
      if (dist < 0.9) { mx = mz = 0 }
    } else if (this.flee > 0) { this.yaw = Math.atan2(dx, dz); mx = -dx / (dist || 1); mz = -dz / (dist || 1); sp *= 1.8 }
    else {
      if (this.timer <= 0) { this.timer = 2 + Math.random() * 4; this.wander = Math.random() < 0.6; this.yaw += (Math.random() - 0.5) * 3 }
      if (this.wander) { mx = -Math.sin(this.yaw); mz = -Math.cos(this.yaw) }
    }
    const kx = this.vel.x * 0.85, kz = this.vel.z * 0.85 // keep knockback decaying
    this.vel.x = mx * sp + (this.hurt > 0 ? kx : 0); this.vel.z = mz * sp + (this.hurt > 0 ? kz : 0)
    const inWater = w.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z)) === WATER
    this.vel.y -= (inWater ? 6 : 28) * dt; if (inWater) this.vel.y = Math.max(this.vel.y, 1.5)
    const blocked = moveBody(w, this, dt)
    if ((blocked && this.onGround) || (this.type === 'pompon' && this.onGround && (mx || mz) && Math.random() < 0.02)) this.vel.y = 7.5
    if (this.pos.y < -10) this.dead = true
    this.anim += dt * (mx || mz ? 8 : 2)
    this.mesh.position.copy(this.pos)
    if (this.type === 'sombrajo') this.mesh.position.y += Math.sin(this.anim * 0.5) * 0.05
    this.mesh.rotation.y = this.yaw
    const s = this.type === 'pompon' ? 1 + Math.sin(this.anim) * 0.05 : 1; this.mesh.scale.set(1 / s, s, 1 / s)
    const L = g.lightAtBody(this.pos.x, this.pos.y + 0.5, this.pos.z)
    if (this.hurt > 0.25) this.mat.color.setRGB(1, 0.3, 0.3); else this.mat.color.setScalar(Math.max(this.type === 'sombrajo' ? 0.35 : 0.12, L))
  }
  hit(dmg, from) {
    this.hp -= dmg; this.hurt = 0.4; this.flee = 4
    const d = this.pos.clone().sub(from).setY(0).normalize()
    this.vel.x = d.x * 8; this.vel.z = d.z * 8; this.vel.y = 5
    if (this.hp <= 0) this.dead = true
  }
  dispose(scene) { scene.remove(this.mesh); this.mat.dispose() }
}
export function rayBox(o, d, m, maxT) { // ray vs mob AABB
  const mn = [m.pos.x - m.w, m.pos.y, m.pos.z - m.w], mx = [m.pos.x + m.w, m.pos.y + m.h, m.pos.z + m.w]
  const O = [o.x, o.y, o.z], D = [d.x, d.y, d.z]; let t0 = 0, t1 = maxT
  for (let a = 0; a < 3; a++) {
    if (Math.abs(D[a]) < 1e-9) { if (O[a] < mn[a] || O[a] > mx[a]) return -1; continue }
    let ta = (mn[a] - O[a]) / D[a], tb = (mx[a] - O[a]) / D[a]; if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1
  }
  return t0
}
