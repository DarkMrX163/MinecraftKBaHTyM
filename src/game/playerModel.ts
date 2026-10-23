import * as THREE from 'three';

export interface CharacterSkinPalette {
  id: string;
  name: string;
  skin: string;
  hair: string;
  eyes: string;
  shirt: string;
  pants: string;
  shoes: string;
}

export interface MobWorldCollider {
  isSolidBlock: (x: number, y: number, z: number) => boolean;
}

export const SKIN_PALETTES: Record<string, CharacterSkinPalette> = {
  steve: {
    id: 'steve',
    name: 'Steve (Классика)',
    skin: '#c6906d',
    hair: '#3b2618',
    eyes: '#3b3291',
    shirt: '#00a8b5',
    pants: '#3b378f',
    shoes: '#595959',
  },
  alex: {
    id: 'alex',
    name: 'Alex (Следопыт)',
    skin: '#eac0a2',
    hair: '#c96928',
    eyes: '#2d6e32',
    shirt: '#69993c',
    pants: '#6b5139',
    shoes: '#474747',
  },
  knight: {
    id: 'knight',
    name: 'Рыцарь Незерита',
    skin: '#d9a482',
    hair: '#1f1a24',
    eyes: '#e03e2d',
    shirt: '#4a4452',
    pants: '#2c2830',
    shoes: '#1c1a1f',
  },
  miner: {
    id: 'miner',
    name: 'Золотой Шахтёр',
    skin: '#cfa17e',
    hair: '#4a3219',
    eyes: '#267891',
    shirt: '#d99e26',
    pants: '#3a4b5e',
    shoes: '#3b2b1e',
  },
};

function createPixelCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFaceTexture(palette: CharacterSkinPalette): THREE.CanvasTexture {
  return createPixelCanvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = palette.skin;
    ctx.fillRect(0, 0, 64, 64);

    ctx.fillStyle = palette.hair;
    ctx.fillRect(0, 0, 64, 16);
    ctx.fillRect(0, 16, 8, 8);
    ctx.fillRect(56, 16, 8, 8);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 32, 8, 8);
    ctx.fillRect(48, 32, 8, 8);

    ctx.fillStyle = palette.eyes;
    ctx.fillRect(16, 32, 8, 8);
    ctx.fillRect(40, 32, 8, 8);

    ctx.fillStyle = '#a36e4d';
    ctx.fillRect(24, 40, 16, 6);

    ctx.fillStyle = '#6e4228';
    ctx.fillRect(16, 48, 32, 6);
  });
}

// Authentic 16x16 Minecraft Mob Pixel-Art Textures
function makeZombieFaceTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#527d3b';
    ctx.fillRect(0, 0, 16, 16);
    // Pixel noise
    const patches = [
      [1, 1, '#446b30'], [4, 2, '#629149'], [11, 1, '#446b30'], [13, 4, '#3d612a'],
      [2, 11, '#446b30'], [12, 12, '#629149'], [6, 5, '#446b30'], [9, 13, '#3d612a'],
    ] as const;
    for (const [x, y, c] of patches) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 2, 2);
    }
    // Hollow dark zombie eyes
    ctx.fillStyle = '#1b2b13';
    ctx.fillRect(2, 6, 4, 2);
    ctx.fillRect(10, 6, 4, 2);
    ctx.fillStyle = '#0d1409';
    ctx.fillRect(3, 6, 2, 2);
    ctx.fillRect(11, 6, 2, 2);
    // Nose & dark mouth
    ctx.fillStyle = '#385727';
    ctx.fillRect(7, 8, 2, 2);
    ctx.fillStyle = '#253b19';
    ctx.fillRect(5, 11, 6, 2);
  });
}

function makeCreeperFaceTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    // Speckled green Creeper camouflage
    const greens = ['#50b848', '#429e3b', '#65cc5c', '#368730', '#78db70'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = greens[(x * 7 + y * 13) % greens.length];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Iconic Creeper black eyes & frowning mouth
    ctx.fillStyle = '#0f170e';
    // Left eye (4x4) & Right eye (4x4)
    ctx.fillRect(2, 4, 4, 4);
    ctx.fillRect(10, 4, 4, 4);
    // Nose bridge (4x2)
    ctx.fillRect(6, 8, 4, 2);
    // Mouth body (8x4)
    ctx.fillRect(4, 10, 8, 4);
    // Mouth fangs descending at corners
    ctx.fillRect(4, 14, 2, 2);
    ctx.fillRect(10, 14, 2, 2);
  });
}

function makeCreeperBodyTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    const greens = ['#50b848', '#429e3b', '#65cc5c', '#368730'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = greens[(x * 11 + y * 5) % greens.length];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
}

function makeSkeletonFaceTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#d4d4d0';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b8b8b2';
    ctx.fillRect(0, 0, 16, 3);
    ctx.fillRect(0, 13, 16, 3);
    // Hollow eye sockets
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(2, 5, 4, 3);
    ctx.fillRect(10, 5, 4, 3);
    // Nasal aperture
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(7, 8, 2, 2);
    // Skeletal teeth row
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(3, 11, 10, 2);
    ctx.fillStyle = '#d4d4d0';
    for (let x = 4; x <= 10; x += 2) {
      ctx.fillRect(x, 11, 1, 2);
    }
  });
}

function makeSkeletonRibsTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#d4d4d0';
    // Spine
    ctx.fillRect(7, 0, 2, 16);
    // Collarbone & 3 pairs of ribs
    ctx.fillRect(2, 1, 12, 2);
    ctx.fillRect(3, 5, 10, 2);
    ctx.fillRect(3, 9, 10, 2);
    ctx.fillRect(4, 14, 8, 2);
  });
}

function makeEndermanFaceTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#111014';
    ctx.fillRect(0, 0, 16, 16);
    // Subtle dark ender noise
    ctx.fillStyle = '#1b1822';
    ctx.fillRect(2, 2, 3, 3);
    ctx.fillRect(11, 3, 3, 2);
    ctx.fillRect(5, 12, 6, 2);
    // Glowing purple/magenta Enderman eyes
    ctx.fillStyle = '#f5a6ff';
    ctx.fillRect(1, 7, 5, 2);
    ctx.fillRect(10, 7, 5, 2);
    ctx.fillStyle = '#d500f9';
    ctx.fillRect(3, 7, 2, 2);
    ctx.fillRect(11, 7, 2, 2);
  });
}

function makeSpiderFaceTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#262220';
    ctx.fillRect(0, 0, 16, 16);
    // 8 glowing red spider eyes
    ctx.fillStyle = '#e51c23';
    ctx.fillRect(2, 5, 2, 3);
    ctx.fillRect(5, 6, 2, 2);
    ctx.fillRect(9, 6, 2, 2);
    ctx.fillRect(12, 5, 2, 3);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(3, 3, 2, 2);
    ctx.fillRect(11, 3, 2, 2);
    // Chelicerae / fangs
    ctx.fillStyle = '#141110';
    ctx.fillRect(5, 11, 2, 4);
    ctx.fillRect(9, 11, 2, 4);
  });
}

function makeVillagerFaceTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#bd8b68';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#a87654';
    ctx.fillRect(0, 0, 16, 2);
    // Prominent monobrow
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(3, 5, 10, 2);
    // White sclera + Emerald green eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 7, 3, 2);
    ctx.fillRect(10, 7, 3, 2);
    ctx.fillStyle = '#1db954';
    ctx.fillRect(4, 7, 2, 2);
    ctx.fillRect(10, 7, 2, 2);
    // Mouth line
    ctx.fillStyle = '#7d5238';
    ctx.fillRect(5, 13, 6, 1);
  });
}

function makeAnimalFaceTexture(type: 'sheep' | 'pig' | 'cow'): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    if (type === 'pig') {
      ctx.fillStyle = '#f0a5a8';
      ctx.fillRect(0, 0, 16, 16);
      // Derpy cross-eyed Minecraft eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 6, 2, 2);
      ctx.fillRect(12, 6, 2, 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(1, 6, 1, 2);
      ctx.fillRect(14, 6, 1, 2);
    } else if (type === 'sheep') {
      // Wool border + beige face
      ctx.fillStyle = '#f2f2ed';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#d9c4b0';
      ctx.fillRect(2, 3, 12, 11);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, 6, 2, 2);
      ctx.fillRect(11, 6, 2, 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(2, 6, 1, 2);
      ctx.fillRect(13, 6, 1, 2);
      ctx.fillStyle = '#b5927f';
      ctx.fillRect(6, 11, 4, 2);
    } else {
      // Cow
      ctx.fillStyle = '#473628';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#d6d2c9';
      ctx.fillRect(5, 2, 6, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 6, 2, 2);
      ctx.fillRect(12, 6, 2, 2);
      ctx.fillStyle = '#111111';
      ctx.fillRect(1, 6, 1, 2);
      ctx.fillRect(14, 6, 1, 2);
      // Cow muzzle
      ctx.fillStyle = '#e8b5b8';
      ctx.fillRect(3, 10, 10, 5);
      ctx.fillStyle = '#332222';
      ctx.fillRect(4, 12, 2, 2);
      ctx.fillRect(10, 12, 2, 2);
    }
  });
}

// 3D AABB collision & step-up physics for all mobs and monsters so they never clip through blocks/walls/houses
function checkEntityCollision(
  world: MobWorldCollider,
  px: number,
  py: number,
  pz: number,
  radius: number,
  height: number
): boolean {
  const minX = Math.floor(px - radius);
  const maxX = Math.floor(px + radius);
  const minY = Math.floor(py + 0.02);
  const maxY = Math.floor(py + height - 0.05);
  const minZ = Math.floor(pz - radius);
  const maxZ = Math.floor(pz + radius);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (world.isSolidBlock(x, y, z)) {
          return true;
        }
      }
    }
  }
  return false;
}

function moveMobWithCollision(
  world: MobWorldCollider,
  pos: THREE.Vector3,
  vx: number,
  vz: number,
  vy: number,
  delta: number,
  radius: number,
  height: number
): { nextVy: number; blockedHoriz: boolean; onGround: boolean } {
  let blockedHoriz = false;

  // 1. Resolve X movement (with 1-block auto step-up like Minecraft mobs)
  const targetX = pos.x + vx * delta;
  if (!checkEntityCollision(world, targetX, pos.y, pos.z, radius, height)) {
    pos.x = targetX;
  } else if (
    checkEntityCollision(world, pos.x, pos.y - 0.08, pos.z, radius, height) &&
    !checkEntityCollision(world, targetX, pos.y + 1.05, pos.z, radius, height)
  ) {
    pos.x = targetX;
    pos.y = Math.floor(pos.y) + 1.02;
  } else {
    blockedHoriz = true;
  }

  // 2. Resolve Z movement (with 1-block auto step-up)
  const targetZ = pos.z + vz * delta;
  if (!checkEntityCollision(world, pos.x, pos.y, targetZ, radius, height)) {
    pos.z = targetZ;
  } else if (
    checkEntityCollision(world, pos.x, pos.y - 0.08, pos.z, radius, height) &&
    !checkEntityCollision(world, pos.x, pos.y + 1.05, targetZ, radius, height)
  ) {
    pos.z = targetZ;
    pos.y = Math.floor(pos.y) + 1.02;
  } else {
    blockedHoriz = true;
  }

  // 3. Resolve Y gravity & floor support
  let nextVy = Math.max(-28, vy - 24 * delta);
  const targetY = pos.y + nextVy * delta;
  let onGround = false;

  if (!checkEntityCollision(world, pos.x, targetY, pos.z, radius, height)) {
    pos.y = targetY;
  } else {
    if (nextVy < 0) {
      onGround = true;
      pos.y = Math.floor(pos.y + 0.05);
    }
    nextVy = 0;
  }

  // Push out if ever spawned or nudged inside a block
  if (checkEntityCollision(world, pos.x, pos.y, pos.z, radius, height)) {
    for (let lift = 1; lift <= 4; lift++) {
      if (!checkEntityCollision(world, pos.x, Math.floor(pos.y) + lift, pos.z, radius, height)) {
        pos.y = Math.floor(pos.y) + lift;
        break;
      }
    }
  }

  return { nextVy, blockedHoriz, onGround };
}

function drawNameplateCanvas(
  canvas: HTMLCanvasElement,
  name: string,
  deviceType: 'desktop' | 'mobile',
  accentColor = '#ffffff'
) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(8, 10, 240, 44);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 10, 240, 44);

  ctx.font = 'bold 21px "JetBrains Mono", monospace';
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const suffix = deviceType === 'mobile' ? ' [Touch]' : '';
  const label = `${name}${suffix}`;
  ctx.fillText(label.slice(0, 22), 128, 32);
}

