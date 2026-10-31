import { AIR, GRASS, DIRT, STONE, SAND, WATER, WOOD, LEAVES, BEDROCK, isSolid } from './blocks.js'
import { fbm, vnoise, hash2 } from './noise.js'
import { PLOT, BLEND, plotDist, siteHeight, buildVillage } from './village.js'
export const CS = 16, CH = 128, WATER_LEVEL = 20
export const idx = (lx, y, lz) => (y * CS + lz) * CS + lx
export const ckey = (cx, cz) => cx + ',' + cz
const NB = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const H4 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]

export class World {
  constructor(seed) {
    this.seed = seed
    this.chunks = new Map() // key -> Uint8Array
    this.metas = new Map() // key -> Uint8Array (water level: 0 = source, 1..7 = flowing)
    this.mods = new Map() // key -> Map(index -> id | meta << 8)  (v1 saves only stored ids: compatible)
    this.onChange = null
    this.active = new Set() // water cells to update ("x,y,z")
    this.village = null // Pekaville layout when enabled (see enableVillage)
  }
  // Must be called before any chunk is generated. Deterministic for the seed.
  enableVillage() {
    const H = siteHeight((x, z) => this.heightAt(x, z))
    this.village = buildVillage(H, this.seed)
    const per = new Map()
    for (const [k, id] of this.village.blocks) { const [x, y, z] = k.split(',').map(Number); const ck = ckey(Math.floor(x / CS), Math.floor(z / CS)); if (!per.has(ck)) per.set(ck, []); per.get(ck).push([x, y, z, id]) }
    this.village.per = per
    return this.village
  }
  genHeight(x, z) { // natural height, flattened on the Pekaville plot and blended around it
    const h = this.heightAt(x, z)
    if (!this.village) return h
    const d = plotDist(x, z); if (d === 0) return this.village.H
    if (d > BLEND) return h
    return Math.round(this.village.H + (h - this.village.H) * (d / BLEND))
  }
  heightAt(x, z) {
    const s = this.seed
    const base = fbm(x / 48, z / 48, s, 4)
    const m = vnoise(x / 160, z / 160, s + 7)
    const h = 12 + base * 20 + Math.max(0, m - 0.4) * 45
    return Math.min(52, Math.floor(h)) // v1 terrain cap kept so v1 worlds generate identically
  }
  generate(cx, cz) {
    const d = new Uint8Array(CS * CS * CH), s = this.seed
    const hs = new Int16Array(CS * CS)
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const wx = cx * CS + lx, wz = cz * CS + lz, h = this.genHeight(wx, wz)
      hs[lz * CS + lx] = h
      const beach = h <= WATER_LEVEL + 1
      for (let y = 0; y < CH; y++) {
        let b = AIR
        if (y === 0) b = BEDROCK
        else if (y < h - 3) b = STONE
        else if (y < h) b = beach ? SAND : DIRT
        else if (y === h) b = beach ? SAND : GRASS
        else if (y <= WATER_LEVEL) b = WATER
        d[idx(lx, y, lz)] = b
      }
    }
    // Trees, kept inside the chunk so generation never depends on neighbours.
    for (let lz = 2; lz < CS - 2; lz++) for (let lx = 2; lx < CS - 2; lx++) {
      const wx = cx * CS + lx, wz = cz * CS + lz, h = hs[lz * CS + lx]
      if (d[idx(lx, h, lz)] !== GRASS || hash2(wx, wz, s + 33) > 0.018) continue
      if (this.village && plotDist(wx, wz) <= BLEND + 2) continue // keep the village clear of wild trees
      const th = 4 + Math.floor(hash2(wx, wz, s + 34) * 2)
      for (let y = h + 1; y <= h + th; y++) d[idx(lx, y, lz)] = WOOD
      const top = h + th
      for (let dy = -2; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const r = dy >= 0 ? 1 : 2
        if (Math.abs(dx) > r || Math.abs(dz) > r) continue
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue
        const y = top + dy
        if (y >= CH) continue
        const i = idx(lx + dx, y, lz + dz)
        if (d[i] === AIR) d[i] = LEAVES
      }
    }
    const vb = this.village && this.village.per.get(ckey(cx, cz))
    if (vb) for (const [x, y, z, id] of vb) d[idx(x - cx * CS, y, z - cz * CS)] = id
    const meta = new Uint8Array(CS * CS * CH)
    const m = this.mods.get(ckey(cx, cz))
    if (m) for (const [i, v] of m) { d[i] = v & 255; meta[i] = v >> 8 }
    this.metas.set(ckey(cx, cz), meta)
    return d
  }
  chunk(cx, cz) {
    const k = ckey(cx, cz)
    let c = this.chunks.get(k)
    if (!c) { c = this.generate(cx, cz); this.chunks.set(k, c) }
    return c
  }
  get(x, y, z) {
    if (y < 0) return BEDROCK
    if (y >= CH) return AIR
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS)
    return this.chunk(cx, cz)[idx(x - cx * CS, y, z - cz * CS)]
  }
  meta(x, y, z) {
    if (y < 0 || y >= CH) return 0
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS)
    this.chunk(cx, cz)
    return this.metas.get(ckey(cx, cz))[idx(x - cx * CS, y, z - cz * CS)]
  }
  set(x, y, z, id, meta = 0, fromWater = false) {
    if (y < 1 || y >= CH) return false
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), k = ckey(cx, cz)
    const i = idx(x - cx * CS, y, z - cz * CS)
    this.chunk(cx, cz)[i] = id
    this.metas.get(k)[i] = id === WATER ? meta : 0
    let m = this.mods.get(k)
    if (!m) this.mods.set(k, (m = new Map()))
    m.set(i, id | ((id === WATER ? meta : 0) << 8))
    // wake water around any change
    for (const [dx, dy, dz] of NB) if (this.get(x + dx, y + dy, z + dz) === WATER) this.active.add((x + dx) + ',' + (y + dy) + ',' + (z + dz))
    if (id === WATER) this.active.add(x + ',' + y + ',' + z)
    this.onChange?.(x, y, z, fromWater)
    return true
  }
  // Cellular water: sources (level 0) and flows (1..7). Processes at most `budget` cells per call.
  waterStep(budget = 96) {
    let n = 0
    const cells = [...this.active]; this.active.clear()
    for (let c = 0; c < cells.length; c++) {
      if (n >= budget) { for (let r = c; r < cells.length; r++) this.active.add(cells[r]); break }
      n++
      const [x, y, z] = cells[c].split(',').map(Number)
      if (this.get(x, y, z) !== WATER) continue
      const L = this.meta(x, y, z)
      if (L > 0) { // flowing water needs a feeder: water above, or a horizontal neighbour with a lower level
        let fed = this.get(x, y + 1, z) === WATER
        for (const [dx, , dz] of H4) if (!fed && this.get(x + dx, y, z + dz) === WATER && this.meta(x + dx, y, z + dz) < L) fed = true
        if (!fed) { this.set(x, y, z, AIR, 0, true); continue }
      }
      const below = this.get(x, y - 1, z)
      if (below === AIR || (below === WATER && this.meta(x, y - 1, z) > 1)) { this.set(x, y - 1, z, WATER, 1, true); continue }
      if (below === WATER && this.meta(x, y - 1, z) <= 1) continue
      if (L >= 7) continue
      for (const [dx, , dz] of H4) {
        const b = this.get(x + dx, y, z + dz)
        if (b === AIR || (b === WATER && this.meta(x + dx, y, z + dz) > L + 1)) this.set(x + dx, y, z + dz, WATER, L + 1, true)
      }
    }
    return n
  }
  surface(x, z) {
    for (let y = CH - 1; y > 0; y--) { const b = this.get(x, y, z); if (b !== AIR) return { y, b } }
    return { y: 0, b: BEDROCK }
  }
  serializeMods() {
    const o = {}
    for (const [k, m] of this.mods) if (m.size) o[k] = [...m].flat()
    return o
  }
  loadMods(o) {
    for (const k in o) { const a = o[k], m = new Map(); for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]); this.mods.set(k, m) }
  }
}
