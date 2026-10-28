import * as THREE from 'three'
// Procedural 16x16 pixel-art atlas, all drawn by code.
export const T = 16, NT = 32
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296) }
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
function px(ctx, ox, x, y, rgb, a = 255) { ctx.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a / 255})`; ctx.fillRect(ox + x, y, 1, 1) }
function noisy(ctx, ox, base, amt, r) { const b = hex(base); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const k = 1 + (r() - 0.5) * amt; px(ctx, ox, x, y, b.map((v) => Math.min(255, v * k))) } }
export function makeAtlas() {
  const c = document.createElement('canvas'); c.width = T * NT; c.height = T
  const g = c.getContext('2d'); const r = rng(1234)
  const o = (i) => i * T
  noisy(g, o(0), 0x5fa83a, 0.35, r) // 0 grass top
  noisy(g, o(2), 0x86603e, 0.35, r) // 2 dirt
  g.drawImage(c, o(2), 0, T, T, o(1), 0, T, T) // 1 grass side = dirt + green fringe
  for (let x = 0; x < T; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) px(g, o(1), x, y, hex(0x5fa83a).map((v) => v * (0.85 + r() * 0.3))) }
  noisy(g, o(3), 0x8a8a8a, 0.3, r) // 3 stone
  for (let i = 0; i < 7; i++) { const x = r() * 14 | 0, y = r() * 15 | 0; px(g, o(3), x, y, [95, 95, 95]); px(g, o(3), x + 1, y, [105, 105, 105]) }
  noisy(g, o(4), 0xdccf8c, 0.18, r) // 4 sand
  noisy(g, o(5), 0x2f63c8, 0.15, r) // 5 water
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { // 6 log side (vertical bark)
    const k = 0.75 + ((x * 7) % 5) * 0.06 + r() * 0.15; px(g, o(6), x, y, [104 * k, 78 * k, 46 * k]) }
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { // 7 log top (rings)
    const d = Math.hypot(x - 7.5, y - 7.5); const ring = Math.floor(d) % 2 ? 0.85 : 1; const edge = d > 7 ? 0.6 : 1
    px(g, o(7), x, y, [176 * ring * edge, 140 * ring * edge, 86 * ring * edge]) }
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { // 8 leaves (with holes)
    if (r() < 0.12) continue; const k = 0.7 + r() * 0.5; px(g, o(8), x, y, [52 * k, 130 * k, 40 * k]) }
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { // 9 planks
    const row = y % 4 === 3 ? 0.7 : 1; const seam = (x === ((y >> 2) % 2 ? 4 : 11)) && y % 4 !== 3 ? 0.75 : 1; const k = row * seam * (0.92 + r() * 0.12)
    px(g, o(9), x, y, [176 * k, 136 * k, 82 * k]) }
  noisy(g, o(10), 0x3a3a3a, 0.8, r) // 10 bedrock
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { // 11 glass (frame + streaks)
    const edge = x === 0 || y === 0 || x === 15 || y === 15; const streak = (x + y === 10 || x + y === 12) && x > 2 && x < 9
    if (edge) px(g, o(11), x, y, [200, 230, 240]); else if (streak) px(g, o(11), x, y, [235, 250, 255]) }
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { // 12 brick
    const mortar = y % 4 === 3 || x === ((y >> 2) % 2 ? 0 : 8); const k = 0.85 + r() * 0.2
    px(g, o(12), x, y, mortar ? [190, 185, 175] : [160 * k, 70 * k, 52 * k]) }
  // 13 torch: stick in the middle columns, flame on top (only those pixels are used by the torch shape)
  for (let y = 6; y < 16; y++) for (let x = 7; x < 9; x++) px(g, o(13), x, y, [120 + r() * 20, 84, 40])
  for (let y = 3; y < 6; y++) for (let x = 7; x < 9; x++) px(g, o(13), x, y, y === 3 ? [255, 240, 150] : [255, 170 + r() * 40, 40])
  // 14 table top / 15 table side
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; const grid = x === 8 || y === 8; const k = 0.9 + r() * 0.15
    px(g, o(14), x, y, edge ? [110 * k, 76 * k, 40 * k] : grid ? [140 * k, 100 * k, 58 * k] : [186 * k, 146 * k, 92 * k]) }
  g.drawImage(c, o(9), 0, T, T, o(15), 0, T, T)
  g.fillStyle = '#5a3a1c'; g.fillRect(o(15), 0, T, 3); g.fillStyle = '#8a8a8a'; g.fillRect(o(15) + 3, 5, 3, 6); g.fillStyle = '#6d4a26'; g.fillRect(o(15) + 10, 5, 2, 8); g.fillRect(o(15) + 8, 5, 6, 2)
  // 16 furnace front / 17 furnace side
  noisy(g, o(17), 0x7d7d7d, 0.3, r)
  g.drawImage(c, o(17), 0, T, T, o(16), 0, T, T)
  g.fillStyle = '#222'; g.fillRect(o(16) + 4, 8, 8, 6); g.fillStyle = '#ff8a2a'; g.fillRect(o(16) + 5, 11, 6, 3); g.fillStyle = '#ffd36a'; g.fillRect(o(16) + 6, 12, 4, 2)
  g.fillStyle = '#555'; g.fillRect(o(16) + 3, 3, 10, 2)
  // 18 lantern: dark frame + warm glass
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const fr = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8
    px(g, o(18), x, y, fr ? [50, 48, 46] : [255, 200 + r() * 40, 90 + r() * 40]) }
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false
  return { canvas: c, tex } // raw sRGB values; the chunk shader works in display space
}
export function iconURL(atlas, tile) {
  const c = document.createElement('canvas'); c.width = c.height = 32
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false
  g.drawImage(atlas, tile * T, 0, T, T, 0, 0, 32, 32)
  return c.toDataURL()
}
export function makeCracks() {
  const out = []
  const r = rng(99)
  const lines = []
  for (let i = 0; i < 40; i++) lines.push([7 + (r() - 0.5) * 4, 7 + (r() - 0.5) * 4, r() * Math.PI * 2, 2 + r() * 7])
  for (let s = 1; s <= 6; s++) {
    const c = document.createElement('canvas'); c.width = c.height = T; const g = c.getContext('2d')
    g.fillStyle = 'rgba(0,0,0,0.75)'
    for (let i = 0; i < s * 6; i++) { const [x, y, a, l] = lines[i]; for (let t = 0; t < l * s / 6 + 1; t++) g.fillRect(Math.round(x + Math.cos(a) * t), Math.round(y + Math.sin(a) * t), 1, 1) }
    const tx = new THREE.CanvasTexture(c); tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.generateMipmaps = false
    out.push(tx)
  }
  return out
}
export function makeSkin() {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); const r = rng(7)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = 0.93 + r() * 0.1; px(g, 0, x, y, [224 * k, 172 * k, 130 * k]) }
  const tx = new THREE.CanvasTexture(c); tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace
  const s = document.createElement('canvas'); s.width = s.height = 16; const h = s.getContext('2d')
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = 0.9 + r() * 0.15; px(h, 0, x, y, [40 * k, 120 * k, 170 * k]) }
  const sl = new THREE.CanvasTexture(s); sl.magFilter = sl.minFilter = THREE.NearestFilter; sl.colorSpace = THREE.SRGBColorSpace
  return { skin: tx, sleeve: sl }
}

// 16x16 item icons drawn by code (items are not blocks, so they have no atlas tile)
export function itemCanvas(id) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); const r = rng(id * 31)
  const P = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1) }
  if (id === 100) for (let i = 0; i < 11; i++) { P(3 + i, 13 - i, '#8a5a2b'); P(4 + i, 13 - i, '#6b4220') } // palo
  if (id === 101) for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, y - 8) < 5 + r()) P(x, y, r() < 0.2 ? '#4a4a4a' : '#1d1d1d') // carbón
  if (id === 102 || id === 103) { // cubo / cubo de agua
    for (let y = 4; y < 14; y++) { const w = 4 - Math.floor((y - 4) / 4); for (let x = 2 + (4 - w); x < 14 - (4 - w); x++) P(x, y, x === 2 + (4 - w) || x === 13 - (4 - w) || y === 13 ? '#5e6266' : '#9aa0a6') }
    for (let x = 4; x < 12; x++) P(x, 2, '#5e6266'); P(3, 3, '#5e6266'); P(12, 3, '#5e6266')
    if (id === 103) for (let x = 3; x < 13; x++) { P(x, 4, '#3d78e0'); P(x, 5, '#2f63c8') }
  }
  if (id === 104 || id === 105) { const a = id === 104 ? ['#d9566b', '#f08a9a'] : ['#8a4a22', '#b8743a']
    for (let y = 4; y < 13; y++) for (let x = 3; x < 13; x++) if (Math.hypot((x - 8) * 0.9, y - 8.5) < 4.6) P(x, y, r() < 0.3 ? a[1] : a[0])
    for (let i = 0; i < 4; i++) P(12 + (i >> 1), 3 + i, '#f2eee4') }
  return c
}
export function heartCanvas(state) { // original "gem" life icon: 0 empty, 1 half, 2 full
  const c = document.createElement('canvas'); c.width = c.height = 9; const g = c.getContext('2d')
  const shape = ['...###...', '..#####..', '.#######.', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....']
  shape.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '#') return
    const edge = !shape[y - 1] || shape[y - 1][x] !== '#' || !shape[y + 1] || shape[y + 1][x] !== '#' || row[x - 1] !== '#' || row[x + 1] !== '#'
    const filled = state === 2 || (state === 1 && x < 5)
    g.fillStyle = edge ? '#2a0d14' : filled ? (x + y < 6 ? '#ff9aa8' : '#e0304f') : '#5b3a40'; g.fillRect(x, y, 1, 1) }))
  return c
}
