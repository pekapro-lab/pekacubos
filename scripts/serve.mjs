import { createServer } from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
const ROOT = new URL('../dist', import.meta.url).pathname
const T = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }
export function serve(port) {
  const s = createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]); if (u.startsWith('/pekacubos')) u = u.slice(10) || '/'
    let f = join(ROOT, u === '/' ? 'index.html' : u); if (!existsSync(f) || statSync(f).isDirectory()) f = join(ROOT, 'index.html')
    res.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
  })
  return new Promise((r) => s.listen(port, () => r(s)))
}
export async function open(chromium, port, opts = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const ctx = await browser.newContext(opts.ctx || { viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await page.goto(`http://127.0.0.1:${port}/pekacubos/${opts.q || ''}`)
  await page.waitForFunction(() => window.__PEKACUBOS__)
  return { browser, ctx, page, errs }
}
export function check(name, ok, info = '') { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${info}`); if (!ok) process.exitCode = 1; return ok }
