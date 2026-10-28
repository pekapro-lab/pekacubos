// Tall building: pillar-jump a tower from the ground to the world top (y=127) placing under your feet,
// placing works at any height in reach, and the top layer limit is enforced.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5325); const { browser, page, errs } = await open(chromium, 5325)
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__, o = {}; localStorage.clear(); g.newWorld(42); g.play(); g.manual = true; g.mobsEnabled = false
  const P = g.player; g.inv[8] = 400; g.sel = g.hotbar.indexOf(8)
  const y0 = P.pos.y; P.pitch = -Math.PI / 2 + 0.01; let placed = 0, fails = 0
  const X = Math.floor(P.pos.x), Z = Math.floor(P.pos.z)
  for (let i = 0; i < 30000 && g.world.get(X, 127, Z) !== 8; i++) {
    g.input.jump = P.onGround; g.advance(1 / 60)
    const fy = Math.floor(P.pos.y)
    if (!P.onGround && P.vel.y < 2) { if (g.place()) placed++; else fails++ }
  }
  g.input.jump = false; g.advance(0.5)
  o.start = y0; o.top = P.pos.y; o.placed = placed
  o.column = (() => { let n = 0; for (let y = Math.floor(y0); y < 128; y++) if (g.world.get(Math.floor(P.pos.x), y, Math.floor(P.pos.z)) === 8) n++; return n })()
  o.sidePlace = g.world.get(X, 127, Z) === 8 // the last block was placed at the very top layer (y=127)
  // above the world top: refused
  const x = Math.floor(P.pos.x), z = Math.floor(P.pos.z); P.pos.y = 128; P.vel.set(0, 0, 0); P.pitch = Math.PI / 2 - 0.01
  o.aboveTop = g.world.set(x, 128, z, 8)
  await g.whenIdle(); o.meshAtTop = (() => { const e = g.meshes.get(Math.floor(x / 16) + ',' + Math.floor(z / 16)); const p = e.solid.geometry.attributes.position.array; let m = 0; for (let i = 1; i < p.length; i += 3) m = Math.max(m, p[i]); return m })()
  return o
})
console.log(JSON.stringify(r))
check('torre hasta la cima del mundo (de pie en y=128)', r.top >= 128, `de y=${r.start} a y=${r.top.toFixed(2)}`)
check('más de 100 bloques apilados', r.column >= 100 && r.placed === r.column, 'bloques=' + r.column)
check('se puede poner un bloque en la capa más alta (y=127)', r.sidePlace)
check('no se puede pasar del techo del mundo (128)', r.aboveTop === false)
check('la malla llega a la cima', r.meshAtTop >= 128, 'y máx=' + r.meshAtTop)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
// touch-style pillar jumping: one tap right after the jump (feet still inside the target cell) must still place
{
  const s2 = await serve(5326); const { browser: b2, page: p2 } = await open(chromium, 5326)
  const r2 = await p2.evaluate(() => { const g = window.__PEKACUBOS__; localStorage.clear(); g.newWorld(42); g.play(); g.manual = true; g.mobsEnabled = false
    const P = g.player; g.inv[8] = 50; g.sel = g.hotbar.indexOf(8); P.pitch = -Math.PI / 2 + 0.01; g.advance(0.5); const y0 = P.pos.y; let n = 0
    for (let k = 0; k < 10; k++) { g.input.jump = true; g.advance(1 / 60); g.input.jump = false; g.advance(0.05); g.place(); g.advance(1.2); n++ }
    return { gained: P.pos.y - y0 } })
  check('pilar con un toque justo al saltar (búfer de colocación)', r2.gained >= 10, 'subido=' + r2.gained.toFixed(1))
  await b2.close(); s2.close()
}
