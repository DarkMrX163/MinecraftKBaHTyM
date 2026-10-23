import * as THREE from 'three';

export enum BlockId {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  COBBLESTONE = 4,
  OAK_LOG = 5,
  OAK_PLANKS = 6,
  OAK_LEAVES = 7,
  GLASS = 8,
  SAND = 9,
  WATER = 10,
  BRICK = 11,
  COAL_ORE = 12,
  IRON_ORE = 13,
  GOLD_ORE = 14,
  DIAMOND_ORE = 15,
  CRAFTING_TABLE = 16,
  FURNACE = 17,
  GLOWSTONE = 18,
  TNT = 19,
  SNOW_GRASS = 20,
  BIRCH_LOG = 21,
  BOOKSHELF = 22,
  OBSIDIAN = 23,
  BEDROCK = 24,
  DIAMOND_BLOCK = 25,
  GOLD_BLOCK = 26,
}

export interface BlockDefinition {
  id: BlockId;
  name: string;
  nameRu: string;
  transparent?: boolean;
  fluid?: boolean;
  lightLevel?: number;
  hardness: number; // seconds to break by hand
  unbreakable?: boolean;
  // Atlas tile indices [top, bottom, north, south, east, west]
  faces: [number, number, number, number, number, number];
  iconTile: number;
}

// 8x8 tile atlas (64 tiles total, each 16x16 pixels -> 128x128 total canvas)
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;
export const TILE_SIZE = 16;

export const TILE_INDEX = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  OAK_LOG_SIDE: 5,
  OAK_LOG_TOP: 6,
  OAK_PLANKS: 7,
  OAK_LEAVES: 8,
  GLASS: 9,
  SAND: 10,
  WATER: 11,
  BRICK: 12,
  COAL_ORE: 13,
  IRON_ORE: 14,
  GOLD_ORE: 15,
  DIAMOND_ORE: 16,
  CRAFT_TOP: 17,
  CRAFT_SIDE: 18,
  CRAFT_FRONT: 19,
  FURNACE_TOP: 20,
  FURNACE_SIDE: 21,
  FURNACE_FRONT: 22,
  GLOWSTONE: 23,
  TNT_TOP: 24,
  TNT_BOTTOM: 25,
  TNT_SIDE: 26,
  SNOW_TOP: 27,
  SNOW_SIDE: 28,
  BIRCH_SIDE: 29,
  BIRCH_TOP: 30,
  BOOKSHELF_SIDE: 31,
  OBSIDIAN: 32,
  BEDROCK: 33,
  DIAMOND_BLOCK: 34,
  GOLD_BLOCK: 35,
};

