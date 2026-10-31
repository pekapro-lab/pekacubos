// Lighting: sky light outdoors, darkness inside a closed room, torch light falls off by 1 per block,
// walls block it, per-vertex light is baked into the chunk meshes, night is darker than day.
import { chromium } from 'playwright'
import { serve, open, check } from './serve.mjs'
const s = await serve(5324); const { browser, page, errs } = await open(chromium, 5324)
const r = await page.evaluate(async () => {
  const g = window.__PEKACUBOS__, o = {}; localStorage.clear(); g.newWorld(42, { village: false }); // natural terrain (Pekaville off) for the chunk-border check
  g.play(); g.manual = true; g.mobsEnabled = false; g.noDamage = true
  const P = g.player, W = g.world, cx = Math.floor(P.pos.x), cz = Math.floor(P.pos.z), Y = 70
  // closed 9x9x5 stone room floating at y=70 (interior 7x7x3)
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = 0; dy <= 4; dy++) {
    const wall = Math.abs(dx) === 4 || Math.abs(dz) === 4 || dy === 0 || dy === 4; W.set(cx + dx, Y + dy, cz + dz, wall ? 3 : 0) }
  await g.whenIdle()
  o.outside = g.lightAt(cx + 8, Y + 2, cz).sky; o.inside = g.lightAt(cx, Y + 2, cz).sky
  W.set(cx, Y + 1, cz, 12) // torch on the floor
  await g.whenIdle()
  o.torch = g.lightAt(cx, Y + 1, cz).blk; o.d1 = g.lightAt(cx + 1, Y + 1, cz).blk; o.d3 = g.lightAt(cx + 3, Y + 1, cz).blk
  o.behindWall = g.lightAt(cx + 5, Y + 1, cz).blk
  // lantern 15 outside, around a chunk border: light must cross into the neighbour chunk
  const bx = Math.floor(cx / 16) * 16 + 16; const gy = W.surface(bx - 1, cz + 12).y + 1
  W.set(bx - 1, gy, cz + 12, 15); await g.whenIdle(); o.cross = g.lightAt(bx + 2, gy, cz + 12).blk
  // baked per-vertex light: the room chunk mesh has both dark and torch-lit vertices
  const e = g.meshes.get(Math.floor(cx / 16) + ',' + Math.floor(cz / 16)); const L = e.solid.geometry.attributes.light.array
  let lit = 0, ao = new Set(); for (let i = 0; i < L.length; i += 3) { if (L[i + 1] > 0.5) lit++; ao.add(Math.round(L[i + 2] * 100)) }
  o.litVerts = lit; o.aoLevels = ao.size
  // remove the torch -> dark again
  W.set(cx, Y + 1, cz, 0); await g.whenIdle(); o.afterRemove = g.lightAt(cx + 1, Y + 1, cz).blk
  // night vs day brightness of a body under open sky
  g.time = 0.3; const day = g.lightAtBody(cx + 8, Y + 2, cz); g.time = 0.75; const night = g.lightAtBody(cx + 8, Y + 2, cz)
  o.day = day; o.night = night
  // night with a torch near the player = brighter
  W.set(cx + 8, Y + 2, cz + 2, 12); await g.whenIdle(); o.nightTorch = g.lightAtBody(cx + 8, Y + 2, cz + 1)
  return o
})
console.log(JSON.stringify(r))
check('luz del cielo fuera = 15', r.outside === 15); check('dentro de una sala cerrada = 0', r.inside === 0)
check('antorcha 14, cae 1 por bloque', r.torch === 14 && r.d1 === 13 && r.d3 === 11, `${r.torch}/${r.d1}/${r.d3}`)
check('la pared bloquea la luz', r.behindWall === 0); check('la luz cruza el borde de chunk', r.cross === 12, 'nivel=' + r.cross)
check('luz por vértice horneada en la malla', r.litVerts > 20, 'vértices=' + r.litVerts); check('oclusión ambiental (varios niveles)', r.aoLevels >= 4, 'niveles=' + r.aoLevels)
check('quitar antorcha vuelve a oscuro', r.afterRemove === 0); check('de noche más oscuro (con luz de luna v2.0.2)', r.night < r.day * 0.5 && r.night > 0.2, `${r.day.toFixed(2)} → ${r.night.toFixed(2)}`)
check('antorcha ilumina de noche', r.nightTorch > r.night * 1.4, r.nightTorch.toFixed(2))
check('sin errores JS', !errs.length, errs.join('|'))
await browser.close(); s.close()
