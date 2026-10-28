// Block catalogue. Tile indices refer to the procedural atlas in textures.js.
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, WOOD = 6, LEAVES = 7, PLANKS = 8, BEDROCK = 9, GLASS = 10, BRICK = 11
export const BLOCKS = {
  [GRASS]: { name: 'Césped', tiles: [0, 1, 2], hard: 0.6, sound: 'grass' },
  [DIRT]: { name: 'Tierra', tiles: [2, 2, 2], hard: 0.5, sound: 'dirt' },
  [STONE]: { name: 'Piedra', tiles: [3, 3, 3], hard: 1.5, sound: 'stone' },
  [SAND]: { name: 'Arena', tiles: [4, 4, 4], hard: 0.5, sound: 'sand' },
  [WATER]: { name: 'Agua', tiles: [5, 5, 5], hard: Infinity, sound: 'dirt', fluid: true },
  [WOOD]: { name: 'Tronco', tiles: [7, 6, 7], hard: 1.2, sound: 'wood' },
  [LEAVES]: { name: 'Hojas', tiles: [8, 8, 8], hard: 0.25, sound: 'grass', see: true },
  [PLANKS]: { name: 'Tablones', tiles: [9, 9, 9], hard: 1.0, sound: 'wood' },
  [BEDROCK]: { name: 'Roca base', tiles: [10, 10, 10], hard: Infinity, sound: 'stone' },
  [GLASS]: { name: 'Cristal', tiles: [11, 11, 11], hard: 0.3, sound: 'glass', see: true },
  [BRICK]: { name: 'Ladrillo', tiles: [12, 12, 12], hard: 1.6, sound: 'stone' },
}
// What a broken block drops (grass drops dirt is NOT applied: keep it simple, you get what you break)
export const HOTBAR = [GRASS, DIRT, STONE, SAND, WOOD, LEAVES, PLANKS, GLASS, BRICK]
export const isSolid = (id) => id !== AIR && id !== WATER
export const isOpaque = (id) => id !== AIR && id !== WATER && !BLOCKS[id].see
