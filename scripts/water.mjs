// Flowing water: bucket places a source, water spreads with levels (max 7), falls, dries when the source is
// taken back, updates are throttled (bounded cells per tick).
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5323); const { browser, page, errs } = await open(chromium, 5323)
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__, o = {}; localStorage.clear(); g.newWorld(42); g.play(); g.manual = true; g.mobsEnabled = false; g.noDamage = true
  const P = g.player, W = g.world
  // floating stone platform 21x21 at y=90, player stands on it
  const cx = Math.floor(P.pos.x), cz = Math.floor(P.pos.z), Y = 90
  for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) W.set(cx + dx, Y, cz + dz, 3)
  P.pos.set(cx + 0.5, Y + 1, cz + 6.5); P.vel.set(0, 0, 0); g.advance(0.2); await g.whenIdle()
  // place water from the bucket onto the platform, 3 blocks ahead
  g.inv[103] = 1; g.inv[102] = 0; g.hotbar[0] = 103; g.sel = 0
  P.yaw = 0; P.pitch = -Math.atan2(1.62 + 0.0, 3.0)
  const h = g.raycast(); const ok = g.place(); const sx = h.x + h.n[0], sy = h.y + h.n[1], sz = h.z + h.n[2]
  o.placed = ok && W.get(sx, sy, sz) === 5 && W.meta(sx, sy, sz) === 0 && g.inv[102] === 1
  const t0 = performance.now(); let maxCells = 0
  for (let i = 0; i < 40; i++) { const before = W.active.size; g.advance(0.25); maxCells = Math.max(maxCells, before) }
  o.simMs = performance.now() - t0
  let n = 0, maxL = 0, okLevels = true
  for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) if (W.get(sx + dx, sy, sz + dz) === 5) {
    n++; const L = W.meta(sx + dx, sy, sz + dz); maxL = Math.max(maxL, L); if (L !== Math.abs(dx) + Math.abs(dz) && L !== 0) okLevels = false }
  o.cells = n; o.maxL = maxL; o.okLevels = okLevels
  // flowed over the edge? platform edge 10 away in -z... sources spread 7: check water reached the edge in +z? no; check a falling column off the edge
  W.set(sx, sy, sz - 6, 0); W.set(sx, Y, sz - 6, 0) // hole in the platform at distance 6
  g.advance(3); o.falls = W.get(sx, Y, sz - 6) === 5 && W.get(sx, Y - 1, sz - 6) === 5
  await g.whenIdle(); o.waterMesh = [...g.meshes.values()].some((e) => e.water)
  // collect source with the empty bucket -> everything dries
  g.hotbar[0] = 102; g.sel = 0; P.pitch = -Math.atan2(1.62, 3.0); o.collected = g.place() && g.inv[103] === 1 && W.get(sx, sy, sz) === 0
  g.advance(15)
  let left = 0; for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) for (let y = Y - 30; y <= sy; y++) if (W.get(sx + dx, y, sz + dz) === 5) left++
  o.dried = left; return o
})
console.log(JSON.stringify(r))
check('cubo de agua pone una fuente', r.placed); check('el agua se extiende en rombo con niveles 1–7 (113 celdas)', r.cells === 113 && r.maxL === 7 && r.okLevels, `celdas=${r.cells} max=${r.maxL}`)
check('el agua cae por un hueco', r.falls); check('malla de agua generada', r.waterMesh)
check('el cubo recoge la fuente', r.collected); check('sin fuente el agua se seca', r.dried === 0, 'quedan=' + r.dried)
check('simulación barata (10 s de agua < 300 ms)', r.simMs < 300, r.simMs.toFixed(0) + ' ms')
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
