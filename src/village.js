// Pekaville: the fixed starting village (a two-storey house with a garden, a tiled path and a sign).
// Everything is deterministic: the same seed always gives the same house at the same place.
// The structure is applied during chunk generation (before the player's saved changes), so any block the
// player breaks or places later is stored as a normal "mod" and always wins over the house.
import { AIR, GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, GLASS, BRICK, TORCH, TABLE, FURNACE, LANTERN, CHEST, BED, TILE, FLOWER_R, FLOWER_Y, FLOWER_B, SHELF, ROOF, HEDGE, PLASTER,
  SWORD_W, SWORD_S, SWORD_I, SWORD_G, PICK, AXE, SHOVEL, HELMET, CHESTPL, LEGS, BOOTS, APPLE, BREAD, COOKED, COAL, STICK, BUCKET, SAND } from './blocks.js'
import { hash2 } from './noise.js'

export const PLOT = { x0: -12, x1: 12, z0: -12, z1: 15 } // flat garden area (world coords, inclusive)
export const BLEND = 6 // cells around the plot that ease the terrain back to its natural height
export const CHUNKS = (() => { const out = []; for (let cz = Math.floor((PLOT.z0 - BLEND) / 16); cz <= Math.floor((PLOT.z1 + BLEND) / 16); cz++) for (let cx = Math.floor((PLOT.x0 - BLEND) / 16); cx <= Math.floor((PLOT.x1 + BLEND) / 16); cx++) out.push(cx + ',' + cz); return out })()

export function plotDist(x, z) { // 0 inside the plot, else Chebyshev distance to it
  return Math.max(PLOT.x0 - x, x - PLOT.x1, PLOT.z0 - z, z - PLOT.z1, 0)
}
export function siteHeight(heightAt) { // average natural height of the plot, kept dry and below the hills
  let s = 0, n = 0
  for (let z = PLOT.z0; z <= PLOT.z1; z += 3) for (let x = PLOT.x0; x <= PLOT.x1; x += 3) { s += heightAt(x, z); n++ }
  return Math.max(23, Math.min(40, Math.round(s / n)))
}
export const STARTER_CHEST = { [SWORD_I]: 1, [PICK]: 1, [AXE]: 1, [SHOVEL]: 1, [HELMET]: 1, [CHESTPL]: 1, [LEGS]: 1, [BOOTS]: 1,
  [BREAD]: 8, [APPLE]: 8, [COOKED]: 6, [TORCH]: 32, [COAL]: 12, [STICK]: 16, [PLANKS]: 64, [WOOD]: 24, [STONE]: 48, [GLASS]: 24, [BRICK]: 32,
  [TILE]: 32, [PLASTER]: 32, [ROOF]: 32, [LANTERN]: 6, [SHELF]: 4, [BED]: 2, [CHEST]: 2, [HEDGE]: 16, [FLOWER_R]: 8, [FLOWER_Y]: 8, [FLOWER_B]: 8,
  [TABLE]: 1, [FURNACE]: 1, [BUCKET]: 1, [SAND]: 16 }

