// Gameplay screenshots -> shots/
import { chromium } from 'playwright'
import { serve, open } from './serve.mjs'
const s = await serve(5316); const { browser, page } = await open(chromium, 5316)
await page.evaluate(() => { localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(42); g.viewDist = 5; g.play(); g.manual = true; g.advance(0.5) })
await page.screenshot({ path: 'shots/menu-off.png' })
await page.evaluate(() => { const g = window.__PEKACUBOS__, P = g.player, x = Math.floor(P.pos.x), y = Math.round(P.pos.y), z = Math.floor(P.pos.z) - 4
  for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy < 4; dy++) { const id = dy === 3 ? 8 : (dx === 0 && dy === 1 ? 10 : 11); g.world.set(x + dx, y + dy, z, id) }
  g.updateChunks(999); P.pitch = -0.25; P.yaw = 0.35; g.sel = 6; g.input.breaking = false })
await page.waitForTimeout(400); await page.screenshot({ path: 'shots/construir.png' })
await page.evaluate(() => { const g = window.__PEKACUBOS__; g.player.pitch = -0.7; g.player.yaw = 0; g.input.breaking = true; g.advance(0.35); g.swing = 0.5 })
await page.waitForTimeout(300); await page.screenshot({ path: 'shots/romper.png' })
await page.evaluate(() => { const g = window.__PEKACUBOS__; g.input.breaking = false; g.crack.visible = false; g.time = 0.8; g.player.pitch = -0.1; g.player.yaw = 2 })
await page.waitForTimeout(300); await page.screenshot({ path: 'shots/noche.png' })
await browser.close(); s.close()
