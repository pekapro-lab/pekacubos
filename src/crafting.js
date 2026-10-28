import { WOOD, PLANKS, STICK, TABLE, STONE, FURNACE, COAL, TORCH, GLASS, LANTERN, BUCKET, SAND, DIRT, BRICK, MEAT, COOKED } from './blocks.js'
// need: null (hands), 'mesa' (crafting table within 4 blocks), 'horno' (furnace within 4 blocks)
export const RECIPES = [
  { id: 'tablones', out: [PLANKS, 4], inp: [[WOOD, 1]], need: null },
  { id: 'palos', out: [STICK, 4], inp: [[PLANKS, 2]], need: null },
  { id: 'mesa', out: [TABLE, 1], inp: [[PLANKS, 4]], need: null },
  { id: 'antorchas', out: [TORCH, 4], inp: [[STICK, 1], [COAL, 1]], need: null },
  { id: 'horno', out: [FURNACE, 1], inp: [[STONE, 8]], need: 'mesa' },
  { id: 'cubo', out: [BUCKET, 1], inp: [[STONE, 3]], need: 'mesa' },
  { id: 'farol', out: [LANTERN, 1], inp: [[TORCH, 1], [GLASS, 2]], need: 'mesa' },
  { id: 'carbon', out: [COAL, 1], inp: [[WOOD, 1]], need: 'horno' },
  { id: 'cristal', out: [GLASS, 1], inp: [[SAND, 1]], need: 'horno' },
  { id: 'ladrillo', out: [BRICK, 2], inp: [[DIRT, 1], [SAND, 1]], need: 'horno' },
  { id: 'asado', out: [COOKED, 1], inp: [[MEAT, 1]], need: 'horno' },
]
export const NEED_NAME = { mesa: 'mesa de trabajo', horno: 'horno' }