export const BLOCKS: Record<number, BlockDefinition> = {
  [BlockId.AIR]: {
    id: BlockId.AIR,
    name: 'Air',
    nameRu: 'Воздух',
    transparent: true,
    hardness: 0,
    faces: [0, 0, 0, 0, 0, 0],
    iconTile: 0,
  },
  [BlockId.GRASS]: {
    id: BlockId.GRASS,
    name: 'Grass Block',
    nameRu: 'Дёрн',
    hardness: 0.6,
    faces: [
      TILE_INDEX.GRASS_TOP,
      TILE_INDEX.DIRT,
      TILE_INDEX.GRASS_SIDE,
      TILE_INDEX.GRASS_SIDE,
      TILE_INDEX.GRASS_SIDE,
      TILE_INDEX.GRASS_SIDE,
    ],
    iconTile: TILE_INDEX.GRASS_SIDE,
  },
  [BlockId.DIRT]: {
    id: BlockId.DIRT,
    name: 'Dirt',
    nameRu: 'Земля',
    hardness: 0.5,
    faces: [
      TILE_INDEX.DIRT,
      TILE_INDEX.DIRT,
      TILE_INDEX.DIRT,
      TILE_INDEX.DIRT,
      TILE_INDEX.DIRT,
      TILE_INDEX.DIRT,
    ],
    iconTile: TILE_INDEX.DIRT,
  },
  [BlockId.STONE]: {
    id: BlockId.STONE,
    name: 'Stone',
    nameRu: 'Камень',
    hardness: 1.2,
    faces: [
      TILE_INDEX.STONE,
      TILE_INDEX.STONE,
      TILE_INDEX.STONE,
      TILE_INDEX.STONE,
      TILE_INDEX.STONE,
      TILE_INDEX.STONE,
    ],
    iconTile: TILE_INDEX.STONE,
  },
  [BlockId.COBBLESTONE]: {
    id: BlockId.COBBLESTONE,
    name: 'Cobblestone',
    nameRu: 'Булыжник',
    hardness: 1.4,
    faces: [
      TILE_INDEX.COBBLESTONE,
      TILE_INDEX.COBBLESTONE,
      TILE_INDEX.COBBLESTONE,
      TILE_INDEX.COBBLESTONE,
      TILE_INDEX.COBBLESTONE,
      TILE_INDEX.COBBLESTONE,
    ],
    iconTile: TILE_INDEX.COBBLESTONE,
  },
  [BlockId.OAK_LOG]: {
    id: BlockId.OAK_LOG,
    name: 'Oak Log',
    nameRu: 'Дубовое бревно',
    hardness: 1.0,
    faces: [
      TILE_INDEX.OAK_LOG_TOP,
      TILE_INDEX.OAK_LOG_TOP,
      TILE_INDEX.OAK_LOG_SIDE,
      TILE_INDEX.OAK_LOG_SIDE,
      TILE_INDEX.OAK_LOG_SIDE,
      TILE_INDEX.OAK_LOG_SIDE,
    ],
    iconTile: TILE_INDEX.OAK_LOG_SIDE,
  },
  [BlockId.OAK_PLANKS]: {
    id: BlockId.OAK_PLANKS,
    name: 'Oak Planks',
    nameRu: 'Дубовые доски',
    hardness: 0.9,
    faces: [
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.OAK_PLANKS,
    ],
    iconTile: TILE_INDEX.OAK_PLANKS,
  },
  [BlockId.OAK_LEAVES]: {
    id: BlockId.OAK_LEAVES,
    name: 'Oak Leaves',
    nameRu: 'Дубовая листва',
    hardness: 0.25,
    faces: [
      TILE_INDEX.OAK_LEAVES,
      TILE_INDEX.OAK_LEAVES,
      TILE_INDEX.OAK_LEAVES,
      TILE_INDEX.OAK_LEAVES,
      TILE_INDEX.OAK_LEAVES,
      TILE_INDEX.OAK_LEAVES,
    ],
    iconTile: TILE_INDEX.OAK_LEAVES,
  },
  [BlockId.GLASS]: {
    id: BlockId.GLASS,
    name: 'Glass',
    nameRu: 'Стекло',
    transparent: true,
    hardness: 0.3,
    faces: [
      TILE_INDEX.GLASS,
      TILE_INDEX.GLASS,
      TILE_INDEX.GLASS,
      TILE_INDEX.GLASS,
      TILE_INDEX.GLASS,
      TILE_INDEX.GLASS,
    ],
    iconTile: TILE_INDEX.GLASS,
  },
  [BlockId.SAND]: {
    id: BlockId.SAND,
    name: 'Sand',
    nameRu: 'Песок',
    hardness: 0.5,
    faces: [
      TILE_INDEX.SAND,
      TILE_INDEX.SAND,
      TILE_INDEX.SAND,
      TILE_INDEX.SAND,
      TILE_INDEX.SAND,
      TILE_INDEX.SAND,
    ],
    iconTile: TILE_INDEX.SAND,
  },
  [BlockId.WATER]: {
    id: BlockId.WATER,
    name: 'Water',
    nameRu: 'Вода',
    transparent: true,
    fluid: true,
    hardness: 1.0,
    faces: [
      TILE_INDEX.WATER,
      TILE_INDEX.WATER,
      TILE_INDEX.WATER,
      TILE_INDEX.WATER,
      TILE_INDEX.WATER,
      TILE_INDEX.WATER,
    ],
    iconTile: TILE_INDEX.WATER,
  },
  [BlockId.BRICK]: {
    id: BlockId.BRICK,
    name: 'Bricks',
    nameRu: 'Кирпичи',
    hardness: 1.5,
    faces: [
      TILE_INDEX.BRICK,
      TILE_INDEX.BRICK,
      TILE_INDEX.BRICK,
      TILE_INDEX.BRICK,
      TILE_INDEX.BRICK,
      TILE_INDEX.BRICK,
    ],
    iconTile: TILE_INDEX.BRICK,
  },
  [BlockId.COAL_ORE]: {
    id: BlockId.COAL_ORE,
    name: 'Coal Ore',
    nameRu: 'Угольная руда',
    hardness: 1.6,
    faces: [
      TILE_INDEX.COAL_ORE,
      TILE_INDEX.COAL_ORE,
      TILE_INDEX.COAL_ORE,
      TILE_INDEX.COAL_ORE,
      TILE_INDEX.COAL_ORE,
      TILE_INDEX.COAL_ORE,
    ],
    iconTile: TILE_INDEX.COAL_ORE,
  },
  [BlockId.IRON_ORE]: {
    id: BlockId.IRON_ORE,
    name: 'Iron Ore',
    nameRu: 'Железная руда',
    hardness: 1.8,
    faces: [
      TILE_INDEX.IRON_ORE,
      TILE_INDEX.IRON_ORE,
      TILE_INDEX.IRON_ORE,
      TILE_INDEX.IRON_ORE,
      TILE_INDEX.IRON_ORE,
      TILE_INDEX.IRON_ORE,
    ],
    iconTile: TILE_INDEX.IRON_ORE,
  },
  [BlockId.GOLD_ORE]: {
    id: BlockId.GOLD_ORE,
    name: 'Gold Ore',
    nameRu: 'Золотая руда',
    hardness: 2.0,
    faces: [
      TILE_INDEX.GOLD_ORE,
      TILE_INDEX.GOLD_ORE,
      TILE_INDEX.GOLD_ORE,
      TILE_INDEX.GOLD_ORE,
      TILE_INDEX.GOLD_ORE,
      TILE_INDEX.GOLD_ORE,
    ],
    iconTile: TILE_INDEX.GOLD_ORE,
  },
  [BlockId.DIAMOND_ORE]: {
    id: BlockId.DIAMOND_ORE,
    name: 'Diamond Ore',
    nameRu: 'Алмазная руда',
    hardness: 2.2,
    faces: [
      TILE_INDEX.DIAMOND_ORE,
      TILE_INDEX.DIAMOND_ORE,
      TILE_INDEX.DIAMOND_ORE,
      TILE_INDEX.DIAMOND_ORE,
      TILE_INDEX.DIAMOND_ORE,
      TILE_INDEX.DIAMOND_ORE,
    ],
    iconTile: TILE_INDEX.DIAMOND_ORE,
  },
  [BlockId.CRAFTING_TABLE]: {
    id: BlockId.CRAFTING_TABLE,
    name: 'Crafting Table',
    nameRu: 'Верстак',
    hardness: 1.0,
    faces: [
      TILE_INDEX.CRAFT_TOP,
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.CRAFT_FRONT,
      TILE_INDEX.CRAFT_SIDE,
      TILE_INDEX.CRAFT_FRONT,
      TILE_INDEX.CRAFT_SIDE,
    ],
    iconTile: TILE_INDEX.CRAFT_FRONT,
  },
  [BlockId.FURNACE]: {
    id: BlockId.FURNACE,
    name: 'Furnace',
    nameRu: 'Печь',
    hardness: 1.5,
    faces: [
      TILE_INDEX.FURNACE_TOP,
      TILE_INDEX.FURNACE_TOP,
      TILE_INDEX.FURNACE_FRONT,
      TILE_INDEX.FURNACE_SIDE,
      TILE_INDEX.FURNACE_SIDE,
      TILE_INDEX.FURNACE_SIDE,
    ],
    iconTile: TILE_INDEX.FURNACE_FRONT,
  },
  [BlockId.GLOWSTONE]: {
    id: BlockId.GLOWSTONE,
    name: 'Glowstone',
    nameRu: 'Светокамень',
    lightLevel: 15,
    hardness: 0.4,
    faces: [
      TILE_INDEX.GLOWSTONE,
      TILE_INDEX.GLOWSTONE,
      TILE_INDEX.GLOWSTONE,
      TILE_INDEX.GLOWSTONE,
      TILE_INDEX.GLOWSTONE,
      TILE_INDEX.GLOWSTONE,
    ],
    iconTile: TILE_INDEX.GLOWSTONE,
  },
  [BlockId.TNT]: {
    id: BlockId.TNT,
    name: 'TNT',
    nameRu: 'Динамит (ПКМ - взрыв)',
    hardness: 0.2,
    faces: [
      TILE_INDEX.TNT_TOP,
      TILE_INDEX.TNT_BOTTOM,
      TILE_INDEX.TNT_SIDE,
      TILE_INDEX.TNT_SIDE,
      TILE_INDEX.TNT_SIDE,
      TILE_INDEX.TNT_SIDE,
    ],
    iconTile: TILE_INDEX.TNT_SIDE,
  },
  [BlockId.SNOW_GRASS]: {
    id: BlockId.SNOW_GRASS,
    name: 'Snowy Grass',
    nameRu: 'Снежный дёрн',
    hardness: 0.6,
    faces: [
      TILE_INDEX.SNOW_TOP,
      TILE_INDEX.DIRT,
      TILE_INDEX.SNOW_SIDE,
      TILE_INDEX.SNOW_SIDE,
      TILE_INDEX.SNOW_SIDE,
      TILE_INDEX.SNOW_SIDE,
    ],
    iconTile: TILE_INDEX.SNOW_SIDE,
  },
  [BlockId.BIRCH_LOG]: {
    id: BlockId.BIRCH_LOG,
    name: 'Birch Log',
    nameRu: 'Берёзовое бревно',
    hardness: 1.0,
    faces: [
      TILE_INDEX.BIRCH_TOP,
      TILE_INDEX.BIRCH_TOP,
      TILE_INDEX.BIRCH_SIDE,
      TILE_INDEX.BIRCH_SIDE,
      TILE_INDEX.BIRCH_SIDE,
      TILE_INDEX.BIRCH_SIDE,
    ],
    iconTile: TILE_INDEX.BIRCH_SIDE,
  },
  [BlockId.BOOKSHELF]: {
    id: BlockId.BOOKSHELF,
    name: 'Bookshelf',
    nameRu: 'Книжная полка',
    hardness: 0.9,
    faces: [
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.OAK_PLANKS,
      TILE_INDEX.BOOKSHELF_SIDE,
      TILE_INDEX.BOOKSHELF_SIDE,
      TILE_INDEX.BOOKSHELF_SIDE,
      TILE_INDEX.BOOKSHELF_SIDE,
    ],
    iconTile: TILE_INDEX.BOOKSHELF_SIDE,
  },
  [BlockId.OBSIDIAN]: {
    id: BlockId.OBSIDIAN,
    name: 'Obsidian',
    nameRu: 'Обсидиан',
    hardness: 3.5,
    faces: [
      TILE_INDEX.OBSIDIAN,
      TILE_INDEX.OBSIDIAN,
      TILE_INDEX.OBSIDIAN,
      TILE_INDEX.OBSIDIAN,
      TILE_INDEX.OBSIDIAN,
      TILE_INDEX.OBSIDIAN,
    ],
    iconTile: TILE_INDEX.OBSIDIAN,
  },
  [BlockId.BEDROCK]: {
    id: BlockId.BEDROCK,
    name: 'Bedrock',
    nameRu: 'Бедрок',
    hardness: 999,
    unbreakable: true,
    faces: [
      TILE_INDEX.BEDROCK,
      TILE_INDEX.BEDROCK,
      TILE_INDEX.BEDROCK,
      TILE_INDEX.BEDROCK,
      TILE_INDEX.BEDROCK,
      TILE_INDEX.BEDROCK,
    ],
    iconTile: TILE_INDEX.BEDROCK,
  },
  [BlockId.DIAMOND_BLOCK]: {
    id: BlockId.DIAMOND_BLOCK,
    name: 'Diamond Block',
    nameRu: 'Алмазный блок',
    hardness: 2.0,
    faces: [
      TILE_INDEX.DIAMOND_BLOCK,
      TILE_INDEX.DIAMOND_BLOCK,
      TILE_INDEX.DIAMOND_BLOCK,
      TILE_INDEX.DIAMOND_BLOCK,
      TILE_INDEX.DIAMOND_BLOCK,
      TILE_INDEX.DIAMOND_BLOCK,
    ],
    iconTile: TILE_INDEX.DIAMOND_BLOCK,
  },
  [BlockId.GOLD_BLOCK]: {
    id: BlockId.GOLD_BLOCK,
    name: 'Gold Block',
    nameRu: 'Золотой блок',
    hardness: 1.8,
    faces: [
      TILE_INDEX.GOLD_BLOCK,
      TILE_INDEX.GOLD_BLOCK,
      TILE_INDEX.GOLD_BLOCK,
      TILE_INDEX.GOLD_BLOCK,
      TILE_INDEX.GOLD_BLOCK,
      TILE_INDEX.GOLD_BLOCK,
    ],
    iconTile: TILE_INDEX.GOLD_BLOCK,
  },
};

