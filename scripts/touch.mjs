// Touch controls in mobile emulation (landscape phone): joystick walks, right-drag looks,
// tap places, long-press breaks, on-screen buttons jump/break/place, hotbar tap selects.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5313)
const { browser, page, errs } = await open(chromium, 5313, { ctx: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } })
const cdp = await page.context().newCDPSession(page)
const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) })
const st = () => page.evaluate(() => { const g = window.__PEKACUBOS__; return { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z, yaw: g.player.yaw, pitch: g.player.pitch, vy: g.player.vel.y, inv: { ...g.inv }, sel: g.sel, brk: g.input.breaking, touch: document.body.classList.contains('touch') } })
await page.evaluate(() => { localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(42); g.mobsEnabled = false; g.noDamage = true })
await page.tap('#play'); await page.waitForTimeout(300)
// flat arena so movement is unobstructed
await page.evaluate(() => { const g = window.__PEKACUBOS__, P = g.player, x = Math.floor(P.pos.x), z = Math.floor(P.pos.z), y = Math.round(P.pos.y)
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) { g.world.set(x + dx, y - 1, z + dz, 3); for (let dy = 0; dy < 8; dy++) g.world.set(x + dx, y + dy, z + dz, 0) }
  P.pos.set(x + 0.5, y, z + 0.5); P.yaw = 0; P.pitch = 0 })
await page.waitForTimeout(300)
let a = await st(); check('modo táctil activo', a.touch)
check('botones táctiles visibles', await page.isVisible('#bjump') && await page.isVisible('#bbreak') && await page.isVisible('#bplace'))
// joystick: drag up from (150,280)
await T('touchStart', [[150, 280, 1]]); for (let i = 1; i <= 5; i++) await T('touchMove', [[150, 280 - i * 12, 1]])
await page.waitForTimeout(900); let b = await st(); await T('touchEnd', [])
check('joystick arriba = avanzar', a.z - b.z > 1.5, `dz=${(a.z - b.z).toFixed(2)}`)
await page.waitForTimeout(200); a = await st(); await page.waitForTimeout(300); b = await st()
check('soltar joystick = parar', Math.hypot(b.x - a.x, b.z - a.z) < 0.05)
// look: drag on the right side
a = await st(); await T('touchStart', [[600, 150, 2]]); for (let i = 1; i <= 8; i++) await T('touchMove', [[600 - i * 15, 150 + i * 4, 2]]); await T('touchEnd', [])
b = await st(); check('arrastrar a la derecha gira la cámara', b.yaw - a.yaw > 0.4 && b.pitch < a.pitch, `dyaw=${(b.yaw - a.yaw).toFixed(2)}`)
await page.evaluate(() => { const P = window.__PEKACUBOS__.player; P.pitch = -0.9; P.yaw = 0 })
// tap = place (selected planks)
a = await st(); await T('touchStart', [[620, 200, 3]]); await page.waitForTimeout(80); await T('touchEnd', []); await page.waitForTimeout(100); b = await st()
check('toque corto = poner bloque', b.inv[8] === a.inv[8] - 1, `${a.inv[8]}→${b.inv[8]}`)
// long press = break (the plank just placed, 1 s hardness)
a = await st(); await T('touchStart', [[620, 200, 4]]); await page.waitForTimeout(450); const mid = await st(); await page.waitForTimeout(1300); await T('touchEnd', []); await page.waitForTimeout(100); b = await st()
check('pulsación larga = romper', mid.brk && b.inv[8] === a.inv[8] + 1 && !b.brk, `${a.inv[8]}→${b.inv[8]}`)
// buttons
a = await st(); await page.tap('#bplace'); await page.waitForTimeout(100); b = await st(); check('botón Poner', b.inv[8] === a.inv[8] - 1)
const bb = await page.locator('#bbreak').boundingBox()
a = await st(); await T('touchStart', [[bb.x + 30, bb.y + 30, 5]]); await page.waitForTimeout(1500); await T('touchEnd', []); await page.waitForTimeout(100); b = await st()
check('botón Romper (mantener)', b.inv[8] === a.inv[8] + 1 && !b.brk)
const jb = await page.locator('#bjump').boundingBox(); a = await st()
await T('touchStart', [[jb.x + 30, jb.y + 30, 6]]); await page.waitForTimeout(150); b = await st(); await T('touchEnd', [])
check('botón Saltar', b.y > a.y + 0.2, `dy=${(b.y - a.y).toFixed(2)}`)
// multitouch: walk + look at the same time
a = await st(); await T('touchStart', [[150, 280, 7]]); await T('touchMove', [[150, 230, 7]])
await T('touchStart', [[150, 230, 7], [600, 150, 8]]); for (let i = 1; i <= 5; i++) await T('touchMove', [[150, 230, 7], [600 - i * 15, 150, 8]])
await page.waitForTimeout(500); b = await st(); await T('touchEnd', [])
check('multitáctil: andar y mirar a la vez', Math.hypot(b.x - a.x, b.z - a.z) > 0.8 && Math.abs(b.yaw - a.yaw) > 0.2)
// hotbar tap
const slot = page.locator('.slot').nth(2); await slot.tap(); b = await st(); check('tocar la barra elige bloque', b.sel === 2)
await page.screenshot({ path: 'shots/movil.png' })
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