function makeNameplateSprite(
  name: string,
  deviceType: 'desktop' | 'mobile',
  accentColor = '#ffffff'
): { sprite: THREE.Sprite; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  drawNameplateCanvas(canvas, name, deviceType, accentColor);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.75, 0.44, 1);
  sprite.position.set(0, 2.2, 0);
  sprite.renderOrder = 10;
  return { sprite, canvas, texture: tex };
}

export class VoxelCharacterModel {
  public group: THREE.Group;
  public headPivot: THREE.Group;
  public torso: THREE.Mesh;
  public leftArmPivot: THREE.Group;
  public rightArmPivot: THREE.Group;
  public leftLegPivot: THREE.Group;
  public rightLegPivot: THREE.Group;
  public heldItemMesh: THREE.Mesh;

  public targetPos = new THREE.Vector3();
  public targetYaw = 0;
  public targetPitch = 0;
  public walkPhase = 0;
  public swingTimer = 0;
  public skinId: string;
  public playerName: string;
  public deviceType: 'desktop' | 'mobile';

  private nameplateCanvas?: HTMLCanvasElement;
  private nameplateTexture?: THREE.CanvasTexture;

  constructor(
    name: string,
    skinId = 'steve',
    deviceType: 'desktop' | 'mobile' = 'desktop',
    showNameplate = true
  ) {
    this.skinId = skinId;
    this.playerName = name;
    this.deviceType = deviceType;
    const palette = SKIN_PALETTES[skinId] || SKIN_PALETTES.steve;

    this.group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.85, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: 0.9, metalness: 0.02 });
    const faceTex = makeFaceTexture(palette);
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8, metalness: 0.05 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: palette.shirt, roughness: 0.75, metalness: 0.1 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: palette.pants, roughness: 0.8, metalness: 0.08 });
    const shoesMat = new THREE.MeshStandardMaterial({ color: palette.shoes, roughness: 0.6, metalness: 0.2 });

    // 1. Head
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.4, 0);
    const headGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
    const headMaterials = [
      skinMat,
      skinMat,
      hairMat,
      skinMat,
      hairMat,
      faceMat,
    ];
    const headMesh = new THREE.Mesh(headGeo, headMaterials);
    headMesh.position.set(0, 0.23, 0);
    headMesh.castShadow = true;
    this.headPivot.add(headMesh);
    this.group.add(this.headPivot);

    // 2. Torso
    const torsoGeo = new THREE.BoxGeometry(0.46, 0.68, 0.24);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.set(0, 1.06, 0);
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 3. Left Arm
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.34, 1.36, 0);
    const armGeo = new THREE.BoxGeometry(0.22, 0.68, 0.22);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(0, -0.28, 0);
    leftArm.castShadow = true;
    this.leftArmPivot.add(leftArm);
    this.group.add(this.leftArmPivot);

    // 4. Right Arm + Held Block
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.34, 1.36, 0);
    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0, -0.28, 0);
    rightArm.castShadow = true;
    this.rightArmPivot.add(rightArm);

    const heldGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const heldMat = new THREE.MeshStandardMaterial({ color: '#5da632', roughness: 0.7 });
    this.heldItemMesh = new THREE.Mesh(heldGeo, heldMat);
    this.heldItemMesh.position.set(0, -0.55, -0.18);
    this.heldItemMesh.rotation.set(0.3, 0.6, 0.2);
    this.rightArmPivot.add(this.heldItemMesh);
    this.group.add(this.rightArmPivot);

    // 5. Left Leg
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.12, 0.72, 0);
    const legGeo = new THREE.BoxGeometry(0.22, 0.58, 0.22);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(0, -0.29, 0);
    const shoeGeo = new THREE.BoxGeometry(0.23, 0.14, 0.25);
    const leftShoe = new THREE.Mesh(shoeGeo, shoesMat);
    leftShoe.position.set(0, -0.65, -0.01);
    this.leftLegPivot.add(leftLeg, leftShoe);
    this.group.add(this.leftLegPivot);

    // 6. Right Leg
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.12, 0.72, 0);
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0, -0.29, 0);
    const rightShoe = new THREE.Mesh(shoeGeo, shoesMat);
    rightShoe.position.set(0, -0.65, -0.01);
    this.rightLegPivot.add(rightLeg, rightShoe);
    this.group.add(this.rightLegPivot);

    if (showNameplate) {
      const np = makeNameplateSprite(name, deviceType, '#ffffff');
      this.nameplateCanvas = np.canvas;
      this.nameplateTexture = np.texture;
      this.group.add(np.sprite);
    }
  }

  public setName(newName: string, deviceType: 'desktop' | 'mobile' = this.deviceType) {
    if (this.playerName === newName && this.deviceType === deviceType) return;
    this.playerName = newName;
    this.deviceType = deviceType;
    if (this.nameplateCanvas && this.nameplateTexture) {
      drawNameplateCanvas(this.nameplateCanvas, newName, deviceType, '#ffffff');
      this.nameplateTexture.needsUpdate = true;
    }
  }

  public triggerSwing() {
    this.swingTimer = 0.28;
  }

  public update(delta: number, isMoving: boolean, sneaking = false) {
    this.group.position.lerp(this.targetPos, Math.min(1, delta * 14));

    let diff = this.targetYaw - this.group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, delta * 14);

    this.headPivot.rotation.x = THREE.MathUtils.lerp(
      this.headPivot.rotation.x,
      this.targetPitch,
      Math.min(1, delta * 14)
    );

    this.torso.rotation.x = sneaking ? -0.25 : 0;
    this.headPivot.position.y = sneaking ? 1.28 : 1.4;

    if (isMoving) {
      this.walkPhase += delta * 10;
      const swing = Math.sin(this.walkPhase) * 0.65;
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftArmPivot.rotation.x = -swing * 0.8;
      if (this.swingTimer <= 0) {
        this.rightArmPivot.rotation.x = swing * 0.8 - 0.25;
      }
    } else {
      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0, delta * 10);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0, delta * 10);
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, 0, delta * 10);
      if (this.swingTimer <= 0) {
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -0.25, delta * 10);
      }
    }

    if (this.swingTimer > 0) {
      this.swingTimer -= delta;
      const p = (0.28 - this.swingTimer) / 0.28;
      this.rightArmPivot.rotation.x = -0.3 - Math.sin(p * Math.PI) * 1.35;
      this.rightArmPivot.rotation.z = Math.sin(p * Math.PI) * 0.25;
    } else {
      this.rightArmPivot.rotation.z = 0;
    }
  }

  public dispose() {
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
      }
    });
  }
}