export function buildVillage(H, seed) {
  const B = new Map() // "x,y,z" -> id
  const put = (x, y, z, id) => B.set(x + ',' + y + ',' + z, id)
  const G = H // ground level (grass top); house floor blocks replace it
  // --- garden ---
  for (let z = PLOT.z0; z <= PLOT.z1; z++) for (let x = PLOT.x0; x <= PLOT.x1; x++) {
    const edge = x === PLOT.x0 + 1 || x === PLOT.x1 - 1 || z === PLOT.z0 + 1 || z === PLOT.z1 - 1
    const inside = x > PLOT.x0 + 1 && x < PLOT.x1 - 1 && z > PLOT.z0 + 1 && z < PLOT.z1 - 1
    if (edge && !(z === PLOT.z1 - 1 && Math.abs(x) <= 1)) put(x, G + 1, z, HEDGE) // hedge ring with a gate gap for the path
    if (!inside) continue
    const bed = (Math.abs(x) >= 6 && Math.abs(x) <= 9 && z >= 6 && z <= 12) || (z === -8 && Math.abs(x) <= 7) // flower beds
    if (bed && hash2(x, z, seed + 501) < 0.75) { const k = hash2(x, z, seed + 502); put(x, G + 1, z, k < 0.4 ? FLOWER_R : k < 0.75 ? FLOWER_Y : FLOWER_B) }
  }
  for (let z = 5; z <= PLOT.z1; z++) for (let x = -1; x <= 1; x++) put(x, G, z, TILE) // tiled path from the door to the gate
  for (const [tx, tz] of [[-9, -8], [9, -8], [-9, 3], [9, 3]]) { // garden trees
    for (let y = G + 1; y <= G + 4; y++) put(tx, y, tz, WOOD)
    for (let dy = 3; dy <= 6; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const r = dy >= 5 ? 1 : 2; if (Math.abs(dx) > r || Math.abs(dz) > r || (Math.abs(dx) === 2 && Math.abs(dz) === 2) || (!dx && !dz && dy <= 4)) continue
      put(tx + dx, G + dy, tz + dz, LEAVES)
    }
  }
  for (const lx of [-2, 2]) for (const lz of [7, 11]) { put(lx, G + 1, lz, WOOD); put(lx, G + 2, lz, WOOD); put(lx, G + 3, lz, LANTERN) } // lamp posts by the path
  // --- house: x -5..5, z -4..4; ground floor stands at G+1, upper floor at G+6 ---
  const X0 = -5, X1 = 5, Z0 = -4, Z1 = 4
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) { put(x, G, z, x === X0 || x === X1 || z === Z0 || z === Z1 ? STONE : PLANKS); put(x, G + 5, z, x === X0 || x === X1 || z === Z0 || z === Z1 ? WOOD : PLANKS) }
  for (let y = G + 1; y <= G + 9; y++) for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
    if (y === G + 5) continue
    const wall = x === X0 || x === X1 || z === Z0 || z === Z1; if (!wall) continue
    const corner = (x === X0 || x === X1) && (z === Z0 || z === Z1)
    put(x, y, z, corner ? WOOD : y <= G + 4 ? BRICK : PLASTER)
  }
  const win = (pts, y0) => { for (const [x, z] of pts) { put(x, y0, z, GLASS); put(x, y0 + 1, z, GLASS) } }
  win([[-3, Z1], [-2, Z1], [2, Z1], [3, Z1], [X0, -1], [X0, 0], [X0, 1], [X1, -1], [X1, 0], [X1, 1], [-3, Z0], [-2, Z0]], G + 2)
  win([[-3, Z1], [-2, Z1], [2, Z1], [3, Z1], [X0, -1], [X0, 0], [X0, 1], [X1, -1], [X1, 0], [X1, 1], [-1, Z0], [0, Z0], [1, Z0]], G + 7)
  put(0, G + 1, Z1, AIR); put(0, G + 2, Z1, AIR) // front door
  put(0, G + 4, Z1 + 1, LANTERN) // lamp over the door
  // gable roof along x (tiles overhang by one), plaster gable ends
  for (let k = 0; k <= 5; k++) {
    const y = G + 10 + k - 1
    for (let x = X0 - 1; x <= X1 + 1; x++) { put(x, y, Z0 - 1 + k, ROOF); put(x, y, Z1 + 1 - k, ROOF) }
    if (k >= 1) for (let z = Z0 + k; z <= Z1 - k; z++) { put(X0, y, z, PLASTER); put(X1, y, z, PLASTER) }
  }
  // stairs along the back wall: 5 steps x=0..4 at z=-3, opening in the ceiling above x=0..3
  for (let i = 0; i <= 4; i++) { for (let y = G + 1; y <= G + 1 + i; y++) put(i, y, -3, PLANKS) }
  for (let x = 0; x <= 3; x++) put(x, G + 5, -3, AIR)
  for (let x = 0; x <= 3; x++) put(x, G + 6, -2, GLASS) // glass railing upstairs along the stair opening
  // ground floor: kitchen corner, dining table, bookshelves, chest by the door, lights
  put(-4, G + 1, -3, TABLE); put(-3, G + 1, -3, FURNACE); put(-2, G + 1, -3, SHELF); put(-2, G + 2, -3, SHELF)
  put(-4, G + 1, -1, SHELF); put(-4, G + 2, -1, SHELF); put(-4, G + 3, -1, TORCH)
  put(4, G + 1, 3, CHEST); put(-4, G + 1, 3, LANTERN); put(4, G + 1, -1, LANTERN)
  // upper floor: bed, bookshelves, lanterns (armour stands and weapon racks are decor objects, see DECOR)
  put(-4, G + 6, -3, BED); put(-4, G + 6, -2, BED); put(-3, G + 6, -3, SHELF); put(-4, G + 6, 0, SHELF); put(-4, G + 7, 0, SHELF)
  put(-4, G + 6, 3, LANTERN); put(4, G + 6, 3, LANTERN); put(-4, G + 6, -1, LANTERN)
  const chest = [4, G + 1, 3]
  // decor objects (rendered meshes, not blocks): sign, furniture, armour stands, weapon / tool racks
  const D = [
    { type: 'sign', x: 2.6, y: G + 1, z: 12.5, rot: 0, text: 'Pekaville' },
    { type: 'table', x: -2, y: G + 1, z: 1 }, { type: 'chair', x: -3.2, y: G + 1, z: 1, rot: -Math.PI / 2 }, { type: 'chair', x: -0.8, y: G + 1, z: 1, rot: Math.PI / 2 },
    { type: 'chair', x: -2, y: G + 1, z: 2.2, rot: 0 },
    { type: 'stand', x: 1.5, y: G + 6, z: 2.5, tier: 'iron', rot: Math.PI }, { type: 'stand', x: 3.2, y: G + 6, z: 2.5, tier: 'gold', rot: Math.PI }, { type: 'stand', x: 3.2, y: G + 6, z: 0.6, tier: 'gem', rot: Math.PI },
    { type: 'rack', x: 4.95, y: G + 6.55, z: 0.5, rot: -Math.PI / 2, items: [SWORD_W, SWORD_S, SWORD_I, SWORD_G] },
    { type: 'rack', x: -3.95, y: G + 4.47, z: 0.5, rot: Math.PI / 2, items: [PICK, AXE, SHOVEL] },
    { type: 'rack', x: -1.5, y: G + 6.55, z: -2.95, rot: 0, items: [HELMET, CHESTPL, LEGS, BOOTS] },
    { type: 'rug', x: 0, y: G + 1.01, z: 1, w: 3, d: 2 },
  ]
  return { blocks: B, decor: D, chest, H, spawn: [0.5, G + 1, 13.5], doorYaw: 0 }
}
