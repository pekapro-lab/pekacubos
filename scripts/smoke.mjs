import { chromium } from 'playwright'
import { serve, open } from './serve.mjs'
const s = await serve(5301); const { browser, page, errs } = await open(chromium, 5301)
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => window.__PEKACUBOS__)
await page.screenshot({ path: 'shots/menu.png' })
await page.evaluate(() => { const g = window.__PEKACUBOS__; g.newWorld(42); g.play(); g.manual = true; g.advance(1) })
await page.waitForTimeout(800)
console.log(await page.evaluate(() => { const g = window.__PEKACUBOS__; return JSON.stringify({ p: g.player.pos, ground: g.player.onGround, meshes: g.meshes.size, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }) }))
await page.screenshot({ path: 'shots/smoke.png' }); console.log(errs); await browser.close(); s.close()
