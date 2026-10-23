import { BlockId } from './textures';

export interface InventorySlot {
  blockId: BlockId;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  nameRu: string;
  inputs: { blockId: BlockId; count: number }[];
  output: { blockId: BlockId; count: number };
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'oak_planks',
    nameRu: 'Дубовые доски (x4)',
    inputs: [{ blockId: BlockId.OAK_LOG, count: 1 }],
    output: { blockId: BlockId.OAK_PLANKS, count: 4 },
  },
  {
    id: 'birch_to_planks',
    nameRu: 'Доски из берёзы (x4)',
    inputs: [{ blockId: BlockId.BIRCH_LOG, count: 1 }],
    output: { blockId: BlockId.OAK_PLANKS, count: 4 },
  },
  {
    id: 'crafting_table',
    nameRu: 'Верстак',
    inputs: [{ blockId: BlockId.OAK_PLANKS, count: 4 }],
    output: { blockId: BlockId.CRAFTING_TABLE, count: 1 },
  },
  {
    id: 'furnace',
    nameRu: 'Печь',
    inputs: [{ blockId: BlockId.COBBLESTONE, count: 8 }],
    output: { blockId: BlockId.FURNACE, count: 1 },
  },
  {
    id: 'glass_smelt',
    nameRu: 'Стекло (x2)',
    inputs: [{ blockId: BlockId.SAND, count: 2 }],
    output: { blockId: BlockId.GLASS, count: 2 },
  },
  {
    id: 'bricks_craft',
    nameRu: 'Кирпичи (x4)',
    inputs: [
      { blockId: BlockId.DIRT, count: 2 },
      { blockId: BlockId.STONE, count: 2 },
    ],
    output: { blockId: BlockId.BRICK, count: 4 },
  },
  {
    id: 'bookshelf_craft',
    nameRu: 'Книжная полка',
    inputs: [
      { blockId: BlockId.OAK_PLANKS, count: 4 },
      { blockId: BlockId.OAK_LEAVES, count: 2 },
    ],
    output: { blockId: BlockId.BOOKSHELF, count: 1 },
  },
  {
    id: 'glowstone_craft',
    nameRu: 'Светокамень (x2)',
    inputs: [
      { blockId: BlockId.COAL_ORE, count: 1 },
      { blockId: BlockId.GLASS, count: 1 },
    ],
    output: { blockId: BlockId.GLOWSTONE, count: 2 },
  },
  {
    id: 'tnt_craft',
    nameRu: 'Динамит TNT (x2)',
    inputs: [
      { blockId: BlockId.SAND, count: 2 },
      { blockId: BlockId.COAL_ORE, count: 1 },
    ],
    output: { blockId: BlockId.TNT, count: 2 },
  },
  {
    id: 'gold_block_craft',
    nameRu: 'Золотой блок',
    inputs: [{ blockId: BlockId.GOLD_ORE, count: 4 }],
    output: { blockId: BlockId.GOLD_BLOCK, count: 1 },
  },
  {
    id: 'diamond_block_craft',
    nameRu: 'Алмазный блок',
    inputs: [{ blockId: BlockId.DIAMOND_ORE, count: 4 }],
    output: { blockId: BlockId.DIAMOND_BLOCK, count: 1 },
  },
];

export const INITIAL_HOTBAR: InventorySlot[] = [
  { blockId: BlockId.GRASS, count: 64 },
  { blockId: BlockId.COBBLESTONE, count: 64 },
  { blockId: BlockId.OAK_PLANKS, count: 64 },
  { blockId: BlockId.OAK_LOG, count: 32 },
  { blockId: BlockId.GLASS, count: 32 },
  { blockId: BlockId.BRICK, count: 32 },
  { blockId: BlockId.GLOWSTONE, count: 16 },
  { blockId: BlockId.CRAFTING_TABLE, count: 4 },
  { blockId: BlockId.TNT, count: 16 },
];
