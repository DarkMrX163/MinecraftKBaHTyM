import * as THREE from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import {
  BlockId,
  BLOCKS,
  ATLAS_COLS,
  ATLAS_ROWS,
} from './textures';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WATER_LEVEL = 14;

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChunkMeshes {
  solidMesh: THREE.Mesh | null;
  transparentMesh: THREE.Mesh | null;
}

// 6 neighbor face definitions
interface FaceDef {
  dir: [number, number, number];
  faceIdx: number; // index into BlockDefinition.faces: 0:+Y, 1:-Y, 2:-Z, 3:+Z, 4:+X, 5:-X
  shade: number; // directional shading multiplier like authentic Minecraft
  corners: {
    pos: [number, number, number];
    uv: [number, number];
    aoDirs: [[number, number, number], [number, number, number], [number, number, number]];
  }[];
}

const FACES: FaceDef[] = [
  // 0: TOP (+Y)
  {
    dir: [0, 1, 0],
    faceIdx: 0,
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 0], aoDirs: [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]] },
      { pos: [1, 1, 1], uv: [1, 0], aoDirs: [[1, 1, 0], [0, 1, 1], [1, 1, 1]] },
      { pos: [1, 1, 0], uv: [1, 1], aoDirs: [[1, 1, 0], [0, 1, -1], [1, 1, -1]] },
      { pos: [0, 1, 0], uv: [0, 1], aoDirs: [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]] },
    ],
  },
  // 1: BOTTOM (-Y)
  {
    dir: [0, -1, 0],
    faceIdx: 1,
    shade: 0.55,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], aoDirs: [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]] },
      { pos: [1, 0, 0], uv: [1, 0], aoDirs: [[1, -1, 0], [0, -1, -1], [1, -1, -1]] },
      { pos: [1, 0, 1], uv: [1, 1], aoDirs: [[1, -1, 0], [0, -1, 1], [1, -1, 1]] },
      { pos: [0, 0, 1], uv: [0, 1], aoDirs: [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]] },
    ],
  },
  // 2: NORTH (-Z)
  {
    dir: [0, 0, -1],
    faceIdx: 2,
    shade: 0.82,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0], aoDirs: [[1, 0, -1], [0, -1, -1], [1, -1, -1]] },
      { pos: [0, 0, 0], uv: [1, 0], aoDirs: [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]] },
      { pos: [0, 1, 0], uv: [1, 1], aoDirs: [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]] },
      { pos: [1, 1, 0], uv: [0, 1], aoDirs: [[1, 0, -1], [0, 1, -1], [1, 1, -1]] },
    ],
  },
  // 3: SOUTH (+Z)
  {
    dir: [0, 0, 1],
    faceIdx: 3,
    shade: 0.82,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0], aoDirs: [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]] },
      { pos: [1, 0, 1], uv: [1, 0], aoDirs: [[1, 0, 1], [0, -1, 1], [1, -1, 1]] },
      { pos: [1, 1, 1], uv: [1, 1], aoDirs: [[1, 0, 1], [0, 1, 1], [1, 1, 1]] },
      { pos: [0, 1, 1], uv: [0, 1], aoDirs: [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]] },
    ],
  },
  // 4: EAST (+X)
  {
    dir: [1, 0, 0],
    faceIdx: 4,
    shade: 0.7,
    corners: [
      { pos: [1, 0, 1], uv: [0, 0], aoDirs: [[1, 0, 1], [1, -1, 0], [1, -1, 1]] },
      { pos: [1, 0, 0], uv: [1, 0], aoDirs: [[1, 0, -1], [1, -1, 0], [1, -1, -1]] },
      { pos: [1, 1, 0], uv: [1, 1], aoDirs: [[1, 0, -1], [1, 1, 0], [1, 1, -1]] },
      { pos: [1, 1, 1], uv: [0, 1], aoDirs: [[1, 0, 1], [1, 1, 0], [1, 1, 1]] },
    ],
  },
  // 5: WEST (-X)
  {
    dir: [-1, 0, 0],
    faceIdx: 5,
    shade: 0.7,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], aoDirs: [[-1, 0, -1], [-1, -1, 0], [-1, -1, -1]] },
      { pos: [0, 0, 1], uv: [1, 0], aoDirs: [[-1, 0, 1], [-1, -1, 0], [-1, -1, 1]] },
      { pos: [0, 1, 1], uv: [1, 1], aoDirs: [[-1, 0, 1], [-1, 1, 0], [-1, 1, 1]] },
      { pos: [0, 1, 0], uv: [0, 1], aoDirs: [[-1, 0, -1], [-1, 1, 0], [-1, 1, -1]] },
    ],
  },
];