export class VillagerMobModel {
  public group: THREE.Group;
  public head: THREE.Mesh;
  public leftLeg: THREE.Mesh;
  public rightLeg: THREE.Mesh;
  public position = new THREE.Vector3();
  public velocityY = 0;
  public homeCenter = new THREE.Vector2();
  public yaw = 0;
  public walkPhase = 0;
  public aiTimer = 0;
  public moving = false;
  public professionName: string;

  constructor(professionName: string, robeColor: string, x: number, y: number, z: number) {
    this.professionName = professionName;
    this.position.set(x, y, z);
    this.homeCenter.set(x, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const skinMat = new THREE.MeshStandardMaterial({ color: '#bd8b68', roughness: 0.85 });
    const faceTex = makeVillagerFaceTexture();
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 });
    const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 });
    const apronMat = new THREE.MeshStandardMaterial({ color: '#5c4028', roughness: 0.9 });

    // Authentic Tall Villager Head (8x10x8 proportions) with pixel-art face & 3D nose
    const headGeo = new THREE.BoxGeometry(0.48, 0.58, 0.48);
    const headMaterials = [skinMat, skinMat, skinMat, skinMat, skinMat, faceMat];
    this.head = new THREE.Mesh(headGeo, headMaterials);
    this.head.position.set(0, 1.56, 0);

    // Prominent 3D Villager Nose
    const noseGeo = new THREE.BoxGeometry(0.12, 0.22, 0.12);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, -0.08, -0.28);
    this.head.add(nose);

    this.group.add(this.head);

    // Robe Coat Torso
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.84, 0.34);
    const body = new THREE.Mesh(bodyGeo, robeMat);
    body.position.set(0, 0.9, 0);
    this.group.add(body);

    // Folded Arms across chest (iconic Minecraft Villager pose)
    const armsGeo = new THREE.BoxGeometry(0.56, 0.24, 0.28);
    const arms = new THREE.Mesh(armsGeo, apronMat);
    arms.position.set(0, 1.0, -0.15);
    arms.rotation.x = -0.35;
    this.group.add(arms);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.21, 0.52, 0.21);
    this.leftLeg = new THREE.Mesh(legGeo, apronMat);
    this.leftLeg.position.set(-0.12, 0.26, 0);
    this.rightLeg = new THREE.Mesh(legGeo, apronMat);
    this.rightLeg.position.set(0.12, 0.26, 0);
    this.group.add(this.leftLeg, this.rightLeg);
    // Note: No overhead nameplate sprite on Villagers as requested!
  }

  public update(delta: number, playerPos: THREE.Vector3, world: MobWorldCollider) {
    this.aiTimer -= delta;
    const distToPlayerSq = this.position.distanceToSquared(playerPos);

    if (distToPlayerSq < 20) {
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      this.yaw = Math.atan2(-dx, -dz);
      this.moving = false;
    } else if (this.aiTimer <= 0) {
      this.aiTimer = 2.0 + Math.random() * 3.5;
      this.moving = Math.random() > 0.35;
      if (this.moving) {
        const distFromHome = Math.hypot(
          this.position.x - this.homeCenter.x,
          this.position.z - this.homeCenter.y
        );
        if (distFromHome > 11) {
          this.yaw = Math.atan2(
            -(this.homeCenter.x - this.position.x),
            -(this.homeCenter.y - this.position.z)
          );
        } else {
          this.yaw = Math.random() * Math.PI * 2;
        }
      }
    }

    const speed = this.moving ? 1.35 : 0;
    const vx = -Math.sin(this.yaw) * speed;
    const vz = -Math.cos(this.yaw) * speed;

    const res = moveMobWithCollision(
      world,
      this.position,
      vx,
      vz,
      this.velocityY,
      delta,
      0.3,
      1.8
    );
    this.velocityY = res.nextVy;

    if (res.blockedHoriz) {
      this.yaw += Math.PI * (0.55 + Math.random() * 0.5);
    }

    if (this.moving && !res.blockedHoriz) {
      this.walkPhase += delta * 8;
      const swing = Math.sin(this.walkPhase) * 0.45;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }
}

export type HostileMobKind = 'zombie' | 'creeper' | 'skeleton' | 'enderman' | 'spider';

export class HostileMobModel {
  public group: THREE.Group;
  public legs: THREE.Object3D[] = [];
  public arms: THREE.Object3D[] = [];
  public flashMaterials: THREE.MeshStandardMaterial[] = [];
  public position = new THREE.Vector3();
  public velocityY = 0;
  public yaw = 0;
  public walkPhase = 0;
  public kind: HostileMobKind;
  public health: number;
  public maxHealth: number;
  public hitFlashTimer = 0;
  public attackCooldown = 0;
  public provokedTimer = 0;
  public aiTimer = 0;
  public isWandering = false;
  public wanderYaw = 0;
  public colliderRadius = 0.32;
  public colliderHeight = 1.8;

