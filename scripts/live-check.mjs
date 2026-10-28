import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1024, height: 576 } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
await p.goto('https://pekapro-lab.github.io/pekacubos/'); await p.waitForFunction(() => window.__PEKACUBOS__)
await p.evaluate(() => { localStorage.clear(); const g = window.__PEKACUBOS__; g.newWorld(42); g.play() }); await p.waitForTimeout(1500)
await p.screenshot({ path: 'shots/pages-live.png' }); console.log('live ok', await p.textContent('#ver'), errs); await b.close()
