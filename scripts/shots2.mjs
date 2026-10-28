// v2 gameplay screenshots -> shots/v2-*.png
import { chromium } from 'playwright'
import { serve, open } from './serve.mjs'
const s = await serve(5331); const { browser, page } = await open(chromium, 5331)
const go = (f) => page.evaluate(f)
await go(async () => { localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(42); g.viewDist = 5; g.play(); g.manual = true; g.mobsEnabled = false; g.noDamage = true; g.advance(0.3); await g.whenIdle() })
// day: mobs + flowing water down a slope
await go(async () => { const g = window.__PEKACUBOS__, P = g.player, W = g.world, x = Math.floor(P.pos.x), z = Math.floor(P.pos.z), y = Math.round(P.pos.y)
  for (let i = 0; i < 3; i++) g.spawnMob('pompon', x - 2 + i * 2, y + 1, z - 6 - i)
  for (const m of g.mobs) { m.update(0.016, g); m.update = function () { this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw + 3.14; this.mat.color.setScalar(1) } }
  for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) W.set(x + 3 + dx, y + 2, z - 4 + dz, 3)
  W.set(x + 4, y + 3, z - 3, 5, 0); g.advance(6); P.yaw = 0.3; P.pitch = -0.25; await g.whenIdle() })
await page.waitForTimeout(300); await page.screenshot({ path: 'shots/v2-dia-pompones-agua.png' })
// night: house of planks with torches and a lantern, hostile outside
await go(async () => { const g = window.__PEKACUBOS__, P = g.player, W = g.world, x = Math.floor(P.pos.x), z = Math.floor(P.pos.z) - 9, y = Math.round(P.pos.y)
  for (const m of g.mobs) m.dispose(g.scene); g.mobs = []
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { W.set(x + dx, y - 1, z + dz, 8); for (let dy = 0; dy < 4; dy++) { const wall = Math.abs(dx) === 3 || Math.abs(dz) === 3; W.set(x + dx, y + dy, z + dz, wall && !(dz === 3 && Math.abs(dx) <= 1 && dy < 3) ? (dy === 1 && dx === 0 ? 10 : 8) : 0) } W.set(x + dx, y + 4, z + dz, 8) }
  W.set(x - 2, y, z - 2, 12); W.set(x + 2, y, z - 2, 12); W.set(x, y, z - 2, 13); W.set(x + 2, y, z + 1, 15)
  W.set(x - 6, y, z + 5, 12)
  g.time = 0.78; P.pos.set(x + 0.5, y, z + 8.5); P.yaw = 0; P.pitch = -0.08; g.hotbar[g.sel] = 12
  const sm = g.spawnMob('sombrajo', x - 4.5, y, z + 6); sm.update(0.016, g); sm.update = function (dt, gg) { this.mesh.position.copy(this.pos); this.yaw = 2.6; this.mesh.rotation.y = this.yaw; this.mat.color.setScalar(gg.lightAtBody(this.pos.x, this.pos.y + 1, this.pos.z) + 0.3) }
  g.advance(0.1); await g.whenIdle(); g.advance(0.05) })
await page.waitForTimeout(300); await page.screenshot({ path: 'shots/v2-noche-antorchas.png' })
await go(async () => { const g = window.__PEKACUBOS__, P = g.player; P.pos.z -= 7; P.pitch = -0.2; g.advance(0.05) })
await page.waitForTimeout(200); await page.screenshot({ path: 'shots/v2-interior-luz.png' })
await go(() => { const g = window.__PEKACUBOS__; g.time = 0.3; g.dead = false; g.hp = 7; g.emit(); g.advance(0.02) })
await page.waitForTimeout(200); await page.screenshot({ path: 'shots/v2-interior-dia-vida.png' })
await browser.close(); s.close()
