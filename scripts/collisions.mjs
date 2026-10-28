// Player collisions: never fall through the ground, never walk into blocks, no tunnelling at high speed.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5312); const { browser, page, errs } = await open(chromium, 5312)
const r = await page.evaluate(() => {
  const g = window.__PEKACUBOS__; localStorage.clear(); g.newWorld(7); g.play(); g.manual = true
  const out = {}; const P = g.player
  g.advance(2); const y0 = P.pos.y; g.advance(3); out.stand = P.onGround && Math.abs(P.pos.y - y0) < 1e-6
  // drop from the sky
  const x = Math.floor(P.pos.x), z = Math.floor(P.pos.z); const surf = g.world.surface(x, z).y
  P.pos.y = 60; P.vel.y = 0; g.advance(4); out.landed = P.onGround && Math.abs(P.pos.y - (surf + 1)) < 1e-3
  // fast fall (tunnelling)
  P.pos.y = 62; P.vel.y = -40; g.advance(0.5); out.noTunnel = P.pos.y >= surf + 1 - 1e-3
  // wall: a 3-high stone wall 3 blocks ahead (-z)
  const fy = Math.round(P.pos.y), wz = Math.floor(P.pos.z) - 3
  // flat test arena around the player
  for (let dx = -4; dx <= 4; dx++) for (let dz = -7; dz <= 1; dz++) { g.world.set(x + dx, fy - 1, Math.floor(P.pos.z) + dz, 3); for (let dy = 0; dy < 6; dy++) g.world.set(x + dx, fy + dy, Math.floor(P.pos.z) + dz, 0) }
  P.pos.x = x + 0.5; P.pos.y = fy; g.advance(0.3)
  for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy < 3; dy++) g.world.set(x + dx, fy + dy, wz, 3)
  P.yaw = 0; g.input.mz = 1; g.advance(3); g.input.mz = 0
  out.wallZ = P.pos.z; out.wallLimit = wz + 1 + 0.3
  out.blocked = P.pos.z >= wz + 1 + 0.3 - 1e-3 && !g.boxHits(P.pos)
  // jumping against the 3-high wall must not get over it
  g.input.mz = 1; g.input.jump = true; g.advance(2); g.input.jump = false; g.input.mz = 0
  out.noClimb = P.pos.z >= wz + 1 && !g.boxHits(P.pos)
  // can climb a 1-block step by jumping
  for (let dx = -3; dx <= 3; dx++) for (let dy = 1; dy < 3; dy++) g.world.set(x + dx, fy + dy, wz, 0)
  g.input.mz = 1; g.input.jump = true; g.advance(1.5); g.input.jump = false; g.input.mz = 0
  out.stepUp = P.pos.z < wz + 1
  // random walk 60 s over terrain, never inside a block and never below surface
  let bad = 0, minClear = 99, prevUnsup = false; const hist = []
  for (let i = 0; i < 3600; i++) {
    if (i % 90 === 0) { P.yaw = Math.random() * 6.28; g.input.mz = 1; g.input.jump = Math.random() < 0.5 }
    hist.push([P.pos.x, P.pos.y, P.pos.z, P.vel.y, P.onGround]); if (hist.length > 4) hist.shift()
    g.advance(1 / 60)
    if (g.boxHits(P.pos)) bad++
    if (P.onGround) { const b = g.world.get(Math.floor(P.pos.x), Math.floor(P.pos.y) - 1, Math.floor(P.pos.z)); let sup = b !== 0 && b !== 5
      for (const ox of [-0.3, 0.3]) for (const oz of [-0.3, 0.3]) { const c = g.world.get(Math.floor(P.pos.x + Math.sign(ox) * 0.2999), Math.floor(P.pos.y - 0.01), Math.floor(P.pos.z + Math.sign(oz) * 0.2999)); if (c !== 0 && c !== 5) sup = true }
      if ((!sup && prevUnsup) || Math.abs(P.pos.y - Math.round(P.pos.y)) > 1e-6) { minClear = -1; if (!out.why) { out.why = [sup, P.pos.x, P.pos.y, P.pos.z, P.vel.y]; const a = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) a.push(g.world.get(Math.floor(P.pos.x) + dx, Math.floor(P.pos.y) - 1, Math.floor(P.pos.z) + dz)); out.under = a; out.hist = JSON.parse(JSON.stringify(hist)) } }; prevUnsup = !sup } else prevUnsup = false
    if (P.pos.y < 1) minClear = -2
  }
  g.input.mz = 0; g.input.jump = false
  out.walkInside = bad; out.minClear = minClear
  return out
})
console.log(JSON.stringify(r))
check('quieto sobre el suelo', r.stand); check('cae y aterriza en la superficie', r.landed); check('sin atravesar el suelo a 40 m/s', r.noTunnel)
check('el muro detiene al jugador', r.blocked, `z=${r.wallZ?.toFixed(3)} límite=${r.wallLimit}`); check('saltando no supera un muro de 3', r.noClimb)
check('sube un escalón de 1 saltando', r.stepUp); check('60 s andando: nunca dentro de un bloque', r.walkInside === 0, 'frames=' + r.walkInside)
check('60 s andando: siempre apoyado en un bloque real al estar en el suelo', r.minClear === 99, 'code=' + r.minClear)
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