  constructor(kind: HostileMobKind, x: number, y: number, z: number) {
    this.kind = kind;
    this.position.set(x, y, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const registerMat = (mat: THREE.MeshStandardMaterial) => {
      this.flashMaterials.push(mat);
      return mat;
    };

    if (kind === 'zombie') {
      this.health = 4;
      this.maxHealth = 4;
      this.colliderRadius = 0.3;
      this.colliderHeight = 1.8;

      const skinMat = registerMat(new THREE.MeshStandardMaterial({ color: '#527d3b', roughness: 0.85 }));
      const faceMat = registerMat(new THREE.MeshStandardMaterial({ map: makeZombieFaceTexture(), roughness: 0.8 }));
      const shirtMat = registerMat(new THREE.MeshStandardMaterial({ color: '#0098a6', roughness: 0.85 }));
      const pantsMat = registerMat(new THREE.MeshStandardMaterial({ color: '#3b3482', roughness: 0.85 }));

      const headGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
      const head = new THREE.Mesh(headGeo, [skinMat, skinMat, skinMat, skinMat, skinMat, faceMat]);
      head.position.set(0, 1.56, 0);
      this.group.add(head);

      const bodyGeo = new THREE.BoxGeometry(0.48, 0.7, 0.24);
      const body = new THREE.Mesh(bodyGeo, shirtMat);
      body.position.set(0, 0.97, 0);
      this.group.add(body);

      // Raised horizontal Zombie arms
      const armGeo = new THREE.BoxGeometry(0.22, 0.66, 0.22);
      const leftArmPivot = new THREE.Group();
      leftArmPivot.position.set(-0.35, 1.28, 0);
      const leftArm = new THREE.Mesh(armGeo, skinMat);
      leftArm.position.set(0, -0.24, 0);
      leftArmPivot.add(leftArm);
      leftArmPivot.rotation.x = -Math.PI / 2.1;

      const rightArmPivot = new THREE.Group();
      rightArmPivot.position.set(0.35, 1.28, 0);
      const rightArm = new THREE.Mesh(armGeo, skinMat);
      rightArm.position.set(0, -0.24, 0);
      rightArmPivot.add(rightArm);
      rightArmPivot.rotation.x = -Math.PI / 2.1;

      this.arms.push(leftArmPivot, rightArmPivot);
      this.group.add(leftArmPivot, rightArmPivot);

      const legGeo = new THREE.BoxGeometry(0.22, 0.62, 0.22);
      const leftLeg = new THREE.Mesh(legGeo, pantsMat);
      leftLeg.position.set(-0.12, 0.31, 0);
      const rightLeg = new THREE.Mesh(legGeo, pantsMat);
      rightLeg.position.set(0.12, 0.31, 0);
      this.legs.push(leftLeg, rightLeg);
      this.group.add(leftLeg, rightLeg);
    } else if (kind === 'creeper') {
      // Authentic Minecraft Creeper: 8x8x8 head, vertical speckled body, NO arms, 4 short legs at front & back!
      this.health = 3;
      this.maxHealth = 3;
      this.colliderRadius = 0.3;
      this.colliderHeight = 1.65;

      const bodyTex = makeCreeperBodyTexture();
      const faceTex = makeCreeperFaceTexture();
      const bodyMat = registerMat(new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.85 }));
      const faceMat = registerMat(new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }));

      const headGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
      const head = new THREE.Mesh(headGeo, [bodyMat, bodyMat, bodyMat, bodyMat, bodyMat, faceMat]);
      head.position.set(0, 1.38, 0);
      this.group.add(head);

      const torsoGeo = new THREE.BoxGeometry(0.46, 0.72, 0.26);
      const torso = new THREE.Mesh(torsoGeo, bodyMat);
      torso.position.set(0, 0.78, 0);
      this.group.add(torso);

      const legGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);
      const legCoords = [
        [-0.14, 0.21, -0.22], // Front-left
        [0.14, 0.21, -0.22],  // Front-right
        [-0.14, 0.21, 0.22],  // Back-left
        [0.14, 0.21, 0.22],   // Back-right
      ];
      for (const [lx, ly, lz] of legCoords) {
        const leg = new THREE.Mesh(legGeo, bodyMat);
        leg.position.set(lx, ly, lz);
        this.legs.push(leg);
        this.group.add(leg);
      }
    } else if (kind === 'skeleton') {
      // Authentic Minecraft Skeleton: Skull face, ribcage torso, thin 2px bone limbs, holding a Bow!
      this.health = 3;
      this.maxHealth = 3;
      this.colliderRadius = 0.3;
      this.colliderHeight = 1.8;

      const boneMat = registerMat(new THREE.MeshStandardMaterial({ color: '#d4d4d0', roughness: 0.8 }));
      const skullFaceMat = registerMat(new THREE.MeshStandardMaterial({ map: makeSkeletonFaceTexture(), roughness: 0.8 }));
      const ribsMat = registerMat(new THREE.MeshStandardMaterial({ map: makeSkeletonRibsTexture(), roughness: 0.85 }));
      const woodMat = new THREE.MeshStandardMaterial({ color: '#78512a', roughness: 0.85 });
      const stringMat = new THREE.MeshBasicMaterial({ color: '#e5e5e5' });

      const headGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
      const head = new THREE.Mesh(headGeo, [boneMat, boneMat, boneMat, boneMat, boneMat, skullFaceMat]);
      head.position.set(0, 1.56, 0);
      this.group.add(head);

      const bodyGeo = new THREE.BoxGeometry(0.44, 0.68, 0.22);
      const body = new THREE.Mesh(bodyGeo, ribsMat);
      body.position.set(0, 0.99, 0);
      this.group.add(body);

      // Thin skeletal arms (0.11 width)
      const thinArmGeo = new THREE.BoxGeometry(0.11, 0.68, 0.11);
      const leftArmPivot = new THREE.Group();
      leftArmPivot.position.set(-0.29, 1.3, 0);
      const leftArm = new THREE.Mesh(thinArmGeo, boneMat);
      leftArm.position.set(0, -0.28, 0);
      leftArmPivot.add(leftArm);
      leftArmPivot.rotation.x = -Math.PI / 3;

      const rightArmPivot = new THREE.Group();
      rightArmPivot.position.set(0.29, 1.3, 0);
      const rightArm = new THREE.Mesh(thinArmGeo, boneMat);
      rightArm.position.set(0, -0.28, 0);
      rightArmPivot.add(rightArm);
      rightArmPivot.rotation.x = -Math.PI / 2.2;

      // Voxel Bow held in Skeleton's right hand
      const bowGroup = new THREE.Group();
      const bowArc = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.08), woodMat);
      const bowString = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), stringMat);
      bowString.position.set(0, 0, 0.08);
      bowGroup.add(bowArc, bowString);
      bowGroup.position.set(0, -0.56, -0.1);
      bowGroup.rotation.x = Math.PI / 2;
      rightArmPivot.add(bowGroup);

      this.arms.push(leftArmPivot, rightArmPivot);
      this.group.add(leftArmPivot, rightArmPivot);

      // Thin skeletal legs
      const thinLegGeo = new THREE.BoxGeometry(0.11, 0.65, 0.11);
      const leftLeg = new THREE.Mesh(thinLegGeo, boneMat);
      leftLeg.position.set(-0.12, 0.32, 0);
      const rightLeg = new THREE.Mesh(thinLegGeo, boneMat);
      rightLeg.position.set(0.12, 0.32, 0);
      this.legs.push(leftLeg, rightLeg);
      this.group.add(leftLeg, rightLeg);
    } else if (kind === 'enderman') {
      // Authentic Tall Slender Enderman (~2.65 blocks tall, glowing purple eyes, long thin arms & legs)
      this.health = 5;
      this.maxHealth = 5;
      this.colliderRadius = 0.3;
      this.colliderHeight = 2.65;

      const enderMat = registerMat(new THREE.MeshStandardMaterial({ color: '#121016', roughness: 0.9 }));
      const enderFaceMat = registerMat(
        new THREE.MeshStandardMaterial({
          map: makeEndermanFaceTexture(),
          roughness: 0.6,
          emissive: new THREE.Color('#4a0072'),
          emissiveIntensity: 0.45,
        })
      );

      const headGeo = new THREE.BoxGeometry(0.44, 0.44, 0.44);
      const head = new THREE.Mesh(headGeo, [enderMat, enderMat, enderMat, enderMat, enderMat, enderFaceMat]);
      head.position.set(0, 2.38, 0);
      this.group.add(head);

      const bodyGeo = new THREE.BoxGeometry(0.42, 0.68, 0.22);
      const body = new THREE.Mesh(bodyGeo, enderMat);
      body.position.set(0, 1.82, 0);
      this.group.add(body);

      const longArmGeo = new THREE.BoxGeometry(0.1, 1.35, 0.1);
      const leftArm = new THREE.Mesh(longArmGeo, enderMat);
      leftArm.position.set(-0.28, 1.48, 0);
      const rightArm = new THREE.Mesh(longArmGeo, enderMat);
      rightArm.position.set(0.28, 1.48, 0);
      this.arms.push(leftArm, rightArm);
      this.group.add(leftArm, rightArm);

      const longLegGeo = new THREE.BoxGeometry(0.1, 1.48, 0.1);
      const leftLeg = new THREE.Mesh(longLegGeo, enderMat);
      leftLeg.position.set(-0.11, 0.74, 0);
      const rightLeg = new THREE.Mesh(longLegGeo, enderMat);
      rightLeg.position.set(0.11, 0.74, 0);
      this.legs.push(leftLeg, rightLeg);
      this.group.add(leftLeg, rightLeg);
    } else {
      // Authentic Spider: Wide body, cephalothorax, 8 red eyes, and 8 articulated legs!
      this.health = 3;
      this.maxHealth = 3;
      this.colliderRadius = 0.42;
      this.colliderHeight = 0.95;

      const spiderMat = registerMat(new THREE.MeshStandardMaterial({ color: '#262220', roughness: 0.85 }));
      const spiderFaceMat = registerMat(
        new THREE.MeshStandardMaterial({
          map: makeSpiderFaceTexture(),
          roughness: 0.6,
          emissive: new THREE.Color('#660000'),
          emissiveIntensity: 0.4,
        })
      );

      // Head
      const headGeo = new THREE.BoxGeometry(0.38, 0.34, 0.38);
      const head = new THREE.Mesh(headGeo, [spiderMat, spiderMat, spiderMat, spiderMat, spiderMat, spiderFaceMat]);
      head.position.set(0, 0.42, -0.42);
      this.group.add(head);

      // Thorax
      const neckGeo = new THREE.BoxGeometry(0.3, 0.28, 0.3);
      const neck = new THREE.Mesh(neckGeo, spiderMat);
      neck.position.set(0, 0.4, -0.1);
      this.group.add(neck);

      // Large Abdomen
      const abdGeo = new THREE.BoxGeometry(0.52, 0.42, 0.62);
      const abdomen = new THREE.Mesh(abdGeo, spiderMat);
      abdomen.position.set(0, 0.46, 0.34);
      this.group.add(abdomen);

      // 8 Jointed Spider Legs
      const legGeo = new THREE.BoxGeometry(0.56, 0.09, 0.09);
      const zOffsets = [-0.28, -0.1, 0.08, 0.26];
      for (let i = 0; i < 4; i++) {
        const leftLeg = new THREE.Mesh(legGeo, spiderMat);
        leftLeg.position.set(-0.38, 0.28, zOffsets[i]);
        leftLeg.rotation.z = 0.45;
        const rightLeg = new THREE.Mesh(legGeo, spiderMat);
        rightLeg.position.set(0.38, 0.28, zOffsets[i]);
        rightLeg.rotation.z = -0.45;
        this.legs.push(leftLeg, rightLeg);
        this.group.add(leftLeg, rightLeg);
      }
    }
  }

  public takeDamage(amount = 1, knockbackDir?: THREE.Vector3, world?: MobWorldCollider): boolean {
    this.health = Math.max(0, this.health - amount);
    this.hitFlashTimer = 0.25;
    this.provokedTimer = 20.0; // Provoke mob to chase attacker
    for (const mat of this.flashMaterials) {
      mat.emissive.setHex(0xcc2222);
    }

    if (knockbackDir && world) {
      moveMobWithCollision(
        world,
        this.position,
        knockbackDir.x * 8,
        knockbackDir.z * 8,
        4.0,
        0.08,
        this.colliderRadius,
        this.colliderHeight
      );
      this.velocityY = 3.5;
    }

    return this.health <= 0;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    world: MobWorldCollider,
    onAttackPlayer: (dmg: number) => void
  ) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        for (const mat of this.flashMaterials) {
          mat.emissive.setHex(0x000000);
        }
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }

    if (this.provokedTimer > 0) {
      this.provokedTimer -= delta;
    }

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distSq = dx * dx + dz * dz;

    let vx = 0;
    let vz = 0;
    let isMoving = false;

    // Detection Radius: 16 blocks (16^2 = 256) or when provoked by attack
    if (distSq <= 256 || this.provokedTimer > 0) {
      // Aggro / Chase player within 16 blocks
      this.yaw = Math.atan2(-dx, -dz);
      const speed =
        this.kind === 'spider'
          ? 3.1
          : this.kind === 'enderman'
          ? 3.2
          : this.kind === 'creeper'
          ? 2.45
          : 2.3;

      if (distSq > 1.45) {
        vx = -Math.sin(this.yaw) * speed;
        vz = -Math.cos(this.yaw) * speed;
        isMoving = true;
      } else if (this.attackCooldown <= 0 && Math.abs(playerPos.y - this.position.y) < 2.4) {
        this.attackCooldown = 1.25;
        onAttackPlayer(this.kind === 'enderman' || this.kind === 'creeper' ? 3 : 2);
      }
    } else {
      // Natural Minecraft Idle Wandering (when > 16 blocks away)
      this.aiTimer -= delta;
      if (this.aiTimer <= 0) {
        this.aiTimer = 2.5 + Math.random() * 4.5;
        this.isWandering = Math.random() > 0.45;
        if (this.isWandering) {
          this.wanderYaw = Math.random() * Math.PI * 2;
        }
      }

      if (this.isWandering) {
        this.yaw = THREE.MathUtils.lerp(this.yaw, this.wanderYaw, delta * 4);
        const wanderSpeed = 1.15;
        vx = -Math.sin(this.yaw) * wanderSpeed;
        vz = -Math.cos(this.yaw) * wanderSpeed;
        isMoving = true;
      }
    }

    const res = moveMobWithCollision(
      world,
      this.position,
      vx,
      vz,
      this.velocityY,
      delta,
      this.colliderRadius,
      this.colliderHeight
    );
    this.velocityY = res.nextVy;

    if (res.blockedHoriz && this.isWandering) {
      this.wanderYaw += Math.PI * (0.6 + Math.random() * 0.4);
    }

    if (isMoving && (distSq > 1.45 || !this.isWandering)) {
      this.walkPhase += delta * 10;
      const swing = Math.sin(this.walkPhase) * 0.55;
      if (this.kind === 'creeper') {
        this.legs[0].rotation.x = swing;
        this.legs[1].rotation.x = -swing;
        this.legs[2].rotation.x = -swing;
        this.legs[3].rotation.x = swing;
      } else if (this.kind === 'spider') {
        for (let i = 0; i < this.legs.length; i++) {
          this.legs[i].rotation.y = Math.sin(this.walkPhase * 1.4 + i) * 0.35;
        }
      } else {
        if (this.legs[0]) this.legs[0].rotation.x = swing;
        if (this.legs[1]) this.legs[1].rotation.x = -swing;
      }
    } else {
      for (const leg of this.legs) {
        if (this.kind === 'spider') {
          leg.rotation.y = THREE.MathUtils.lerp(leg.rotation.y, 0, delta * 8);
        } else {
          leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, 0, delta * 8);
        }
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }
}

