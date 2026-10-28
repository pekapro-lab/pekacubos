// Pure chunk mesher + light engine (runs in a Web Worker, or on the main thread as fallback).
// Input: the 3x3 neighbourhood of chunk block arrays (+ water metas). Output: typed arrays for
// the opaque mesh and the water mesh, plus the centre chunk light (sky << 4 | block).
// Light: sky light (15 from above, spreads -1 per block) + block light (torches/lanterns), BFS over a
// padded region so light crosses chunk borders. Per-vertex smooth light + ambient occlusion baked in.
import { AIR, WATER, BLOCKS, isOpaque, lightOf } from './blocks.js'
export const CS = 16, CH = 128
const M = 15, RW = CS + 2 * M, RA = RW * RW
const NT = 32
const OPQ = new Uint8Array(256), DIM = new Uint8Array(256), EMIT = new Uint8Array(256), SEE = new Uint8Array(256)
for (let id = 1; id < 256; id++) if (BLOCKS[id]) { OPQ[id] = isOpaque(id) ? 1 : 0; DIM[id] = id === WATER ? 2 : (BLOCKS[id].dim || 0); EMIT[id] = lightOf(id); SEE[id] = BLOCKS[id].see ? 1 : 0 }
const FACES = [
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 2 },
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.75, t: 1 },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.75, t: 1 },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.86, t: 1 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.62, t: 1 },
]
for (const f of FACES) { const a = f.d.findIndex((v) => v !== 0); f.ax = [0, 1, 2].filter((k) => k !== a) }
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]]
const E = 0.02 / NT
const AO = [0.5, 0.68, 0.84, 1]
let ids = new Uint8Array(RA * CH), meta = new Uint8Array(RA * CH), sky = new Uint8Array(RA * CH), blk = new Uint8Array(RA * CH)
let Q = new Int32Array(1 << 20), YT = CH
const ri = (x, y, z) => (y * RW + z) * RW + x

