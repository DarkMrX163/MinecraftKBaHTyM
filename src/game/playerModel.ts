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

function makeFaceTexture(palette: CharacterSkinPalette): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Base skin
  ctx.fillStyle = palette.skin;
  ctx.fillRect(0, 0, 64, 64);

  // Hair top & sideburns
  ctx.fillStyle = palette.hair;
  ctx.fillRect(0, 0, 64, 16);
  ctx.fillRect(0, 16, 8, 8);
  ctx.fillRect(56, 16, 8, 8);

  // Eyes (white sclera + colored iris)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 32, 8, 8);
  ctx.fillRect(48, 32, 8, 8);

  ctx.fillStyle = palette.eyes;
  ctx.fillRect(16, 32, 8, 8);
  ctx.fillRect(40, 32, 8, 8);

  // Nose & Mouth
  ctx.fillStyle = '#a36e4d';
  ctx.fillRect(24, 40, 16, 6);

  ctx.fillStyle = '#6e4228';
  ctx.fillRect(16, 48, 32, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawNameplateCanvas(
  canvas: HTMLCanvasElement,
  name: string,
  deviceType: 'desktop' | 'mobile' | 'npc' | 'hostile',
  accentColor = '#ffffff'
) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(8, 10, 240, 44);

  ctx.strokeStyle =
    deviceType === 'hostile'
      ? 'rgba(239, 68, 68, 0.7)'
      : deviceType === 'npc'
      ? 'rgba(52, 211, 153, 0.7)'
      : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 10, 240, 44);

  ctx.font = 'bold 21px "JetBrains Mono", monospace';
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const suffix =
    deviceType === 'mobile'
      ? ' [Touch]'
      : deviceType === 'desktop'
      ? ''
      : '';
  const label = `${name}${suffix}`;
  ctx.fillText(label.slice(0, 22), 128, 32);
}

