// Crafting: hand recipes, table/furnace requirements, touch-friendly panel, grass drops dirt, hotbar assignment.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5321); const { browser, page, errs } = await open(chromium, 5321, { ctx: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } })
await page.evaluate(() => { localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(42); g.mobsEnabled = false; g.noDamage = true })
await page.tap('#play'); await page.waitForTimeout(200)
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__, o = {}; g.manual = true
  g.inv = { 6: 3, 3: 12, 4: 2 }; g.emit()
  o.planks = g.craft('tablones', 1) === 1 && g.inv[8] === 4 && g.inv[6] === 2
  o.sticks = g.craft('palos', 1) === 1 && g.inv[100] === 4 && g.inv[8] === 2
  o.noIngredients = g.craft('mesa', 1) === 0
  g.craft('tablones', 1); o.table = g.craft('mesa', 1) === 1 && g.inv[13] === 1
  o.furnaceNeedsTable = g.craft('horno', 1) === 0 && !g.craftState(window.__RECIPES__.find((x) => x.id === 'horno')).needOK
  const P = g.player.pos; g.world.set(Math.floor(P.x) + 2, Math.floor(P.y), Math.floor(P.z), 13)
  o.furnace = g.craft('horno', 1) === 1 && g.inv[14] === 1 && g.inv[3] === 4
  o.glassNeedsFurnace = g.craft('cristal', 1) === 0
  g.world.set(Math.floor(P.x) - 2, Math.floor(P.y), Math.floor(P.z), 14)
  o.glass = g.craft('cristal', 1) === 1 && g.inv[10] === 1
  o.charcoalTorch = g.craft('carbon', 1) === 1 && g.craft('antorchas', 1) === 1 && g.inv[12] === 4
  // grass -> dirt
  const x = Math.floor(P.x) + 1, z = Math.floor(P.z); const y = g.world.surface(x, z).y; g.world.set(x, y, z, 1)
  g.player.yaw = -Math.PI / 2; g.player.pitch = -0.9; const h = g.raycast(); o.target = h && h.id
  const d0 = g.inv[2] || 0, g0 = g.inv[1] || 0; g.input.breaking = true
  for (let i = 0; i < 200 && g.world.get(h.x, h.y, h.z) !== 0; i++) g.advance(1 / 60); g.input.breaking = false
  o.grassDirt = h.id === 1 && g.inv[2] === d0 + 1 && (g.inv[1] || 0) === g0
  return o
})
console.log(JSON.stringify(r))
// UI: open panel, craft by tapping, assign to hotbar
await page.tap('#bcraft'); await page.waitForTimeout(150)
check('panel de fabricación se abre', await page.isVisible('#craft'))
const before = await page.evaluate(() => ({ ...window.__PEKACUBOS__.inv }))
await page.evaluate(() => { const g = window.__PEKACUBOS__; g.inv[6] = (g.inv[6] || 0) + 1; g.emit() })
await page.locator('.rec[data-id="tablones"] button', { hasText: 'Fabricar' }).tap(); await page.waitForTimeout(100)
const after = await page.evaluate(() => ({ ...window.__PEKACUBOS__.inv }))
check('tocar «Fabricar» fabrica', after[8] === (before[8] || 0) + 4)
check('recetas no disponibles desactivadas', await page.locator('.rec[data-id="farol"] button').first().isDisabled())
await page.evaluate(() => { window.__PEKACUBOS__.sel = 8; window.__PEKACUBOS__.emit() })
await page.locator('#invgrid .it', { hasText: 'Antorcha' }).tap()
check('tocar un objeto lo pone en el hueco elegido', await page.evaluate(() => window.__PEKACUBOS__.hotbar[8] === 12))
await page.screenshot({ path: 'shots/v2-fabricar.png' })
await page.tap('#craftclose'); check('cerrar panel reanuda', !(await page.isVisible('#craft')) && await page.evaluate(() => window.__PEKACUBOS__.running))
for (const k of ['planks', 'sticks', 'noIngredients', 'table', 'furnaceNeedsTable', 'furnace', 'glassNeedsFurnace', 'glass', 'charcoalTorch', 'grassDirt']) check('receta/regla: ' + k, r[k])
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