export class VoxelWorld {
  public seed: number;
  private noise2D: ReturnType<typeof createNoise2D>;
  private biomeNoise2D: ReturnType<typeof createNoise2D>;
  private caveNoise3D: ReturnType<typeof createNoise3D>;

  public chunks = new Map<string, Uint8Array>();
  public chunkMeshes = new Map<string, ChunkMeshes>();
  public modifiedBlocks = new Map<string, number>();

  private scene: THREE.Scene;
  public solidMaterial: THREE.MeshLambertMaterial;
  public transparentMaterial: THREE.MeshLambertMaterial;

  constructor(scene: THREE.Scene, atlasTexture: THREE.Texture, seed = 42069) {
    this.scene = scene;
    this.seed = seed;
    const prng1 = mulberry32(seed);
    const prng2 = mulberry32(seed + 99991);
    const prng3 = mulberry32(seed + 31337);

    this.noise2D = createNoise2D(prng1);
    this.biomeNoise2D = createNoise2D(prng2);
    this.caveNoise3D = createNoise3D(prng3);

    this.solidMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
    });

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
    });
  }

  public setSeed(newSeed: number) {
    if (this.seed === newSeed && this.chunks.size > 0) return;
    this.seed = newSeed;
    const prng1 = mulberry32(newSeed);
    const prng2 = mulberry32(newSeed + 99991);
    const prng3 = mulberry32(newSeed + 31337);
    this.noise2D = createNoise2D(prng1);
    this.biomeNoise2D = createNoise2D(prng2);
    this.caveNoise3D = createNoise3D(prng3);

    this.clearAllChunks();
  }

  public clearAllChunks() {
    for (const [, meshes] of this.chunkMeshes.entries()) {
      if (meshes.solidMesh) {
        this.scene.remove(meshes.solidMesh);
        meshes.solidMesh.geometry.dispose();
      }
      if (meshes.transparentMesh) {
        this.scene.remove(meshes.transparentMesh);
        meshes.transparentMesh.geometry.dispose();
      }
    }
    this.chunkMeshes.clear();
    this.chunks.clear();
  }

  public getChunkCoord(wx: number, wz: number): [number, number] {
    return [Math.floor(wx / CHUNK_SIZE), Math.floor(wz / CHUNK_SIZE)];
  }

  private getLocalIndex(lx: number, ly: number, lz: number): number {
    return ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
  }

  private hash2D(x: number, z: number): number {
    let n = x * 374761393 + z * 668265263 + this.seed * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  }

  public getTerrainHeight(wx: number, wz: number): { height: number; biome: 'plains' | 'desert' | 'snow' | 'forest' } {
    const bVal = this.biomeNoise2D(wx * 0.008, wz * 0.008);
    let biome: 'plains' | 'desert' | 'snow' | 'forest' = 'plains';
    if (bVal < -0.35) biome = 'desert';
    else if (bVal > 0.38) biome = 'snow';
    else if (bVal > 0.05) biome = 'forest';

    const n1 = this.noise2D(wx * 0.015, wz * 0.015) * 10;
    const n2 = this.noise2D(wx * 0.045, wz * 0.045) * 4;
    const n3 = this.noise2D(wx * 0.1, wz * 0.1) * 1.5;

    let h = Math.floor(17 + n1 + n2 + n3);
    if (biome === 'desert') {
      h = Math.floor(16 + n1 * 0.6 + n2 * 0.5);
    }
    h = Math.max(4, Math.min(CHUNK_HEIGHT - 12, h));
    return { height: h, biome };
  }

  public generateChunkData(cx: number, cz: number): Uint8Array {
    const key = `${cx},${cz}`;
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = startX + lx;
        const wz = startZ + lz;
        const { height, biome } = this.getTerrainHeight(wx, wz);

        for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
          let blockId = BlockId.AIR;

          if (ly === 0) {
            blockId = BlockId.BEDROCK;
          } else if (ly < height - 3) {
            // Check caves
            const cave = this.caveNoise3D(wx * 0.06, ly * 0.08, wz * 0.06);
            if (ly > 3 && cave > 0.66) {
              blockId = BlockId.AIR;
            } else {
              // Ores distribution
              const oreNoise = this.caveNoise3D(wx * 0.22 + 100, ly * 0.22, wz * 0.22);
              if (oreNoise > 0.76 && ly < 12) {
                blockId = BlockId.DIAMOND_ORE;
              } else if (oreNoise > 0.73 && ly < 18) {
                blockId = BlockId.GOLD_ORE;
              } else if (oreNoise > 0.69 && ly < 28) {
                blockId = BlockId.IRON_ORE;
              } else if (oreNoise > 0.65) {
                blockId = BlockId.COAL_ORE;
              } else {
                blockId = BlockId.STONE;
              }
            }
          } else if (ly < height) {
            blockId = biome === 'desert' ? BlockId.SAND : BlockId.DIRT;
          } else if (ly === height) {
            if (ly <= WATER_LEVEL + 1) {
              blockId = BlockId.SAND;
            } else if (biome === 'desert') {
              blockId = BlockId.SAND;
            } else if (biome === 'snow' || ly > 31) {
              blockId = BlockId.SNOW_GRASS;
            } else {
              blockId = BlockId.GRASS;
            }
          } else if (ly <= WATER_LEVEL) {
            blockId = BlockId.WATER;
          }

          data[this.getLocalIndex(lx, ly, lz)] = blockId;
        }
      }
    }

    // Second pass within chunk: deterministic trees (kept inside 2..13 margin so they don't clip across chunks)
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const wx = startX + lx;
        const wz = startZ + lz;
        // Keep spawn area (near 0,0) clear and scenic with a crafting table
        if (Math.abs(wx) < 4 && Math.abs(wz) < 4) continue;

        const { height, biome } = this.getTerrainHeight(wx, wz);
        if (height <= WATER_LEVEL + 1 || biome === 'desert') continue;

        const treeChance = biome === 'forest' ? 0.045 : 0.015;
        const r = this.hash2D(wx, wz);
        if (r < treeChance) {
          const isBirch = biome === 'forest' && r < treeChance * 0.35;
          const trunkBlock = isBirch ? BlockId.BIRCH_LOG : BlockId.OAK_LOG;
          const trunkHeight = 4 + Math.floor(r * 100) % 2;

          for (let ty = 1; ty <= trunkHeight; ty++) {
            if (height + ty < CHUNK_HEIGHT) {
              data[this.getLocalIndex(lx, height + ty, lz)] = trunkBlock;
            }
          }

          // Leaf canopy
          for (let dy = trunkHeight - 1; dy <= trunkHeight + 1; dy++) {
            const radius = dy === trunkHeight + 1 ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dz = -radius; dz <= radius; dz++) {
                if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy === trunkHeight) continue;
                const nlx = lx + dx;
                const nly = height + dy;
                const nlz = lz + dz;
                if (
                  nlx >= 0 &&
                  nlx < CHUNK_SIZE &&
                  nlz >= 0 &&
                  nlz < CHUNK_SIZE &&
                  nly > 0 &&
                  nly < CHUNK_HEIGHT
                ) {
                  const idx = this.getLocalIndex(nlx, nly, nlz);
                  if (data[idx] === BlockId.AIR) {
                    data[idx] = BlockId.OAK_LEAVES;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Place a starter Crafting Table and Furnace right next to spawn (3, height+1, 0)
    if (cx === 0 && cz === 0) {
      const hCraft = this.getTerrainHeight(3, 3).height;
      if (hCraft > WATER_LEVEL) {
        data[this.getLocalIndex(3, hCraft + 1, 3)] = BlockId.CRAFTING_TABLE;
        data[this.getLocalIndex(4, hCraft + 1, 3)] = BlockId.FURNACE;
        data[this.getLocalIndex(3, hCraft + 2, 3)] = BlockId.GLOWSTONE;
      }
    }

    // Apply any multiplayer modified blocks for this chunk
    for (const [mKey, blockId] of this.modifiedBlocks.entries()) {
      const [mx, my, mz] = mKey.split(',').map(Number);
      const [mcx, mcz] = this.getChunkCoord(mx, mz);
      if (mcx === cx && mcz === cz && my >= 0 && my < CHUNK_HEIGHT) {
        const lx = ((mx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((mz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        data[this.getLocalIndex(lx, my, lz)] = blockId;
      }
    }

    this.chunks.set(key, data);
    return data;
  }

  public getBlock(wx: number, wy: number, wz: number): number {
    const bx = Math.floor(wx);
    const by = Math.floor(wy);
    const bz = Math.floor(wz);
    if (by < 0 || by >= CHUNK_HEIGHT) return BlockId.AIR;

    const mKey = `${bx},${by},${bz}`;
    if (this.modifiedBlocks.has(mKey)) {
      return this.modifiedBlocks.get(mKey)!;
    }

    const [cx, cz] = this.getChunkCoord(bx, bz);
    const chunk = this.generateChunkData(cx, cz);
    const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk[this.getLocalIndex(lx, by, lz)];
  }

  public isSolidBlock(wx: number, wy: number, wz: number): boolean {
    const id = this.getBlock(wx, wy, wz);
    if (id === BlockId.AIR || id === BlockId.WATER) return false;
    return true;
  }

  public isOccludingBlock(wx: number, wy: number, wz: number): boolean {
    const id = this.getBlock(wx, wy, wz);
    if (id === BlockId.AIR) return false;
    const def = BLOCKS[id];
    return !def?.transparent;
  }

  public setBlock(wx: number, wy: number, wz: number, blockId: number, rebuild = true) {
    const bx = Math.floor(wx);
    const by = Math.floor(wy);
    const bz = Math.floor(wz);
    if (by < 0 || by >= CHUNK_HEIGHT) return;

    this.modifiedBlocks.set(`${bx},${by},${bz}`, blockId);
    const [cx, cz] = this.getChunkCoord(bx, bz);
    const chunk = this.generateChunkData(cx, cz);
    const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk[this.getLocalIndex(lx, by, lz)] = blockId;

    if (rebuild) {
      this.rebuildChunkMesh(cx, cz);
      if (lx === 0) this.rebuildChunkMesh(cx - 1, cz);
      if (lx === CHUNK_SIZE - 1) this.rebuildChunkMesh(cx + 1, cz);
      if (lz === 0) this.rebuildChunkMesh(cx, cz - 1);
      if (lz === CHUNK_SIZE - 1) this.rebuildChunkMesh(cx, cz + 1);
    }
  }

  public rebuildChunkMesh(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const chunk = this.generateChunkData(cx, cz);

    const existing = this.chunkMeshes.get(key);
    if (existing) {
      if (existing.solidMesh) {
        this.scene.remove(existing.solidMesh);
        existing.solidMesh.geometry.dispose();
      }
      if (existing.transparentMesh) {
        this.scene.remove(existing.transparentMesh);
        existing.transparentMesh.geometry.dispose();
      }
    }

    const solidPositions: number[] = [];
    const solidNormals: number[] = [];
    const solidUvs: number[] = [];
    const solidColors: number[] = [];
    const solidIndices: number[] = [];

    const transPositions: number[] = [];
    const transNormals: number[] = [];
    const transUvs: number[] = [];
    const transColors: number[] = [];
    const transIndices: number[] = [];

    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const blockId = chunk[this.getLocalIndex(lx, ly, lz)];
          if (blockId === BlockId.AIR) continue;

          const def = BLOCKS[blockId];
          if (!def) continue;

          const wx = startX + lx;
          const wy = ly;
          const wz = startZ + lz;

          const isTrans = Boolean(def.transparent);
          const posArr = isTrans ? transPositions : solidPositions;
          const normArr = isTrans ? transNormals : solidNormals;
          const uvArr = isTrans ? transUvs : solidUvs;
          const colArr = isTrans ? transColors : solidColors;
          const idxArr = isTrans ? transIndices : solidIndices;

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = wy + face.dir[1];
            const nz = wz + face.dir[2];

            const neighborId = this.getBlock(nx, ny, nz);
            if (neighborId !== BlockId.AIR) {
              const neighborDef = BLOCKS[neighborId];
              if (!isTrans && !neighborDef?.transparent) {
                continue; // Culled by solid neighbor
              }
              if (isTrans && neighborId === blockId) {
                continue; // Cull internal water/glass faces between identical blocks
              }
            }

            const ndx = posArr.length / 3;
            const tileIdx = def.faces[face.faceIdx];
            const tileCol = tileIdx % ATLAS_COLS;
            const tileRow = Math.floor(tileIdx / ATLAS_COLS);

            // Small UV inset to eliminate texture bleeding at chunk edges
            const eps = 0.0015;
            const u0 = tileCol / ATLAS_COLS + eps;
            const u1 = (tileCol + 1) / ATLAS_COLS - eps;
            const v1 = 1 - tileRow / ATLAS_ROWS - eps;
            const v0 = 1 - (tileRow + 1) / ATLAS_ROWS + eps;

            // Lower top of water block slightly for authentic shoreline look
            const yTopOffset = blockId === BlockId.WATER ? -0.12 : 0;

            for (const corner of face.corners) {
              const py = corner.pos[1] === 1 ? 1 + yTopOffset : 0;
              posArr.push(wx + corner.pos[0], wy + py, wz + corner.pos[2]);
              normArr.push(face.dir[0], face.dir[1], face.dir[2]);

              const u = corner.uv[0] === 0 ? u0 : u1;
              const v = corner.uv[1] === 0 ? v0 : v1;
              uvArr.push(u, v);

              // Vertex Ambient Occlusion (AO)
              let occ = 0;
              if (!isTrans && !def.lightLevel) {
                const [d1, d2, d3] = corner.aoDirs;
                if (this.isOccludingBlock(wx + d1[0], wy + d1[1], wz + d1[2])) occ++;
                if (this.isOccludingBlock(wx + d2[0], wy + d2[1], wz + d2[2])) occ++;
                if (this.isOccludingBlock(wx + d3[0], wy + d3[1], wz + d3[2])) occ++;
              }

              const aoFactor = 1.0 - occ * 0.16;
              const lightBoost = def.lightLevel ? 1.15 : 1.0;
              const c = Math.min(1.0, face.shade * aoFactor * lightBoost);
              colArr.push(c, c, c);
            }

            idxArr.push(ndx, ndx + 1, ndx + 2, ndx, ndx + 2, ndx + 3);
          }
        }
      }
    }

    let solidMesh: THREE.Mesh | null = null;
    if (solidPositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(solidPositions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(solidNormals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(solidUvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(solidColors, 3));
      geo.setIndex(solidIndices);
      geo.computeBoundingSphere();

      solidMesh = new THREE.Mesh(geo, this.solidMaterial);
      this.scene.add(solidMesh);
    }

    let transparentMesh: THREE.Mesh | null = null;
    if (transPositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(transPositions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(transNormals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(transUvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(transColors, 3));
      geo.setIndex(transIndices);
      geo.computeBoundingSphere();

      transparentMesh = new THREE.Mesh(geo, this.transparentMaterial);
      transparentMesh.renderOrder = 2;
      this.scene.add(transparentMesh);
    }

    this.chunkMeshes.set(key, { solidMesh, transparentMesh });
  }

  public updateChunksAroundPlayer(px: number, pz: number, radiusChunks = 2) {
    const [pcx, pcz] = this.getChunkCoord(px, pz);

    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx},${cz}`;
        if (!this.chunkMeshes.has(key)) {
          this.rebuildChunkMesh(cx, cz);
        }
      }
    }

    // Unload distant chunks to save memory and draw calls
    for (const [key, meshes] of this.chunkMeshes.entries()) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > radiusChunks + 1 || Math.abs(cz - pcz) > radiusChunks + 1) {
        if (meshes.solidMesh) {
          this.scene.remove(meshes.solidMesh);
          meshes.solidMesh.geometry.dispose();
        }
        if (meshes.transparentMesh) {
          this.scene.remove(meshes.transparentMesh);
          meshes.transparentMesh.geometry.dispose();
        }
        this.chunkMeshes.delete(key);
      }
    }
  }

  // Fast Amanatides & Woo 3D DDA Voxel Raycast for exact block picking
  public raycastVoxel(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6.5
  ): {
    hitBlock: [number, number, number];
    placeBlock: [number, number, number];
    normal: [number, number, number];
    blockId: number;
  } | null {
    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

    let tMaxX = dx > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
    let tMaxY = dy > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
    let tMaxZ = dz > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;

    let normal: [number, number, number] = [0, 0, 0];
    let dist = 0;

    while (dist <= maxDistance) {
      const blockId = this.getBlock(x, y, z);
      if (blockId !== BlockId.AIR && blockId !== BlockId.WATER) {
        return {
          hitBlock: [x, y, z],
          placeBlock: [x + normal[0], y + normal[1], z + normal[2]],
          normal,
          blockId,
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          dist = tMaxX;
          tMaxX += tDeltaX;
          normal = [-stepX, 0, 0];
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          normal = [0, 0, -stepZ];
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          dist = tMaxY;
          tMaxY += tDeltaY;
          normal = [0, -stepY, 0];
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          normal = [0, 0, -stepZ];
        }
      }
    }

    return null;
  }
}
