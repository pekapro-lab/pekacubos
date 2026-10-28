// Performance budget (software GL in CI, so thresholds are loose; numbers are printed for tracking):
// worker meshing+lighting per chunk, edit->relight latency, draw calls, triangles, frame time, auto quality.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5315)
const { browser, page, errs } = await open(chromium, 5315, { ctx: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } })
const r = await page.evaluate(async () => {
  localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(99); g.viewDist = 4; g.mobsEnabled = false
  g.manual = true; g.running = true; document.querySelector('#menu').classList.add('hidden')
  const t0 = performance.now(); await g.whenIdle(); const loadMs = performance.now() - t0
  const meshMs = g.meshStats.ms / g.meshStats.n, lightMs = g.meshStats.lightMs / g.meshStats.n
  // a few mobs around
  for (let i = 0; i < 6; i++) g.spawnMob(i % 2 ? 'pompon' : 'sombrajo', g.player.pos.x + 5 + i, g.player.pos.y + 2, g.player.pos.z + 3)
  g.update(1 / 60)
  g.renderer.info.autoReset = false; g.renderer.info.reset(); g.render()
  const calls = g.renderer.info.render.calls, tris = g.renderer.info.render.triangles; g.renderer.info.autoReset = true
  g.input.mz = 1; const f0 = performance.now(); let worst = 0, upd = 0
  for (let i = 0; i < 120; i++) { const a = performance.now(); g.update(1 / 60); upd += performance.now() - a; g.render(); worst = Math.max(worst, performance.now() - a) }
  g.input.mz = 0
  const avgFrame = (performance.now() - f0) / 120
  // place a torch: time until every affected chunk is relit and remeshed (worker, off the main thread)
  const P = g.player.pos; const t1 = performance.now(); const main0 = performance.now()
  g.world.set(Math.floor(P.x) + 1, Math.floor(P.y), Math.floor(P.z), 12); const mainMs = performance.now() - main0
  await g.whenIdle(); const relightMs = performance.now() - t1
  // auto quality: feed slow frames -> quality drops and view distance shrinks
  g.autoQuality = true; for (let i = 0; i < 150; i++) g.trackPerf(0.05)
  return { chunks: g.meshes.size, workers: g.workers.length, loadMs, meshMs, lightMs, calls, tris, avgFrame, avgUpdate: upd / 120, worst, mainMs, relightMs, quality: g.quality, viewAfter: g.viewDist }
})
console.log(JSON.stringify(r, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v))
check('mallado en Web Worker', r.workers >= 1, r.workers + ' workers')
check('mallado+luz medio por chunk < 60 ms', r.meshMs < 60, `${r.meshMs.toFixed(1)} ms (luz ${r.lightMs.toFixed(1)} ms)`)
check('poner antorcha: hilo principal < 5 ms', r.mainMs < 5, r.mainMs.toFixed(2) + ' ms')
check('reiluminar tras antorcha < 1500 ms', r.relightMs < 1500, r.relightMs.toFixed(0) + ' ms')
check('draw calls < 2 por chunk + mobs + 12', r.calls < r.chunks * 2 + 6 + 12, `${r.calls} llamadas, ${r.chunks} chunks`)
check('triángulos < 600k', r.tris < 600000, r.tris + ' triángulos')
check('update medio < 4 ms (física+mobs+agua)', r.avgUpdate < 4, r.avgUpdate.toFixed(2) + ' ms')
check('frame medio < 60 ms incluso con GL por software', r.avgFrame < 60, r.avgFrame.toFixed(1) + ' ms')
check('calidad automática baja con frames lentos', r.quality === 1 && r.viewAfter <= 3, `nivel=${r.quality} dist=${r.viewAfter}`)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