export const PLACEABLE_BLOCKS: BlockId[] = [
  BlockId.GRASS,
  BlockId.DIRT,
  BlockId.STONE,
  BlockId.COBBLESTONE,
  BlockId.OAK_LOG,
  BlockId.OAK_PLANKS,
  BlockId.CRAFTING_TABLE,
  BlockId.FURNACE,
  BlockId.GLASS,
  BlockId.BRICK,
  BlockId.SAND,
  BlockId.SNOW_GRASS,
  BlockId.BIRCH_LOG,
  BlockId.OAK_LEAVES,
  BlockId.BOOKSHELF,
  BlockId.GLOWSTONE,
  BlockId.TNT,
  BlockId.DIAMOND_BLOCK,
  BlockId.GOLD_BLOCK,
  BlockId.OBSIDIAN,
  BlockId.COAL_ORE,
  BlockId.IRON_ORE,
  BlockId.GOLD_ORE,
  BlockId.DIAMOND_ORE,
];

// Deterministic PRNG for authentic pixel noise
function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shadeHex(hex: string, delta: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + delta));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + delta));
  const b = Math.min(255, Math.max(0, (num & 0xff) + delta));
  return `rgb(${r},${g},${b})`;
}

export interface GeneratedAtlas {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  blockIcons: Record<number, string>; // DataURL per blockId for crisp UI icons
}

