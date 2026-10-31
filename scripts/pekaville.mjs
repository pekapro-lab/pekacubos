// Pekaville: fixed starting house + garden + sign, chest with starter items, safe for old saves,
// deterministic, player changes win over the house; screenshots in shots/pekaville-*.png
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5331); const { browser, page, errs } = await open(chromium, 5331)
await page.setViewportSize({ width: 1280, height: 720 })
const shot = async (name, setup) => {
  await page.evaluate(async (setup) => { const g = window.__PEKACUBOS__; const H = g.world.village.H
    const [x, y, z, yaw, pitch] = setup.map((v) => (typeof v === 'string' ? eval(v) : v)); g.player.pos.set(x, y, z); g.player.yaw = yaw; g.player.pitch = pitch
    g.updateChunks(999); await g.whenIdle(); g.render() }, setup)
  await page.waitForTimeout(250); await page.screenshot({ path: `shots/pekaville-${name}.png` })
}
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__, o = {}; localStorage.clear(); g.newWorld(42); g.play(); g.manual = true; g.mobsEnabled = false; g.noDamage = true
  g.advance(0.3); await g.whenIdle(); g.advance(1)
  const v = g.world.village, H = v.H, W = g.world
  o.H = H; o.spawn = g.player.pos.toArray(); o.onTile = W.get(0, H, 13) === 18
  o.chest = W.get(...v.chest) === 16; o.walls = W.get(-5, H + 1, 0) === 11 && W.get(-5, H + 6, 0) === 25 && W.get(0, H + 14, 0) === 23
  o.door = W.get(0, H + 1, 4) === 0 && W.get(0, H + 2, 4) === 0; o.bed = W.get(-4, H + 6, -3) === 17
  let flat = true; for (let x = -10; x <= 10; x += 2) for (let z = -10; z <= 14; z += 2) if (Math.abs(x) > 6 || z > 5) { const b = W.get(x, H, z); if (b !== 1 && b !== 18) flat = false; if (W.get(x, H + 2, z) !== 0 && W.get(x, H + 2, z) !== 7 && W.get(x, H + 2, z) !== 6 && W.get(x, H + 2, z) !== 15) flat = false }
  o.flat = flat
  o.sign = g.decor.items.some((m) => m.userData.type === 'sign'); o.stands = g.decor.items.filter((m) => m.userData.type === 'stand').length; o.racks = g.decor.items.filter((m) => m.userData.type === 'rack').length
  const key = v.chest.join(','); o.chestItems = Object.keys(g.chests[key] || {}).length
  // determinism: a second world with the same seed has the same house
  const sig = (w) => { let h = 0; for (let x = -12; x <= 12; x++) for (let z = -12; z <= 15; z++) for (let y = H; y <= H + 15; y++) h = (h * 31 + w.get(x, y, z)) | 0; return h }
  const s1 = sig(W); g.newWorld(42); g.manual = true; await g.whenIdle(); o.same = sig(g.world) === s1 && s1 !== 0
  // walking up the stairs: start at the foot, hold forward along +x and jump
  P: { const p = g.player; p.pos.set(-0.5 + 0.0, H + 1, -2.5); p.yaw = -Math.PI / 2; g.input.mz = 1; g.input.jump = true; for (let i = 0; i < 360; i++) g.update(1 / 60); g.input.mz = 0; g.input.jump = false; g.advance(0.5); o.upY = p.pos.y; o.upX = p.pos.x }
  return o
})
console.log(JSON.stringify(r))
check('aparece en el camino de baldosas delante de la casa', r.onTile && Math.abs(r.spawn[1] - (r.H + 1)) < 0.05)
check('casa de dos pisos con tejado, puerta y cama', r.walls && r.door && r.bed)
check('jardín llano y despejado', r.flat)
check('misma semilla = misma casa (determinista)', r.same)
check('cartel, 3 armaduras y 3 expositores', r.sign && r.stands === 3 && r.racks === 3)
check('cofre con objetos de inicio', r.chest && r.chestItems >= 20, 'tipos=' + r.chestItems)
check('se puede subir la escalera al 2º piso', r.upY >= r.H + 5.9, 'y=' + r.upY.toFixed(2))
// screenshots
await shot('exterior', [0.5, 'H + 2', 18.5, 0, -0.12])
await shot('cartel', [3.4, 'H + 1', 15.2, 0.25, -0.02])
await shot('planta-baja', [3.6, 'H + 1', 3.4, 0.9, -0.25])
await shot('planta-baja-2', [-0.5, 'H + 1', 3.3, -0.25, -0.2])
await shot('planta-alta', [-2.5, 'H + 6', 2.8, -0.75, -0.15])
await shot('expositores', [0.2, 'H + 6', 1.0, -1.25, -0.1])
// chest UI
const ui = await page.evaluate(() => { const g = window.__PEKACUBOS__, v = g.world.village, H = v.H
  g.player.pos.set(2.5, H + 1, 3.5); g.player.yaw = -Math.PI / 2; g.player.pitch = -0.45; g.manual = true
  const h = g.raycast(); const opened = h && h.id === 16 && (g.place(), !document.querySelector('#chest').classList.contains('hidden'))
  return { opened, n: document.querySelectorAll('#chestgrid .it').length } })