export class PassiveMobModel {
  public group: THREE.Group;
  public legs: THREE.Mesh[] = [];
  public head: THREE.Mesh;
  public position = new THREE.Vector3();
  public velocityY = 0;
  public yaw = 0;
  public walkPhase = 0;
  public aiTimer = 0;
  public moving = false;
  public type: 'sheep' | 'pig' | 'cow';

  constructor(type: 'sheep' | 'pig' | 'cow', x: number, y: number, z: number) {
    this.type = type;
    this.position.set(x, y, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const bodyColor =
      type === 'sheep' ? '#f2f2ed' : type === 'pig' ? '#f0a5a8' : '#4a3828';
    const skinColor =
      type === 'sheep' ? '#d9c4b0' : type === 'pig' ? '#f0a5a8' : '#4a3828';

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.9, metalness: 0.02 });
    const headSideMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85 });
    const faceMat = new THREE.MeshStandardMaterial({
      map: makeAnimalFaceTexture(type),
      roughness: 0.8,
    });

    // Body
    const bodyGeo = new THREE.BoxGeometry(
      type === 'cow' ? 0.72 : 0.65,
      type === 'cow' ? 0.65 : 0.55,
      0.95
    );
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, type === 'cow' ? 0.75 : 0.65, 0);
    this.group.add(body);

    // Head with authentic pixel-art front face
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    this.head = new THREE.Mesh(headGeo, [
      headSideMat,
      headSideMat,
      headSideMat,
      headSideMat,
      headSideMat,
      faceMat,
    ]);
    this.head.position.set(0, type === 'cow' ? 0.95 : 0.85, -0.55);

    if (type === 'pig') {
      const snoutGeo = new THREE.BoxGeometry(0.22, 0.16, 0.1);
      const snout = new THREE.Mesh(snoutGeo, headSideMat);
      snout.position.set(0, -0.06, -0.25);
      this.head.add(snout);
    } else if (type === 'cow') {
      const hornMat = new THREE.MeshStandardMaterial({ color: '#d4cfc4', roughness: 0.7 });
      const hornGeo = new THREE.BoxGeometry(0.07, 0.16, 0.07);
      const leftHorn = new THREE.Mesh(hornGeo, hornMat);
      leftHorn.position.set(-0.24, 0.22, -0.1);
      const rightHorn = new THREE.Mesh(hornGeo, hornMat);
      rightHorn.position.set(0.24, 0.22, -0.1);
      this.head.add(leftHorn, rightHorn);
    }

    this.group.add(this.head);

    // 4 Legs
    const legH = type === 'cow' ? 0.52 : 0.42;
    const legGeo = new THREE.BoxGeometry(0.18, legH, 0.18);
    const legOffsets = [
      [-0.2, legH / 2, -0.32],
      [0.2, legH / 2, -0.32],
      [-0.2, legH / 2, 0.32],
      [0.2, legH / 2, 0.32],
    ];
    for (const [lx, ly, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, headSideMat);
      leg.position.set(lx, ly, lz);
      this.legs.push(leg);
      this.group.add(leg);
    }
  }

  public update(delta: number, world: MobWorldCollider) {
    this.aiTimer -= delta;
    if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 4;
      this.moving = Math.random() > 0.35;
      if (this.moving) {
        this.yaw = Math.random() * Math.PI * 2;
      }
    }

    const speed = this.moving ? 1.25 : 0;
    const vx = -Math.sin(this.yaw) * speed;
    const vz = -Math.cos(this.yaw) * speed;

    const res = moveMobWithCollision(
      world,
      this.position,
      vx,
      vz,
      this.velocityY,
      delta,
      0.34,
      1.15
    );
    this.velocityY = res.nextVy;

    if (res.blockedHoriz) {
      this.yaw += Math.PI * (0.6 + Math.random() * 0.4);
    }

    if (this.moving && !res.blockedHoriz) {
      this.walkPhase += delta * 8;
      const swing = Math.sin(this.walkPhase) * 0.45;
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
      this.legs[3].rotation.x = swing;
    } else {
      for (const leg of this.legs) {
        leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, 0, delta * 8);
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }
}

