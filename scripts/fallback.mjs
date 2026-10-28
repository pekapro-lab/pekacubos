// Robustness for hosts where the module worker can't run (e.g. the Grok builder): no Worker at all,
// a worker that never answers, and a worker that errors. Terrain must still render (main-thread
// meshing) and the player must stand on the ground, alive, using the real game loop.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5341)
const CASES = {
  'sin Worker': () => { window.Worker = undefined },
  'worker mudo': () => { window.Worker = class { constructor() {} postMessage() {} terminate() {} } },
  'worker con error': () => { window.Worker = class { constructor() { setTimeout(() => this.onerror && this.onerror(new ErrorEvent('error', { message: 'boom' })), 50) } postMessage() {} terminate() {} } },
  'constructor lanza': () => { window.Worker = class { constructor() { throw new Error('module workers not supported') } } },
}
for (const [name, init] of Object.entries(CASES)) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } }); await ctx.addInitScript(init)
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)))
  await page.goto(`http://127.0.0.1:5341/pekacubos/`); await page.waitForFunction(() => window.__PEKACUBOS__)
  await page.evaluate(() => { localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(42); g.mobsEnabled = false; g.play() })
  await page.waitForTimeout(5000)
  const r = await page.evaluate(() => { const g = window.__PEKACUBOS__, P = g.player
    g.renderer.info.autoReset = false; g.renderer.info.reset(); g.render(); const tris = g.renderer.info.render.triangles; g.renderer.info.autoReset = true
    const under = g.world.get(Math.floor(P.pos.x), Math.floor(P.pos.y) - 1, Math.floor(P.pos.z))
    return { mode: g.workerMode, built: [...g.meshes.values()].filter((e) => e.built).length, tris, y: P.pos.y, onGround: P.onGround, under, hp: g.hp, dead: g.dead, why: g.workerError || '' } })
  console.log(name, JSON.stringify(r))
  check(`${name}: mallado en hilo principal`, r.mode === 'main', r.why)
  check(`${name}: el terreno se dibuja`, r.built > 20 && r.tris > 2000, `${r.built} chunks, ${r.tris} triángulos`)
  check(`${name}: jugador de pie y vivo`, r.onGround && r.under !== 0 && r.hp === 20 && !r.dead, `y=${r.y} bajo=${r.under} vida=${r.hp}`)
  check(`${name}: sin errores JS`, !errs.length, errs.join('|'))
  await browser.close()
}
// normal case still uses the worker
{
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:5341/pekacubos/`); await page.waitForFunction(() => window.__PEKACUBOS__)
  await page.evaluate(() => { localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(42); g.mobsEnabled = false; g.play() })
  await page.waitForTimeout(3000)
  const r = await page.evaluate(() => ({ mode: window.__PEKACUBOS__.workerMode, ok: window.__PEKACUBOS__.workerOK }))
  check('navegador normal: sigue usando el worker', r.mode === 'worker' && r.ok)
  await browser.close()
}
s.close()
