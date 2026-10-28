// Block + item catalogue. Ids < 100 are placeable blocks (atlas tiles [top, side, bottom]); >= 100 are items.
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, WOOD = 6, LEAVES = 7, PLANKS = 8, BEDROCK = 9, GLASS = 10, BRICK = 11
export const TORCH = 12, TABLE = 13, FURNACE = 14, LANTERN = 15
export const STICK = 100, COAL = 101, BUCKET = 102, WATER_BUCKET = 103, MEAT = 104, COOKED = 105
export const BLOCKS = {
  [GRASS]: { name: 'Césped', tiles: [0, 1, 2], hard: 0.6, sound: 'grass', drop: DIRT },
  [DIRT]: { name: 'Tierra', tiles: [2, 2, 2], hard: 0.5, sound: 'dirt' },
  [STONE]: { name: 'Piedra', tiles: [3, 3, 3], hard: 1.5, sound: 'stone' },
  [SAND]: { name: 'Arena', tiles: [4, 4, 4], hard: 0.5, sound: 'sand' },
  [WATER]: { name: 'Agua', tiles: [5, 5, 5], hard: Infinity, sound: 'dirt', fluid: true },
  [WOOD]: { name: 'Tronco', tiles: [7, 6, 7], hard: 1.2, sound: 'wood' },
  [LEAVES]: { name: 'Hojas', tiles: [8, 8, 8], hard: 0.25, sound: 'grass', see: true, dim: 1 },
  [PLANKS]: { name: 'Tablones', tiles: [9, 9, 9], hard: 1.0, sound: 'wood' },
  [BEDROCK]: { name: 'Roca base', tiles: [10, 10, 10], hard: Infinity, sound: 'stone' },
  [GLASS]: { name: 'Cristal', tiles: [11, 11, 11], hard: 0.3, sound: 'glass', see: true },
  [BRICK]: { name: 'Ladrillo', tiles: [12, 12, 12], hard: 1.6, sound: 'stone' },
  [TORCH]: { name: 'Antorcha', tiles: [13, 13, 13], hard: 0.05, sound: 'wood', see: true, light: 14, shape: 'torch', nonSolid: true },
  [TABLE]: { name: 'Mesa de trabajo', tiles: [14, 15, 9], hard: 1.2, sound: 'wood' },
  [FURNACE]: { name: 'Horno', tiles: [17, 16, 17], hard: 1.8, sound: 'stone' },
  [LANTERN]: { name: 'Farol', tiles: [18, 18, 18], hard: 0.4, sound: 'glass', see: true, light: 15 },
}
export const ITEMS = {
  [STICK]: { name: 'Palo' }, [COAL]: { name: 'Carbón' }, [BUCKET]: { name: 'Cubo' }, [WATER_BUCKET]: { name: 'Cubo de agua' },
  [MEAT]: { name: 'Carne cruda', food: 3 }, [COOKED]: { name: 'Carne asada', food: 8 },
}
export const itemName = (id) => (BLOCKS[id] || ITEMS[id] || { name: '?' }).name
export const isBlock = (id) => id > 0 && id < 100
// v1 hotbar (kept for old saves) and the v2 default
export const HOTBAR = [GRASS, DIRT, STONE, SAND, WOOD, LEAVES, PLANKS, GLASS, BRICK]
export const HOTBAR2 = [DIRT, STONE, PLANKS, WOOD, GLASS, BRICK, TORCH, BUCKET, SAND]
export const isSolid = (id) => id !== AIR && id !== WATER && !(BLOCKS[id] && BLOCKS[id].nonSolid)
export const isOpaque = (id) => id !== AIR && id !== WATER && !BLOCKS[id].see
export const lightOf = (id) => (BLOCKS[id] && BLOCKS[id].light) || 0
