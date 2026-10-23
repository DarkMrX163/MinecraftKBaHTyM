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

function makeNameplateSprite(name: string, deviceType: 'desktop' | 'mobile'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(16, 12, 224, 40);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 12, 224, 40);

  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = `${name} [${deviceType === 'mobile' ? 'Touch' : 'PC'}]`;
  ctx.fillText(label.slice(0, 20), 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.set(0, 2.15, 0);
  sprite.renderOrder = 10;
  return sprite;
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

  constructor(
    name: string,
    skinId = 'steve',
    deviceType: 'desktop' | 'mobile' = 'desktop',
    showNameplate = true
  ) {
    this.skinId = skinId;
    this.playerName = name;
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
    // Box faces: +X, -X, +Y, -Y, +Z, -Z (Front of character is -Z)
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
      const sprite = makeNameplateSprite(name, deviceType);
      this.group.add(sprite);
    }
  }

  public triggerSwing() {
    this.swingTimer = 0.28;
  }

  public update(delta: number, isMoving: boolean, sneaking = false) {
    // Smooth interpolation toward network target
    this.group.position.lerp(this.targetPos, Math.min(1, delta * 14));

    // Interpolate yaw rotation smoothly
    let diff = this.targetYaw - this.group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, delta * 14);

    this.headPivot.rotation.x = THREE.MathUtils.lerp(
      this.headPivot.rotation.x,
      this.targetPitch,
      Math.min(1, delta * 14)
    );

    // Sneaking crouch posture
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
