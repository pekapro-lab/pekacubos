// A v1.0.0 save (v:1, fixed hotbar, 64-high world) must load in v2 with the same blocks and inventory.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5327); const { browser, page, errs } = await open(chromium, 5327)
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__
  // index = (y*16+lz)*16+lx ; chunk 0,0: broken block at (3,20,3) and a brick at (4,22,4)
  const i1 = (20 * 16 + 3) * 16 + 3, i2 = (22 * 16 + 4) * 16 + 4
  localStorage.setItem('pekacubos.save.v1', JSON.stringify({ v: 1, seed: 42, mods: { '0,0': [i1, 0, i2, 11] }, inv: { 8: 5, 11: 3, 4: 2 }, sel: 6, time: 0.4, player: { x: 8.5, y: 30, z: 8.5, yaw: 0.5, pitch: -0.2 } }))
  const ok = g.load(); g.play(); g.manual = true; await g.whenIdle()
  return { ok, b1: g.world.get(3, 20, 3), b2: g.world.get(4, 22, 4), inv: g.inv, hot: g.hotbar, sel: g.selected(), hp: g.hp, t: g.time }
})
console.log(JSON.stringify(r))
check('carga partida de v1', r.ok); check('bloques de v1 conservados', r.b1 === 0 && r.b2 === 11)
check('inventario de v1 conservado', r.inv[8] === 5 && r.inv[11] === 3); check('barra de v1 (hueco 7 = tablones)', r.sel === 8 && r.hot.length === 9)
check('vida completa al cargar v1', r.hp === 20)
// and it re-saves as v2 and loads again
const r2 = await page.evaluate(() => { const g = window.__PEKACUBOS__; g.save(); const s = JSON.parse(localStorage.getItem('pekacubos.save.v1')); return { v: s.v, ok: g.load(), b2: g.world.get(4, 22, 4) } })
check('se vuelve a guardar como v2 y recarga', r2.v === 2 && r2.ok && r2.b2 === 11)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