function makeWolfFaceTexture(): THREE.CanvasTexture {
  return createPixelCanvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#d4d0c8';
    ctx.fillRect(0, 0, 16, 16);
    // Darker grey-brown forehead fur
    ctx.fillStyle = '#9c968c';
    ctx.fillRect(0, 0, 16, 5);
    ctx.fillRect(5, 5, 6, 3);
    // Friendly tamed wolf eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 6, 3, 2);
    ctx.fillRect(11, 6, 3, 2);
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(3, 6, 2, 2);
    ctx.fillRect(11, 6, 2, 2);
    // Lighter muzzle cheeks
    ctx.fillStyle = '#ebe7df';
    ctx.fillRect(2, 10, 12, 5);
  });
}

export class WolfPetModel {
  public group: THREE.Group;
  public head: THREE.Group;
  public tail: THREE.Mesh;
  public legs: THREE.Mesh[] = [];
  public position = new THREE.Vector3();
  public velocityY = 0;
  public yaw = 0;
  public walkPhase = 0;
  public attackCooldown = 0;
  public scavengeTimer = 14 + Math.random() * 10;
  public petName: string;
  public state: 'follow' | 'attack' | 'scavenge' = 'follow';

  constructor(petName: string, collarColor: string, x: number, y: number, z: number) {
    this.petName = petName;
    this.position.set(x, y, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const furMat = new THREE.MeshStandardMaterial({ color: '#d4d0c8', roughness: 0.85 });
    const maneMat = new THREE.MeshStandardMaterial({ color: '#aba59b', roughness: 0.9 });
    const collarMat = new THREE.MeshStandardMaterial({ color: collarColor, roughness: 0.6 });
    const noseMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
    const faceMat = new THREE.MeshStandardMaterial({ map: makeWolfFaceTexture(), roughness: 0.8 });

    // Wolf Head Group + Snout + Pointed Ears
    this.head = new THREE.Group();
    this.head.position.set(0, 0.66, -0.44);

    const headBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.34, 0.34),
      [furMat, furMat, furMat, furMat, furMat, faceMat]
    );
    this.head.add(headBox);