function bfs(L, qn) {
  let h = 0
  while (h < qn) {
    const i = Q[h++], lv = L[i]; if (lv <= 1) continue
    const x = i % RW, z = ((i / RW) | 0) % RW, y = (i / RA) | 0
    for (let k = 0; k < 6; k++) {
      let nx = x, ny = y, nz = z
      if (k === 0) nx++; else if (k === 1) nx--; else if (k === 2) ny++; else if (k === 3) ny--; else if (k === 4) nz++; else nz--
      if (nx < 0 || nz < 0 || nx >= RW || nz >= RW || ny < 0 || ny >= YT) continue
      const j = (ny * RW + nz) * RW + nx, b = ids[j]
      if (OPQ[b]) continue
      const nl = lv - 1 - DIM[b]
      if (nl > L[j]) { L[j] = nl; if (qn >= Q.length) { const q2 = new Int32Array(Q.length * 2); q2.set(Q); Q = q2 } Q[qn++] = j }
    }
  }
}
export function computeLight(chunks) {
  // chunks: 3x3 array [dz+1][dx+1] of { ids, meta }
  for (let y = 0; y < CH; y++) for (let z = 0; z < RW; z++) for (let x = 0; x < RW; x++) {
    const gx = x - M + CS, gz = z - M + CS, cx = (gx / CS) | 0, cz = (gz / CS) | 0, c = chunks[cz][cx]
    const li = (y * CS + (gz - cz * CS)) * CS + (gx - cx * CS), i = ri(x, y, z)
    ids[i] = c.ids[li]; meta[i] = c.meta[li]
  }
  let top = 0
  for (let i = RA * CH - 1; i >= 0; i--) if (ids[i]) { top = (i / RA) | 0; break }
  YT = Math.min(CH, top + 2)
  sky.fill(15, YT * RA); blk.fill(0)
  let qn = 0
  for (let z = 0; z < RW; z++) for (let x = 0; x < RW; x++) {
    let lv = 15
    for (let y = YT - 1; y >= 0; y--) { const i = ri(x, y, z), b = ids[i]; if (OPQ[b]) lv = 0; else if (DIM[b]) lv = Math.max(0, lv - DIM[b]); sky[i] = lv }
  }
  for (let i = 0; i < RA * YT; i++) if (sky[i] > 1) {
    // seed only cells next to a darker transparent cell
    const x = i % RW, z = ((i / RW) | 0) % RW
    if ((x > 0 && sky[i - 1] < sky[i] - 1 && !OPQ[ids[i - 1]]) || (x < RW - 1 && sky[i + 1] < sky[i] - 1 && !OPQ[ids[i + 1]]) ||
      (z > 0 && sky[i - RW] < sky[i] - 1 && !OPQ[ids[i - RW]]) || (z < RW - 1 && sky[i + RW] < sky[i] - 1 && !OPQ[ids[i + RW]]) ||
      (i >= RA && sky[i - RA] < sky[i] - 1 && !OPQ[ids[i - RA]])) Q[qn++] = i
    if (qn >= Q.length - 8) { const q2 = new Int32Array(Q.length * 2); q2.set(Q); Q = q2 }
  }
  bfs(sky, qn)
  qn = 0
  for (let i = 0; i < RA * YT; i++) if (EMIT[ids[i]]) { blk[i] = EMIT[ids[i]]; Q[qn++] = i }
  bfs(blk, qn)
}
function Buf() { return { p: [], u: [], l: [], i: [], n: 0 } }
function pack(b) {
  if (!b.n) return null
  return { p: new Float32Array(b.p), u: new Float32Array(b.u), l: new Float32Array(b.l), i: b.n > 65000 ? new Uint32Array(b.i) : new Uint16Array(b.i) }
}
export function buildChunk(chunks, cx, cz) {
  const t0 = performance.now()
  computeLight(chunks)
  const tl = performance.now() - t0
  const solid = Buf(), water = Buf()
  const ox = cx * CS, oz = cz * CS
  const id3 = (x, y, z) => (y < 0 ? 9 : y >= CH ? AIR : ids[ri(x, y, z)])
  const opq = (x, y, z) => (y < 0 ? 1 : y >= CH ? 0 : OPQ[ids[ri(x, y, z)]])
  const lgt = (x, y, z) => { if (y >= CH) return [15, 0]; if (y < 0) return [0, 0]; const i = ri(x, y, z); return [sky[i], blk[i]] }
  const pos = [0, 0, 0]
  for (let y = 0; y < YT; y++) for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
    const x = lx + M, z = lz + M, i = ri(x, y, z), id = ids[i]
    if (id === AIR) continue
    const B = BLOCKS[id]
    if (B.shape === 'torch') { torch(solid, ox + lx, y, oz + lz, B.tiles[1], sky[i]); continue }
    for (const f of FACES) {
      const nx = x + f.d[0], ny = y + f.d[1], nz = z + f.d[2], n = id3(nx, ny, nz)
      if (id === WATER) { if (n === WATER || (n !== AIR && OPQ[n]) || (n !== AIR && f.d[1] !== 1)) continue }
      else if (OPQ[n] || (n === id && SEE[id])) continue
      const buf = id === WATER ? water : solid
      const tile = B.tiles[f.t]
      const aos = [0, 0, 0, 0]
      for (let k = 0; k < 4; k++) {
        const cc = f.c[k]
        let vy = y + cc[1]
        if (id === WATER && cc[1] === 1 && id3(x, y + 1, z) !== WATER) vy -= 0.12 + meta[i] * 0.1
        buf.p.push(ox + lx + cc[0], vy, oz + lz + cc[2])
        buf.u.push((tile + E + UVS[k][0] * (1 - 2 * E)) / NT, UVS[k][1])
        // smooth light + AO from the 4 cells touching this vertex on the outer side of the face
        const a0 = f.ax[0], a1 = f.ax[1]
        const s0 = cc[a0] ? 1 : -1, s1 = cc[a1] ? 1 : -1
        pos[0] = nx; pos[1] = ny; pos[2] = nz
        const p1 = pos.slice(); p1[a0] += s0
        const p2 = pos.slice(); p2[a1] += s1
        const p3 = pos.slice(); p3[a0] += s0; p3[a1] += s1
        const o1 = opq(...p1), o2 = opq(...p2), o3 = o1 && o2 ? 1 : opq(...p3)
        const ao = id === WATER ? 3 : (o1 && o2 ? 0 : 3 - o1 - o2 - o3)
        aos[k] = ao
        let [ss, bb] = lgt(nx, ny, nz); let cnt = 1
        if (!o1) { const l = lgt(...p1); ss += l[0]; bb += l[1]; cnt++ }
        if (!o2) { const l = lgt(...p2); ss += l[0]; bb += l[1]; cnt++ }
        if (!o3) { const l = lgt(...p3); ss += l[0]; bb += l[1]; cnt++ }
        buf.l.push(ss / cnt / 15, bb / cnt / 15, f.s * AO[ao])
      }
      const b = buf.n
      if (aos[0] + aos[2] < aos[1] + aos[3]) buf.i.push(b + 1, b + 2, b + 3, b + 1, b + 3, b)
      else buf.i.push(b, b + 1, b + 2, b, b + 2, b + 3)
      buf.n += 4
    }
  }
  const light = new Uint8Array(CS * CS * CH)
  for (let y = 0; y < CH; y++) for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) { const i = ri(lx + M, y, lz + M); light[(y * CS + lz) * CS + lx] = (sky[i] << 4) | blk[i] }
  return { solid: pack(solid), water: pack(water), light, ms: performance.now() - t0, lightMs: tl }
}
function torch(buf, x, y, z, tile, s) {
  const a = 0.4375, b = 0.5625, h = 0.625
  const boxF = [
    [[a, h, b], [b, h, b], [b, h, a], [a, h, a], 1.0],
    [[b, 0, b], [b, 0, a], [b, h, a], [b, h, b], 0.8],
    [[a, 0, a], [a, 0, b], [a, h, b], [a, h, a], 0.8],
    [[a, 0, b], [b, 0, b], [b, h, b], [a, h, b], 0.9],
    [[b, 0, a], [a, 0, a], [a, h, a], [b, h, a], 0.9],
  ]
  for (const f of boxF) {
    for (let k = 0; k < 4; k++) {
      const c = f[k]; buf.p.push(x + c[0], y + c[1], z + c[2])
      const top = k === 0 || f[4] === 1
      buf.u.push((tile + 0.4375 + (UVS[k][0]) * 0.125) / NT, f[4] === 1 ? 0.6 + UVS[k][1] * 0.08 : UVS[k][1] * 0.625)
      buf.l.push(s / 15, 1, f[4])
    }
    const n = buf.n; buf.i.push(n, n + 1, n + 2, n, n + 2, n + 3); buf.n += 4
  }
}
