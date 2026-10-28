// Day / night sky screenshots (sun, moon, stars, moonlight) -> shots/v202-day.png, shots/v202-night.png
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5328); const { browser, page, errs } = await open(chromium, 5328)
await page.setViewportSize({ width: 1280, height: 720 })
const info = {}
for (const [name, time, pitch, yaw] of [['day', 0.36, 0.55, -Math.PI / 2], ['night', 0.86, 0.55, -Math.PI / 2]]) {
  info[name] = await page.evaluate(async ([time, pitch, yaw]) => {
    const g = window.__PEKACUBOS__; if (!g.world) { localStorage.clear(); g.newWorld(42); g.play() } g.manual = true; g.mobsEnabled = false; g.noDamage = true
    await g.whenIdle(); g.time = time; g.player.yaw = yaw; g.player.pitch = pitch; g.render()
    const v = (o) => o.getWorldPosition(new g.player.pos.constructor()).sub(g.camera.position).normalize().y
    return { sunY: v(g.sun), moonY: v(g.moon), stars: g.stars.visible, moon: g.moonlight(), L: g.daylight() }
  }, [time, pitch, yaw])
  await page.waitForTimeout(300); await page.screenshot({ path: `shots/v202-${name}.png` })
}
console.log(JSON.stringify(info))
check('de día el sol está arriba y sin estrellas', info.day.sunY > 0.3 && !info.day.stars)
check('de noche la luna arriba, estrellas y luz de luna', info.night.moonY > 0.3 && info.night.stars && info.night.moon > 0.3)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