    // Protruding Wolf Snout & Black Nose
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), furMat);
    snout.position.set(0, -0.06, -0.24);
    const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.06), noseMat);
    noseTip.position.set(0, 0.04, -0.32);
    this.head.add(snout, noseTip);

    // 2 Upright Wolf Ears
    const earGeo = new THREE.BoxGeometry(0.1, 0.14, 0.06);
    const leftEar = new THREE.Mesh(earGeo, maneMat);
    leftEar.position.set(-0.12, 0.22, -0.02);
    const rightEar = new THREE.Mesh(earGeo, maneMat);
    rightEar.position.set(0.12, 0.22, -0.02);
    this.head.add(leftEar, rightEar);
    this.group.add(this.head);

    // Tamed Red/Cyan Collar + Shaggy Wolf Mane
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.1), collarMat);
    collar.position.set(0, 0.6, -0.26);
    this.group.add(collar);

    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.28), maneMat);
    mane.position.set(0, 0.6, -0.12);
    this.group.add(mane);

    // Wolf Torso
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.56), furMat);
    body.position.set(0, 0.56, 0.24);
    this.group.add(body);

    // Bushy Wagging Tail
    this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.36), maneMat);
    this.tail.position.set(0, 0.62, 0.62);
    this.tail.rotation.x = -0.35;
    this.group.add(this.tail);

    // 4 Wolf Legs
    const legGeo = new THREE.BoxGeometry(0.12, 0.38, 0.12);
    const legCoords = [
      [-0.11, 0.19, -0.18],
      [0.11, 0.19, -0.18],
      [-0.11, 0.19, 0.42],
      [0.11, 0.19, 0.42],
    ];
    for (const [lx, ly, lz] of legCoords) {
      const leg = new THREE.Mesh(legGeo, furMat);
      leg.position.set(lx, ly, lz);
      this.legs.push(leg);
      this.group.add(leg);
    }
  }

  public update(
    delta: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    isNight: boolean,
    hostileMobs: HostileMobModel[],
    world: MobWorldCollider,
    onAttackMonster: (mobIdx: number, mob: HostileMobModel) => void,
    onDeliverResource: (petName: string) => void
  ) {
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }

    // Teleport to player if player walked or teleported far away (> 26 blocks)
    const distToPlayer = this.position.distanceTo(playerPos);
    if (distToPlayer > 26) {
      const angle = Math.random() * Math.PI * 2;
      this.position.set(
        playerPos.x + Math.cos(angle) * 2.5,
        playerPos.y + 0.5,
        playerPos.z + Math.sin(angle) * 2.5
      );
      this.velocityY = 0;
    }

    // 1. Check for nearby hostile monsters to attack (especially at night or whenever monsters are near)
    let closestMobIdx = -1;
    let closestMobDistSq = 324; // 18 blocks detection range
    for (let i = 0; i < hostileMobs.length; i++) {
      const dSq = this.position.distanceToSquared(hostileMobs[i].position);
      if (dSq < closestMobDistSq) {
        closestMobDistSq = dSq;
        closestMobIdx = i;
      }
    }

    let vx = 0;
    let vz = 0;
    let isMoving = false;

    if (closestMobIdx !== -1) {
      // Combat Mode: Charge and bite hostile monster!
      this.state = 'attack';
      const targetMob = hostileMobs[closestMobIdx];
      const dx = targetMob.position.x - this.position.x;
      const dz = targetMob.position.z - this.position.z;
      this.yaw = Math.atan2(-dx, -dz);

      if (closestMobDistSq > 1.35) {
        const combatSpeed = 4.2;
        vx = -Math.sin(this.yaw) * combatSpeed;
        vz = -Math.cos(this.yaw) * combatSpeed;
        isMoving = true;
      } else if (this.attackCooldown <= 0) {
        this.attackCooldown = 0.85;
        this.velocityY = 3.2; // Leap bite
        onAttackMonster(closestMobIdx, targetMob);
      }
    } else {
      // Follow Player & Daytime Resource Scavenging
      this.state = isNight ? 'follow' : 'scavenge';
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const horizDist = Math.hypot(dx, dz);

      if (horizDist > 3.1) {
        this.yaw = Math.atan2(-dx, -dz);
        const followSpeed = horizDist > 7 ? 4.4 : 2.9;
        vx = -Math.sin(this.yaw) * followSpeed;
        vz = -Math.cos(this.yaw) * followSpeed;
        isMoving = true;
      } else {
        // Look affectionately at player when close
        this.yaw = Math.atan2(-dx, -dz);
      }

      // Daytime scavenging: periodically brings resources to the player
      if (!isNight) {
        this.scavengeTimer -= delta;
        if (this.scavengeTimer <= 0) {
          this.scavengeTimer = 22 + Math.random() * 14;
          onDeliverResource(this.petName);
        }
      }
    }

    const res = moveMobWithCollision(
      world,
      this.position,
      vx,
      vz,
      this.velocityY,
      delta,
      0.28,
      0.95
    );
    this.velocityY = res.nextVy;

    // Wag tail and animate legs
    this.tail.rotation.y = Math.sin(elapsed * 9) * 0.45;
    this.head.rotation.z = Math.sin(elapsed * 2.5) * 0.08;

    if (isMoving && !res.blockedHoriz) {
      this.walkPhase += delta * 13;
      const swing = Math.sin(this.walkPhase) * 0.6;
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
      this.legs[3].rotation.x = swing;
    } else {
      for (const leg of this.legs) {
        leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, 0, delta * 10);
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }
}

