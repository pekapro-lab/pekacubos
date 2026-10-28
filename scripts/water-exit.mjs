// Water exit: in a 2-deep pool with a 1-block shore, holding jump swims up and walking into the shore
// climbs out onto land; placing a block under you while swimming works (water cells are replaceable).
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5327); const { browser, page, errs } = await open(chromium, 5327)
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__, o = {}; localStorage.clear(); g.newWorld(42); g.play(); g.manual = true; g.mobsEnabled = false; g.noDamage = true
  const P = g.player, W = g.world, Y = 90
  const cx = Math.floor(P.pos.x), cz = Math.floor(P.pos.z)
  // stone basin: floor at Y, ground level Y+2 (top surface Y+3), pool 5x5 of water at Y+1..Y+2 (surface 1 below the shore)
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) { W.set(cx + dx, Y, cz + dz, 3); for (let y = Y + 1; y <= Y + 2; y++) W.set(cx + dx, y, cz + dz, 3); for (let y = Y + 3; y <= Y + 6; y++) W.set(cx + dx, y, cz + dz, 0) }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { W.set(cx + dx, Y + 1, cz + dz, 5, 0); W.set(cx + dx, Y + 2, cz + dz, 5, 0) }
  W.active.clear()
  const reset = () => { P.pos.set(cx + 0.5, Y + 1, cz + 0.5); P.vel.set(0, 0, 0) }
  reset(); g.advance(0.1); await g.whenIdle(); reset()
  // 1) hold jump + walk forward to the shore (yaw 0 = -z)
  P.yaw = 0; P.pitch = 0; g.input.jump = true; g.input.mz = 1
  let t = 0, out = false
  for (; t < 8 && !out; t += 1 / 60) { g.advance(1 / 60); out = P.onGround && !P.inWater && P.pos.y >= Y + 3 - 0.01 && Math.abs(P.pos.z - (cz + 0.5)) > 2.6 }
  g.input.jump = false; g.input.mz = 0
  o.out = out; o.t = t; o.y = P.pos.y
  // 2) just holding jump (no walking) reaches the surface
  reset(); let top = 0; g.input.jump = true; for (let i = 0; i < 180; i++) { g.advance(1 / 60); top = Math.max(top, P.pos.y) } g.input.jump = false
  o.top = top
  // 3) place a block under the feet while swimming up (pillar out of water)
  reset(); g.inv[8] = 10; g.sel = g.hotbar.indexOf(8); P.pitch = -Math.PI / 2 + 0.01
  g.input.jump = true; let placed = false
  for (let i = 0; i < 180 && !placed; i++) { g.advance(1 / 60); g.place(); placed = W.get(cx, Y + 1, cz) === 8 || W.get(cx, Y + 2, cz) === 8 }
  g.input.jump = false; g.advance(0.3)
  o.placed = placed
  return o
})
console.log(JSON.stringify(r))
check('saltando + andando sale del agua a tierra', r.out, `t=${r.t.toFixed(2)}s y=${r.y.toFixed(2)}`)
check('manteniendo salto nada hasta la superficie', r.top >= 93, 'y máx=' + r.top.toFixed(2))
check('se puede poner un bloque debajo en el agua', r.placed)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
