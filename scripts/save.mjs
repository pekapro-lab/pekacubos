// Autosave: block changes, inventory, position and settings survive a full page reload.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5314); const { browser, page, errs } = await open(chromium, 5314)
const before = await page.evaluate(() => {
  localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(1234); g.play(); g.manual = true; g.advance(0.5)
  g.player.pitch = -1.55; const h = g.raycast(); g.input.breaking = true
  for (let i = 0; i < 400 && g.world.get(h.x, h.y, h.z) !== 0; i++) g.advance(1 / 60); g.input.breaking = false
  g.sel = 7; g.player.pitch = -0.5; const t = g.raycast(); g.place(); const pl = [t.x + t.n[0], t.y + t.n[1], t.z + t.n[2]]
  g.player.pos.x += 0.25; g.player.yaw = 1.1
  document.querySelector('#dist').value = 6; document.querySelector('#dist').dispatchEvent(new Event('input'))
  return { broken: [h.x, h.y, h.z], placed: pl, inv: { ...g.inv }, pos: g.player.pos.toArray(), yaw: g.player.yaw, seed: g.world.seed }
})
await page.waitForTimeout(5600) // autosave interval (5 s) without an explicit save() call
await page.reload(); await page.waitForFunction(() => window.__PEKACUBOS__)
check('el menú ofrece Jugar con partida guardada', (await page.textContent('#play')) === 'Jugar')
await page.click('#play').catch(() => {}); await page.waitForTimeout(300)
const after = await page.evaluate(({ broken, placed }) => { const g = window.__PEKACUBOS__
  return { b: g.world.get(...broken), p: g.world.get(...placed), inv: { ...g.inv }, pos: g.player.pos.toArray(), yaw: g.player.yaw, seed: g.world.seed, dist: g.viewDist } }, before)
check('semilla conservada', after.seed === before.seed); check('bloque roto sigue roto', after.b === 0); check('bloque puesto sigue puesto', after.p === 10)
check('inventario conservado', JSON.stringify(after.inv) === JSON.stringify(before.inv)); check('posición conservada', after.pos.every((v, i) => Math.abs(v - before.pos[i]) < 0.6) && Math.abs(after.yaw - before.yaw) < 0.01)
check('ajuste de distancia conservado', after.dist === 6)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
