// Mobs + health: passive drops, hostile chases & damages, death/respawn, fall damage, night spawning, day burning.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5322); const { browser, page, errs } = await open(chromium, 5322)
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__, o = {}; localStorage.clear(); g.newWorld(42); g.play(); g.manual = true; g.mobsEnabled = false
  await g.whenIdle()
  const P = g.player
  // flat arena
  const x0 = Math.floor(P.pos.x), z0 = Math.floor(P.pos.z), y0 = Math.round(P.pos.y)
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) { g.world.set(x0 + dx, y0 - 1, z0 + dz, 3); for (let dy = 0; dy < 6; dy++) g.world.set(x0 + dx, y0 + dy, z0 + dz, 0) }
  P.pos.set(x0 + 0.5, y0, z0 + 0.5); P.yaw = 0; P.pitch = -0.25; g.advance(0.2); await g.whenIdle()
  // passive mob: hit until dead -> meat
  const m = g.spawnMob('pompon', x0 + 0.5, y0, z0 - 1.5); m.update = function (dt, gg) { this.mesh.position.copy(this.pos); this.mat.color.setScalar(1) } // hold still for the test
  const meat0 = g.inv[104] || 0; g.input.breaking = true; let hits = 0
  for (let i = 0; i < 300 && g.mobs.includes(m); i++) { const hp = m.hp; g.advance(1 / 60); if (m.hp < hp) hits++ }
  g.input.breaking = false
  o.pomHits = hits; o.pomDead = !g.mobs.includes(m); o.meat = (g.inv[104] || 0) > meat0
  // hostile: chases and damages
  g.hp = 20; const sm = g.spawnMob('sombrajo', x0 + 0.5, y0, z0 + 6.5); g.time = 0.75
  const d0 = sm.pos.distanceTo(P.pos); g.advance(1.2); o.chase = sm.pos.distanceTo(P.pos) < d0 - 2
  g.advance(3); o.hpAfter = g.hp; o.damaged = g.hp < 20
  // kill the hostile -> coal
  const c0 = g.inv[101] || 0; P.yaw = Math.atan2(P.pos.x - sm.pos.x, P.pos.z - sm.pos.z); P.pitch = -0.1
  g.input.breaking = true
  for (let i = 0; i < 600 && g.mobs.includes(sm); i++) { const d = sm.pos.clone().sub(P.pos); P.yaw = Math.atan2(-d.x, -d.z); P.pitch = Math.atan2(d.y + 1 - 1.62, Math.hypot(d.x, d.z)); g.advance(1 / 60) }
  g.input.breaking = false; o.somDead = !g.mobs.includes(sm); o.coal = (g.inv[101] || 0) > c0
  // death + respawn
  g.damage(50, null, 'test'); o.dead = g.dead; await new Promise((r) => setTimeout(r, 50)); o.deadUI = !document.querySelector('#dead').classList.contains('hidden')
  document.querySelector('#respawn').click(); o.respawned = !g.dead && g.hp === 20
  // fall damage: 12 blocks
  P.pos.set(x0 + 0.5, y0 + 12, z0 + 0.5); P.vel.set(0, 0, 0); g.advance(3); o.fallHp = g.hp; o.fall = g.hp < 20 && g.hp > 0
  // small drop: no damage
  g.hp = 20; P.pos.set(x0 + 0.5, y0 + 3, z0 + 0.5); g.advance(2); o.smallDrop = g.hp === 20
  // natural night spawning in the dark
  for (const mm of g.mobs) mm.dispose(g.scene); g.mobs = []; g.noDamage = true
  g.mobsEnabled = true; g.time = 0.75; g.advance(30); o.nightSpawn = g.mobs.filter((x) => x.type === 'sombrajo').length
  // daylight burns hostiles under open sky
  g.mobsEnabled = false; g.time = 0.3; const nb = g.mobs.filter((x) => x.type === 'sombrajo').length; g.advance(8); o.dayBurn = nb > 0 && g.mobs.filter((x) => x.type === 'sombrajo').length < nb
  o.drawCallsPerMob = 1
  return o
})
console.log(JSON.stringify(r))
check('Pompón recibe golpes y muere', r.pomDead && r.pomHits >= 2, 'golpes=' + r.pomHits); check('Pompón suelta carne', r.meat)
check('Sombrajo persigue de noche', r.chase); check('Sombrajo hace daño', r.damaged, 'vida=' + r.hpAfter)
check('Sombrajo muere y suelta carbón', r.somDead && r.coal)
check('muerte muestra pantalla', r.dead && r.deadUI); check('reaparecer restaura la vida', r.respawned)
check('daño por caída (12 bloques)', r.fall, 'vida=' + r.fallHp); check('caída pequeña sin daño', r.smallDrop)
check('aparecen Sombrajos de noche', r.nightSpawn > 0, 'n=' + r.nightSpawn); check('de día se desvanecen', r.dayBurn)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
