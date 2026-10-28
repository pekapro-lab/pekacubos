// Performance sanity (software GL, so thresholds are loose): chunk meshing time, draw calls, triangles, frame time.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5315)
const { browser, page, errs } = await open(chromium, 5315, { ctx: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } })
const r = await page.evaluate(() => {
  localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(99); g.viewDist = 4
  g.manual = true; g.running = true; document.querySelector('#menu').classList.add('hidden')
  const t0 = performance.now(); g.updateChunks(999); const meshMs = (performance.now() - t0) / g.meshes.size
  g.renderer.info.autoReset = false; g.renderer.info.reset(); g.render()
  const calls = g.renderer.info.render.calls, tris = g.renderer.info.render.triangles; g.renderer.info.autoReset = true
  g.input.mz = 1; const f0 = performance.now(); let worst = 0
  for (let i = 0; i < 120; i++) { const a = performance.now(); g.update(1 / 60); g.render(); worst = Math.max(worst, performance.now() - a) }
  g.input.mz = 0
  const t1 = performance.now(); g.world.set(Math.floor(g.player.pos.x), 5, Math.floor(g.player.pos.z), 0); const editMs = performance.now() - t1
  return { chunks: g.meshes.size, meshMs, calls, tris, avgFrame: (performance.now() - f0) / 120, worst, editMs }
})
console.log(JSON.stringify(r, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v))
check('mallado medio por chunk < 25 ms', r.meshMs < 25, r.meshMs.toFixed(1) + ' ms')
check('rebuild al romper un bloque < 40 ms', r.editMs < 40, r.editMs.toFixed(1) + ' ms')
check('draw calls < 2 por chunk + 10', r.calls < r.chunks * 2 + 10, `${r.calls} llamadas, ${r.chunks} chunks`)
check('triángulos < 600k (solo caras visibles)', r.tris < 600000, r.tris + ' triángulos')
check('frame medio < 60 ms incluso con GL por software', r.avgFrame < 60, r.avgFrame.toFixed(1) + ' ms')
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
