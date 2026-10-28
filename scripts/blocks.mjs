// Break/place: world + inventory + chunk mesh must update; bedrock is unbreakable; can't place inside the player.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5311); const { browser, page, errs } = await open(chromium, 5311)
const r = await page.evaluate(() => {
  const g = window.__PEKACUBOS__; localStorage.clear(); g.newWorld(42); g.play(); g.manual = true; g.advance(0.5)
  const out = {}
  g.player.pitch = -1.55; const h = g.raycast(); out.target = h && [h.x, h.y, h.z, h.id]
  const key = Math.floor(h.x / 16) + ',' + Math.floor(h.z / 16)
  const before = g.meshes.get(key).solid.geometry.attributes.position.count
  const inv0 = g.inv[h.id] || 0
  g.input.breaking = true; g.advance(0.2); out.crackShown = g.crack.visible
  for (let i = 0; i < 400 && g.world.get(h.x, h.y, h.z) !== 0; i++) g.advance(1 / 60)
  g.input.breaking = false
  out.broken = g.world.get(h.x, h.y, h.z) === 0
  out.invUp = (g.inv[h.id] || 0) === inv0 + 1
  out.meshChanged = g.meshes.get(key).solid.geometry.attributes.position.count !== before
  // place a plank in the hole we just made
  g.sel = 6; const p0 = g.inv[8]; g.player.pitch = -1.55
  g.player.pos.y += 0; const t = g.raycast(); out.placeTarget = t && [t.x, t.y, t.z, t.n]
  const ok = g.place()
  out.placed = ok && g.world.get(t.x + t.n[0], t.y + t.n[1], t.z + t.n[2]) === 8 && g.inv[8] === p0 - 1
  // placing into own body must fail
  g.player.pitch = -1.55; const fb = g.place(); out.noSelfPlace = !fb
  // bedrock
  g.player.pos.y = 1; g.player.pitch = -1.55; g.input.breaking = true; g.advance(5); g.input.breaking = false
  out.bedrock = g.world.get(Math.floor(g.player.pos.x), 0, Math.floor(g.player.pos.z)) === 9
  // empty slot can't place
  g.sel = 0; g.inv[1] = 0; g.player.pitch = -0.6; out.emptyNoPlace = !g.place()
  return out
})
console.log(JSON.stringify(r))
check('romper: bloque desaparece', r.broken); check('romper: grieta visible', r.crackShown); check('romper: inventario +1', r.invUp)
check('romper: malla del chunk regenerada', r.meshChanged); check('poner: bloque e inventario -1', r.placed)
check('no se puede poner dentro del jugador', r.noSelfPlace); check('roca base irrompible', r.bedrock); check('sin bloques no se pone', r.emptyNoPlace)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