function makeNameplateSprite(
  name: string,
  deviceType: 'desktop' | 'mobile' | 'npc' | 'hostile',
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

    // 1. Head (0.5 x 0.5 x 0.5)
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.4, 0);
    const headGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
    const headMaterials = [
      skinMat, // +X
      skinMat, // -X
      hairMat, // +Y (Top)
      skinMat, // -Y
      hairMat, // +Z (Back)
      faceMat, // -Z (Front face)
    ];
    const headMesh = new THREE.Mesh(headGeo, headMaterials);
    headMesh.position.set(0, 0.23, 0);
    headMesh.castShadow = true;
    this.headPivot.add(headMesh);
    this.group.add(this.headPivot);

    // 2. Torso (0.46 x 0.68 x 0.24)
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
    const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 });
    const apronMat = new THREE.MeshStandardMaterial({ color: '#5c4028', roughness: 0.9 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1f8f4a', roughness: 0.3 });
    const browMat = new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.9 });

    // Tall Villager Head
    const headGeo = new THREE.BoxGeometry(0.48, 0.56, 0.48);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.set(0, 1.55, 0);

    // Unibrow
    const browGeo = new THREE.BoxGeometry(0.38, 0.07, 0.05);
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(0, 0.1, -0.25);
    this.head.add(brow);

    // Emerald Eyes
    const eyeGeo = new THREE.BoxGeometry(0.09, 0.09, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.11, 0.02, -0.25);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.11, 0.02, -0.25);
    this.head.add(leftEye, rightEye);

    // Prominent Villager Nose
    const noseGeo = new THREE.BoxGeometry(0.12, 0.22, 0.14);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, -0.08, -0.29);
    this.head.add(nose);

    this.group.add(this.head);

    // Robe Torso
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.82, 0.32);
    const body = new THREE.Mesh(bodyGeo, robeMat);
    body.position.set(0, 0.9, 0);
    this.group.add(body);

    // Folded Arms in front of chest
    const armsGeo = new THREE.BoxGeometry(0.54, 0.24, 0.26);
    const arms = new THREE.Mesh(armsGeo, apronMat);
    arms.position.set(0, 0.98, -0.14);
    arms.rotation.x = -0.25;
    this.group.add(arms);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
    this.leftLeg = new THREE.Mesh(legGeo, apronMat);
    this.leftLeg.position.set(-0.12, 0.25, 0);
    this.rightLeg = new THREE.Mesh(legGeo, apronMat);
    this.rightLeg.position.set(0.12, 0.25, 0);
    this.group.add(this.leftLeg, this.rightLeg);

    // Overhead NPC nameplate
    const np = makeNameplateSprite(professionName, 'npc', '#6ee7b7');
    np.sprite.position.set(0, 2.15, 0);
    this.group.add(np.sprite);
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    getGroundHeight: (x: number, z: number) => number
  ) {
    this.aiTimer -= delta;
    const distToPlayerSq = this.position.distanceToSquared(playerPos);

    // Look at player when close
    if (distToPlayerSq < 25) {
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      this.yaw = Math.atan2(-dx, -dz);
      this.moving = false;
    } else if (this.aiTimer <= 0) {
      this.aiTimer = 2.0 + Math.random() * 3.5;
      this.moving = Math.random() > 0.35;
      if (this.moving) {
        // Stay near village home center
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

    if (this.moving) {
      const speed = 1.35;
      const nx = this.position.x - Math.sin(this.yaw) * speed * delta;
      const nz = this.position.z - Math.cos(this.yaw) * speed * delta;
      const gy = getGroundHeight(nx, nz);

      if (Math.abs(gy - this.position.y) <= 1.2 && gy > 14) {
        this.position.x = nx;
        this.position.z = nz;
        this.position.y = THREE.MathUtils.lerp(this.position.y, gy, delta * 10);
      } else {
        this.yaw += Math.PI * 0.8;
      }

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

export class HostileMobModel {
  public group: THREE.Group;
  public leftLeg: THREE.Mesh;
  public rightLeg: THREE.Mesh;
  public leftArm: THREE.Mesh;
  public rightArm: THREE.Mesh;
  public bodyMat: THREE.MeshStandardMaterial;
  public headMat: THREE.MeshStandardMaterial;
  public position = new THREE.Vector3();
  public yaw = 0;
  public walkPhase = 0;
  public kind: 'zombie' | 'creeper';
  public health = 3;
  public maxHealth = 3;
  public hitFlashTimer = 0;
  public attackCooldown = 0;

  private nameplateCanvas: HTMLCanvasElement;
  private nameplateTexture: THREE.CanvasTexture;

  constructor(kind: 'zombie' | 'creeper', x: number, y: number, z: number) {
    this.kind = kind;
    this.position.set(x, y, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const isZombie = kind === 'zombie';
    const skinColor = isZombie ? '#4c7838' : '#3fb53f';
    const shirtColor = isZombie ? '#00919c' : '#329632';
    const pantsColor = isZombie ? '#39327a' : '#287a28';

    this.headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85 });
    this.bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.3 });

    // Head
    const headGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
    const head = new THREE.Mesh(headGeo, this.headMat);
    head.position.set(0, 1.55, 0);

    const eyeGeo = new THREE.BoxGeometry(0.09, 0.08, 0.04);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.11, 0.03, -0.24);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.11, 0.03, -0.24);
    head.add(leftEye, rightEye);
    this.group.add(head);

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.46, 0.68, 0.24);
    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    body.position.set(0, 0.98, 0);
    this.group.add(body);

    // Arms (outstretched for zombie)
    const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.2);
    this.leftArm = new THREE.Mesh(armGeo, this.headMat);
    this.leftArm.position.set(-0.34, 1.22, -0.22);
    this.leftArm.rotation.x = isZombie ? -Math.PI / 2.2 : 0;

    this.rightArm = new THREE.Mesh(armGeo, this.headMat);
    this.rightArm.position.set(0.34, 1.22, -0.22);
    this.rightArm.rotation.x = isZombie ? -Math.PI / 2.2 : 0;
    this.group.add(this.leftArm, this.rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.62, 0.2);
    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.12, 0.32, 0);
    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.12, 0.32, 0);
    this.group.add(this.leftLeg, this.rightLeg);

    const label = this.getLabel();
    const np = makeNameplateSprite(label, 'hostile', '#fca5a5');
    this.nameplateCanvas = np.canvas;
    this.nameplateTexture = np.texture;
    np.sprite.position.set(0, 2.1, 0);
    this.group.add(np.sprite);
  }

  private getLabel(): string {
    const title = this.kind === 'zombie' ? 'Зомби' : 'Крипер';
    const hearts = '♥'.repeat(Math.max(0, this.health));
    return `${title} ${hearts}`;
  }

  public takeDamage(amount = 1, knockbackDir?: THREE.Vector3): boolean {
    this.health = Math.max(0, this.health - amount);
    this.hitFlashTimer = 0.25;
    this.headMat.emissive.setHex(0xcc2222);
    this.bodyMat.emissive.setHex(0xcc2222);

    if (knockbackDir) {
      this.position.x += knockbackDir.x * 0.9;
      this.position.z += knockbackDir.z * 0.9;
    }

    drawNameplateCanvas(this.nameplateCanvas, this.getLabel(), 'hostile', '#fca5a5');
    this.nameplateTexture.needsUpdate = true;
    return this.health <= 0;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    getGroundHeight: (x: number, z: number) => number,
    onAttackPlayer: (dmg: number) => void
  ) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.headMat.emissive.setHex(0x000000);
        this.bodyMat.emissive.setHex(0x000000);
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < 625) {
      // Chase player within 25 blocks
      this.yaw = Math.atan2(-dx, -dz);
      const speed = this.kind === 'zombie' ? 2.35 : 2.65;
      if (distSq > 1.35) {
        const nx = this.position.x - Math.sin(this.yaw) * speed * delta;
        const nz = this.position.z - Math.cos(this.yaw) * speed * delta;
        const gy = getGroundHeight(nx, nz);
        if (Math.abs(gy - this.position.y) <= 1.8 && gy > 13) {
          this.position.x = nx;
          this.position.z = nz;
          this.position.y = THREE.MathUtils.lerp(this.position.y, gy, delta * 10);
        }
      } else if (this.attackCooldown <= 0 && Math.abs(playerPos.y - this.position.y) < 2.2) {
        this.attackCooldown = 1.25;
        onAttackPlayer(this.kind === 'creeper' ? 3 : 2);
      }

      this.walkPhase += delta * 9;
      const swing = Math.sin(this.walkPhase) * 0.55;
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

export class PassiveMobModel {
  public group: THREE.Group;
  public legs: THREE.Mesh[] = [];
  public head: THREE.Mesh;
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public yaw = 0;
  public walkPhase = 0;
  public aiTimer = 0;
  public moving = false;
  public type: 'sheep' | 'pig';

  constructor(type: 'sheep' | 'pig', x: number, y: number, z: number) {
    this.type = type;
    this.position.set(x, y, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const bodyColor = type === 'sheep' ? '#f2f2ed' : '#f0a5a8';
    const skinColor = type === 'sheep' ? '#d9c4b0' : '#f0a5a8';

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.9, metalness: 0.02 });
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8, metalness: 0.05 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.4 });

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.65, 0.55, 0.95);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.65, 0);
    this.group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.set(0, 0.85, -0.55);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.14, 0.05, -0.23);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.14, 0.05, -0.23);
    this.head.add(leftEye, rightEye);

    if (type === 'pig') {
      const snoutGeo = new THREE.BoxGeometry(0.22, 0.16, 0.1);
      const snout = new THREE.Mesh(snoutGeo, headMat);
      snout.position.set(0, -0.06, -0.25);
      this.head.add(snout);
    }

    this.group.add(this.head);

    // 4 Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.42, 0.18);
    const legOffsets = [
      [-0.2, 0.21, -0.32],
      [0.2, 0.21, -0.32],
      [-0.2, 0.21, 0.32],
      [0.2, 0.21, 0.32],
    ];
    for (const [lx, ly, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, headMat);
      leg.position.set(lx, ly, lz);
      this.legs.push(leg);
      this.group.add(leg);
    }
  }

  public update(delta: number, getGroundHeight: (x: number, z: number) => number) {
    this.aiTimer -= delta;
    if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 4;
      this.moving = Math.random() > 0.35;
      if (this.moving) {
        this.yaw = Math.random() * Math.PI * 2;
      }
    }

    if (this.moving) {
      const speed = 1.25;
      const nx = this.position.x - Math.sin(this.yaw) * speed * delta;
      const nz = this.position.z - Math.cos(this.yaw) * speed * delta;
      const gy = getGroundHeight(nx, nz);

      if (Math.abs(gy - this.position.y) <= 1.1 && gy > 14) {
        this.position.x = nx;
        this.position.z = nz;
        this.position.y = THREE.MathUtils.lerp(this.position.y, gy, delta * 10);
      } else {
        this.yaw += Math.PI * 0.7;
      }

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