await page.waitForTimeout(200); await page.screenshot({ path: 'shots/pekaville-cofre.png' })
const take = await page.evaluate(() => { const g = window.__PEKACUBOS__; const before = g.inv[108] || 0
  document.querySelector('#chestgrid .it[data-id="108"]').click(); const sword = (g.inv[108] || 0) === before + 1
  document.querySelector('#chestall').click(); const empty = document.querySelectorAll('#chestgrid .it').length === 0
  const put = g.chestPut(g.world.village.chest.join(','), 8, 10) === 10
  document.querySelector('#chestclose').click(); g.manual = true
  return { sword, empty, put, bread: g.inv[118], armor: g.armorPoints(), hot: g.hotbar.slice() } })
check('el cofre se abre al tocarlo', ui.opened && ui.n >= 20, 'objetos=' + ui.n)
check('coger un objeto y coger todo', take.sword && take.empty && take.bread === 8)
check('guardar en el cofre', take.put)
check('la armadura protege (15 puntos)', take.armor === 15)
// player changes win over the house; chest contents persist after reload
await page.evaluate(() => { const g = window.__PEKACUBOS__, H = g.world.village.H; g.world.set(-5, H + 2, 2, 0); g.world.set(0, H + 1, 8, 11); g.save() })
await page.reload(); await page.waitForFunction(() => window.__PEKACUBOS__)
const re = await page.evaluate(() => { const g = window.__PEKACUBOS__; g.load(); const H = g.world.village && g.world.village.H
  return { v: !!g.world.village, hole: g.world.get(-5, H + 2, 2), brick: g.world.get(0, H + 1, 8), planks: (g.chests[g.world.village.chest.join(',')] || {})[8] } })
check('tras recargar: cambios del jugador encima de la casa', re.v && re.hole === 0 && re.brick === 11 && re.planks === 10)
// old (v2.0) saves: village added only if the start area was never touched
const old = await page.evaluate(() => { const g = window.__PEKACUBOS__; const base = { v: 2, seed: 7, inv: {}, sel: 0, hotbar: [8], time: 0.3, hp: 20, spawn: [8.5, 30, 8.5], player: { x: 40.5, y: 60, z: 40.5, yaw: 0, pitch: 0 } }
  localStorage.setItem('pekacubos.save.v1', JSON.stringify({ ...base, mods: { '5,5': [100, 8] } })); g.load(); const a = { v: !!g.world.village, spawn: g.spawnPoint.toArray(), chest: Object.keys(g.chests).length }
  localStorage.setItem('pekacubos.save.v1', JSON.stringify({ ...base, mods: { '0,0': [100, 8] } })); g.load(); const b = { v: !!g.world.village, spawn: g.spawnPoint.toArray(), x: g.world.get(4, 0, 6) }
  localStorage.setItem('pekacubos.save.v1', JSON.stringify({ ...base, mods: { '0,0': [100, 8] }, village: false })); g.load(); const c = { v: !!g.world.village }
  return { a, b, c } })
console.log(JSON.stringify(old))
check('partida antigua sin tocar el inicio: aparece Pekaville con cofre', old.a.v && old.a.chest === 1 && old.a.spawn[2] === 13.5)
check('partida antigua con construcciones en el inicio: no se toca', !old.b.v && old.b.spawn[0] === 8.5)
check('partida guardada sin Pekaville sigue sin él', !old.c.v)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