let cachedAtlas: GeneratedAtlas | null = null;

export function getMinecraftAtlas(): GeneratedAtlas {
  if (cachedAtlas) return cachedAtlas;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_SIZE;
  canvas.height = ATLAS_ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const rand = createSeededRandom(1013904);

  const drawPixel = (tileIdx: number, px: number, py: number, color: string) => {
    const tx = (tileIdx % ATLAS_COLS) * TILE_SIZE;
    const ty = Math.floor(tileIdx / ATLAS_COLS) * TILE_SIZE;
    ctx.fillStyle = color;
    ctx.fillRect(tx + px, ty + py, 1, 1);
  };

  const fillNoiseTile = (tileIdx: number, baseHex: string, variance = 16) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.floor((rand() - 0.5) * 2 * variance);
        drawPixel(tileIdx, x, y, shadeHex(baseHex, d));
      }
    }
  };

  // 0: GRASS_TOP
  fillNoiseTile(TILE_INDEX.GRASS_TOP, '#5da632', 18);
  for (let i = 0; i < 32; i++) {
    drawPixel(TILE_INDEX.GRASS_TOP, Math.floor(rand() * 16), Math.floor(rand() * 16), '#4b8b26');
  }

  // 2: DIRT
  fillNoiseTile(TILE_INDEX.DIRT, '#866043', 18);
  for (let i = 0; i < 25; i++) {
    drawPixel(TILE_INDEX.DIRT, Math.floor(rand() * 16), Math.floor(rand() * 16), '#63442b');
  }

  // 1: GRASS_SIDE
  fillNoiseTile(TILE_INDEX.GRASS_SIDE, '#866043', 18);
  for (let x = 0; x < 16; x++) {
    const grassDepth = 2 + Math.floor(rand() * 3);
    for (let y = 0; y < grassDepth; y++) {
      drawPixel(TILE_INDEX.GRASS_SIDE, x, y, shadeHex('#5da632', Math.floor((rand() - 0.5) * 20)));
    }
    drawPixel(TILE_INDEX.GRASS_SIDE, x, grassDepth, '#437c22');
  }

  // 3: STONE
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const streak = ((x + y * 3) % 5 === 0) ? -12 : 0;
      const d = Math.floor((rand() - 0.5) * 20) + streak;
      drawPixel(TILE_INDEX.STONE, x, y, shadeHex('#7d7d7d', d));
    }
  }

  // 4: COBBLESTONE
  fillNoiseTile(TILE_INDEX.COBBLESTONE, '#6b6b6b', 28);
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x++) {
      drawPixel(TILE_INDEX.COBBLESTONE, (x + (y % 8)) % 16, y, '#474747');
    }
  }

  // 5: OAK_LOG_SIDE
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const stripe = x % 4 === 0 ? -14 : (x % 3 === 0 ? 8 : 0);
      drawPixel(TILE_INDEX.OAK_LOG_SIDE, x, y, shadeHex('#675032', stripe + Math.floor((rand() - 0.5) * 14)));
    }
  }

  // 6: OAK_LOG_TOP
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (dist > 6.5) {
        drawPixel(TILE_INDEX.OAK_LOG_TOP, x, y, '#675032');
      } else if (Math.floor(dist) % 2 === 0) {
        drawPixel(TILE_INDEX.OAK_LOG_TOP, x, y, '#a68553');
      } else {
        drawPixel(TILE_INDEX.OAK_LOG_TOP, x, y, '#927344');
      }
    }
  }

  // 7: OAK_PLANKS
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const isGroove = y % 4 === 0 || (x === ((Math.floor(y / 4) * 7) % 16));
      const base = isGroove ? '#7e623a' : '#a2824e';
      drawPixel(TILE_INDEX.OAK_PLANKS, x, y, shadeHex(base, Math.floor((rand() - 0.5) * 12)));
    }
  }

  // 8: OAK_LEAVES
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = rand() > 0.25 ? shadeHex('#3b7d23', Math.floor((rand() - 0.5) * 28)) : '#245214';
      drawPixel(TILE_INDEX.OAK_LEAVES, x, y, c);
    }
  }

  // 9: GLASS
  const txG = (TILE_INDEX.GLASS % ATLAS_COLS) * TILE_SIZE;
  const tyG = Math.floor(TILE_INDEX.GLASS / ATLAS_COLS) * TILE_SIZE;
  ctx.clearRect(txG, tyG, 16, 16);
  ctx.fillStyle = 'rgba(210, 245, 255, 0.18)';
  ctx.fillRect(txG, tyG, 16, 16);
  for (let i = 0; i < 16; i++) {
    drawPixel(TILE_INDEX.GLASS, i, 0, '#d8f6ff');
    drawPixel(TILE_INDEX.GLASS, i, 15, '#9ad0de');
    drawPixel(TILE_INDEX.GLASS, 0, i, '#d8f6ff');
    drawPixel(TILE_INDEX.GLASS, 15, i, '#9ad0de');
  }
  drawPixel(TILE_INDEX.GLASS, 3, 3, '#ffffff');
  drawPixel(TILE_INDEX.GLASS, 4, 3, '#ffffff');
  drawPixel(TILE_INDEX.GLASS, 3, 4, '#ffffff');
  drawPixel(TILE_INDEX.GLASS, 11, 11, '#ffffff');
  drawPixel(TILE_INDEX.GLASS, 12, 11, '#ffffff');

  // 10: SAND
  fillNoiseTile(TILE_INDEX.SAND, '#dcd08e', 16);

  // 11: WATER
  const txW = (TILE_INDEX.WATER % ATLAS_COLS) * TILE_SIZE;
  const tyW = Math.floor(TILE_INDEX.WATER / ATLAS_COLS) * TILE_SIZE;
  ctx.clearRect(txW, tyW, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const wave = (x + y) % 6 === 0 ? 'rgba(65, 145, 245, 0.78)' : 'rgba(38, 102, 210, 0.72)';
      drawPixel(TILE_INDEX.WATER, x, y, wave);
    }
  }

  // 12: BRICK
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const mortarY = y % 4 === 0;
      const offset = (Math.floor(y / 4) % 2) * 4;
      const mortarX = (x + offset) % 8 === 0;
      if (mortarY || mortarX) {
        drawPixel(TILE_INDEX.BRICK, x, y, '#bcaea5');
      } else {
        drawPixel(TILE_INDEX.BRICK, x, y, shadeHex('#964b3b', Math.floor((rand() - 0.5) * 18)));
      }
    }
  }

  // Helper for Ores (13: COAL, 14: IRON, 15: GOLD, 16: DIAMOND)
  const drawOre = (tileIdx: number, fleckColor: string, highlightColor: string) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        drawPixel(tileIdx, x, y, shadeHex('#7d7d7d', Math.floor((rand() - 0.5) * 18)));
      }
    }
    const spots = [
      [3, 4], [4, 4], [4, 5],
      [10, 3], [11, 3], [10, 4],
      [5, 11], [6, 11], [6, 12],
      [11, 10], [12, 10], [11, 11],
      [8, 7], [9, 7],
    ];
    for (const [sx, sy] of spots) {
      drawPixel(tileIdx, sx, sy, fleckColor);
      if (rand() > 0.5) drawPixel(tileIdx, sx, Math.max(0, sy - 1), highlightColor);
    }
  };

  drawOre(TILE_INDEX.COAL_ORE, '#222222', '#3a3a3a');
  drawOre(TILE_INDEX.IRON_ORE, '#d8af93', '#f2d3be');
  drawOre(TILE_INDEX.GOLD_ORE, '#fcee4b', '#fffb96');
  drawOre(TILE_INDEX.DIAMOND_ORE, '#5decf5', '#b8fdff');

  // 17, 18, 19: CRAFTING TABLE
  fillNoiseTile(TILE_INDEX.CRAFT_TOP, '#8d5b34', 12);
  for (let i = 2; i < 14; i++) {
    drawPixel(TILE_INDEX.CRAFT_TOP, i, 2, '#4a2d16');
    drawPixel(TILE_INDEX.CRAFT_TOP, i, 13, '#4a2d16');
    drawPixel(TILE_INDEX.CRAFT_TOP, 2, i, '#4a2d16');
    drawPixel(TILE_INDEX.CRAFT_TOP, 13, i, '#4a2d16');
    drawPixel(TILE_INDEX.CRAFT_TOP, i, 6, '#5c381c');
    drawPixel(TILE_INDEX.CRAFT_TOP, i, 9, '#5c381c');
    drawPixel(TILE_INDEX.CRAFT_TOP, 6, i, '#5c381c');
    drawPixel(TILE_INDEX.CRAFT_TOP, 9, i, '#5c381c');
  }

  for (const t of [TILE_INDEX.CRAFT_SIDE, TILE_INDEX.CRAFT_FRONT]) {
    fillNoiseTile(t, '#9e7d4b', 10);
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 4; y++) {
        drawPixel(t, x, y, '#734a28');
      }
    }
    // Tool silhouettes on side
    for (let y = 6; y < 13; y++) {
      drawPixel(t, 4, y, '#383838');
      drawPixel(t, 11, y, '#4a2d16');
    }
    drawPixel(t, 10, 6, '#999999');
    drawPixel(t, 11, 6, '#bbbbbb');
    drawPixel(t, 12, 6, '#999999');
  }

  // 20, 21, 22: FURNACE
  fillNoiseTile(TILE_INDEX.FURNACE_TOP, '#727272', 14);
  fillNoiseTile(TILE_INDEX.FURNACE_SIDE, '#686868', 18);
  fillNoiseTile(TILE_INDEX.FURNACE_FRONT, '#686868', 18);
  for (let y = 3; y < 14; y++) {
    for (let x = 4; x < 12; x++) {
      if (y === 8) continue;
      const isFire = y > 9 && (x + y) % 2 === 0;
      drawPixel(TILE_INDEX.FURNACE_FRONT, x, y, isFire ? '#ff9922' : '#242424');
    }
  }

  // 23: GLOWSTONE
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rand();
      const c = r > 0.7 ? '#ffffaa' : r > 0.35 ? '#f5c74e' : '#9c6e27';
      drawPixel(TILE_INDEX.GLOWSTONE, x, y, c);
    }
  }

  // 24, 25, 26: TNT
  fillNoiseTile(TILE_INDEX.TNT_TOP, '#c93828', 14);
  drawPixel(TILE_INDEX.TNT_TOP, 7, 7, '#222222');
  drawPixel(TILE_INDEX.TNT_TOP, 8, 7, '#eeeeee');
  fillNoiseTile(TILE_INDEX.TNT_BOTTOM, '#a62c1e', 14);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (y >= 5 && y <= 10) {
        drawPixel(TILE_INDEX.TNT_SIDE, x, y, '#eeeeee');
      } else {
        drawPixel(TILE_INDEX.TNT_SIDE, x, y, x % 4 === 0 ? '#b2291c' : '#db3927');
      }
    }
  }
  // Write TNT letters in black pixels
  const tntPixels = [
    [2,6],[3,6],[4,6],[3,7],[3,8],[3,9], // T
    [6,6],[6,7],[6,8],[6,9],[7,7],[8,8],[9,6],[9,7],[9,8],[9,9], // N
    [11,6],[12,6],[13,6],[12,7],[12,8],[12,9], // T
  ];
  for (const [px, py] of tntPixels) {
    drawPixel(TILE_INDEX.TNT_SIDE, px, py, '#191919');
  }

  // 27, 28: SNOW_GRASS
  fillNoiseTile(TILE_INDEX.SNOW_TOP, '#f4f9fc', 8);
  fillNoiseTile(TILE_INDEX.SNOW_SIDE, '#866043', 18);
  for (let x = 0; x < 16; x++) {
    const d = 3 + Math.floor(rand() * 2);
    for (let y = 0; y < d; y++) {
      drawPixel(TILE_INDEX.SNOW_SIDE, x, y, '#f4f9fc');
    }
  }

  // 29, 30: BIRCH_LOG
  fillNoiseTile(TILE_INDEX.BIRCH_SIDE, '#dcd8ce', 10);
  for (let i = 0; i < 12; i++) {
    const bx = Math.floor(rand() * 14);
    const by = Math.floor(rand() * 15);
    drawPixel(TILE_INDEX.BIRCH_SIDE, bx, by, '#3b3935');
    drawPixel(TILE_INDEX.BIRCH_SIDE, bx + 1, by, '#3b3935');
  }
  fillNoiseTile(TILE_INDEX.BIRCH_TOP, '#c8b78a', 12);

  // 31: BOOKSHELF
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (y < 2 || y > 13 || y === 7 || y === 8) {
        drawPixel(TILE_INDEX.BOOKSHELF_SIDE, x, y, '#a2824e');
      } else {
        const bookColors = ['#9c2727', '#275a9c', '#2b823a', '#b58d28', '#682b82'];
        const c = bookColors[Math.floor((x + (y > 7 ? 3 : 0)) / 2) % bookColors.length];
        drawPixel(TILE_INDEX.BOOKSHELF_SIDE, x, y, x % 2 === 0 ? c : shadeHex(c, -22));
      }
    }
  }

  // 32: OBSIDIAN
  fillNoiseTile(TILE_INDEX.OBSIDIAN, '#1b1429', 14);
  for (let i = 0; i < 18; i++) {
    drawPixel(TILE_INDEX.OBSIDIAN, Math.floor(rand() * 16), Math.floor(rand() * 16), '#3c2a5c');
  }

  // 33: BEDROCK
  fillNoiseTile(TILE_INDEX.BEDROCK, '#444444', 45);

  // 34: DIAMOND_BLOCK
  fillNoiseTile(TILE_INDEX.DIAMOND_BLOCK, '#62ede6', 14);
  for (let i = 0; i < 16; i++) {
    drawPixel(TILE_INDEX.DIAMOND_BLOCK, i, 0, '#a6fffb');
    drawPixel(TILE_INDEX.DIAMOND_BLOCK, 0, i, '#a6fffb');
    drawPixel(TILE_INDEX.DIAMOND_BLOCK, i, 15, '#34b5ae');
    drawPixel(TILE_INDEX.DIAMOND_BLOCK, 15, i, '#34b5ae');
  }

  // 35: GOLD_BLOCK
  fillNoiseTile(TILE_INDEX.GOLD_BLOCK, '#f9d738', 16);
  for (let i = 0; i < 16; i++) {
    drawPixel(TILE_INDEX.GOLD_BLOCK, i, 0, '#fff59e');
    drawPixel(TILE_INDEX.GOLD_BLOCK, 0, i, '#fff59e');
    drawPixel(TILE_INDEX.GOLD_BLOCK, i, 15, '#c99c18');
    drawPixel(TILE_INDEX.GOLD_BLOCK, 15, i, '#c99c18');
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  // Generate 3D-like isometric or crisp 2D icon data URLs for each block
  const blockIcons: Record<number, string> = {};
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = 48;
  iconCanvas.height = 48;
  const ictx = iconCanvas.getContext('2d')!;
  ictx.imageSmoothingEnabled = false;

  for (const id of Object.keys(BLOCKS).map(Number)) {
    if (id === BlockId.AIR) continue;
    const def = BLOCKS[id];
    const tileIdx = def.iconTile;
    const sx = (tileIdx % ATLAS_COLS) * TILE_SIZE;
    const sy = Math.floor(tileIdx / ATLAS_COLS) * TILE_SIZE;

    ictx.clearRect(0, 0, 48, 48);
    ictx.drawImage(canvas, sx, sy, 16, 16, 0, 0, 48, 48);
    blockIcons[id] = iconCanvas.toDataURL();
  }

  cachedAtlas = { texture, canvas, blockIcons };
  return cachedAtlas;
}
