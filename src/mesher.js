import * as THREE from 'three'
import { AIR, WATER, BLOCKS, isOpaque } from './blocks.js'
import { CS, CH, idx } from './world.js'
import { T, NT } from './textures.js'
// face: dir, 4 corners (CCW from outside), shade, tile slot (0 top,1 side,2 bottom)
const FACES = [
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 2 },
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.75, t: 1 },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.75, t: 1 },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.86, t: 1 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.62, t: 1 },
]
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]]
const E = 0.02 / NT
class Buf { constructor() { this.p = []; this.u = []; this.c = []; this.i = []; this.n = 0 }
  geo() { if (!this.n) return null; const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.n > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1))
    g.computeBoundingSphere(); return g } }
export function buildChunk(world, cx, cz) {
  const d = world.chunk(cx, cz)
  // neighbour chunks so edge faces are culled correctly
  const nb = { px: world.chunk(cx + 1, cz), nx: world.chunk(cx - 1, cz), pz: world.chunk(cx, cz + 1), nz: world.chunk(cx, cz - 1) }
  const get = (x, y, z) => {
    if (y < 0) return 1; if (y >= CH) return AIR
    if (x < 0) return nb.nx[idx(x + CS, y, z)]; if (x >= CS) return nb.px[idx(x - CS, y, z)]
    if (z < 0) return nb.nz[idx(x, y, z + CS)]; if (z >= CS) return nb.pz[idx(x, y, z - CS)]
    return d[idx(x, y, z)]
  }
  const solid = new Buf(), water = new Buf()
  for (let y = 0; y < CH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const id = d[idx(x, y, z)]; if (id === AIR) continue
    const B = BLOCKS[id]
    for (const f of FACES) {
      const n = get(x + f.d[0], y + f.d[1], z + f.d[2])
      if (id === WATER) { if (n !== AIR && (f.d[1] !== 1 || n === WATER)) continue; if (n === WATER) continue }
      else if (isOpaque(n) || (n === id && B.see)) continue
      const buf = id === WATER ? water : solid
      const tile = B.tiles[f.t]
      for (let k = 0; k < 4; k++) {
        const cc = f.c[k]
        let vy = y + cc[1]
        if (id === WATER && cc[1] === 1 && get(x, y + 1, z) !== WATER) vy -= 0.12
        buf.p.push(cx * CS + x + cc[0], vy, cz * CS + z + cc[2])
        buf.u.push((tile + E + UVS[k][0] * (1 - 2 * E)) / NT, UVS[k][1])
        buf.c.push(f.s, f.s, f.s)
      }
      const b = buf.n; buf.i.push(b, b + 1, b + 2, b, b + 2, b + 3); buf.n += 4
    }
  }
  return { solid: solid.geo(), water: water.geo() }
}
