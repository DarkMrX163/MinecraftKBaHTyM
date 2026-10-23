import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BlockId,
  BLOCKS,
  PLACEABLE_BLOCKS,
  getMinecraftAtlas,
  ATLAS_COLS,
  ATLAS_ROWS,
} from './game/textures';
import { VoxelWorld, WATER_LEVEL } from './game/world';
import {
  VoxelCharacterModel,
  PassiveMobModel,
  VillagerMobModel,
  HostileMobModel,
  SKIN_PALETTES,
} from './game/playerModel';
import {
  InventorySlot,
  INITIAL_HOTBAR,
  CRAFTING_RECIPES,
  CraftingRecipe,
} from './game/recipes';
import { soundEngine } from './game/audio';
import {
  MultiplayerManager,
  NetworkPlayerPayload,
  NetworkChatPayload,
} from './game/network';
import {
  Users,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  CloudRain,
  Package,
  MessageSquare,
  Eye,
  Feather,
  ChevronDown,
  ChevronUp,
  Play,
  Sparkles,
  Hammer,
  Github,
  Globe,
  ExternalLink,
  RefreshCw,
  Compass,
  MapPin,
  Sword,
} from 'lucide-react';

interface ParticleBurst {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

interface ActiveRoomSummary {
  id: string;
  seed: number;
  playerCount: number;
  modifiedCount: number;
  weather: string;
}

interface WorldEventQuest {
  id: string;
  type: 'treasure' | 'meteor';
  title: string;
  x: number;
  y: number;
  z: number;
  foundCount: number;
}

// Reusable module-scope math vectors to prevent GC in animation loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _skyDay = new THREE.Color('#78a7ff');
const _skySunset = new THREE.Color('#d97d54');
const _skyNight = new THREE.Color('#0a0f24');
const _curSky = new THREE.Color();

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const miniMapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Parse room from URL query for instant cross-platform friend invite
  const initialRoomFromUrl = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'overworld-1';
  })();

  // Open on the Join / Nickname screen by default so players joining via link enter their nickname & click "Войти"
  const [inTitleScreen, setInTitleScreen] = useState<boolean>(true);
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('mc_player_name') || `Игрок_${Math.floor(100 + Math.random() * 899)}`;
  });
  const [selectedSkin, setSelectedSkin] = useState<string>(() => {
    return localStorage.getItem('mc_player_skin') || 'steve';
  });
  const [roomId, setRoomId] = useState<string>(initialRoomFromUrl);
  const [roomInput, setRoomInput] = useState<string>(initialRoomFromUrl);
  const [worldSeed, setWorldSeed] = useState<number>(42069);

  // GitHub Publisher States
  const [ghToken, setGhToken] = useState<string>(() => localStorage.getItem('mc_gh_token') || '');
  const [ghRepoName, setGhRepoName] = useState<string>('MinecraftKBaHTyM');
  const [ghDescription, setGhDescription] = useState<string>(
    'Minecraft Voxel Edition — 3D WebGL & Cross-Platform Online Multiplayer (WebRTC P2P + WebSocket)'
  );
  const [ghPrivate, setGhPrivate] = useState<boolean>(false);
  const [ghPublishing, setGhPublishing] = useState<boolean>(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghResult, setGhResult] = useState<{
    repoUrl: string;
    pagesUrl: string;
    uploadedCount: number;
  } | null>(null);
  const [copiedGhLink, setCopiedGhLink] = useState<string | null>(null);

  // Game modes & UI states
  const [gameMode, setGameMode] = useState<'survival' | 'creative'>('survival');
  const [isFlying, setIsFlying] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'first' | 'third-back' | 'third-front'>('first');
  const [showInventory, setShowInventory] = useState<boolean>(false);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(true);
  const [autoDayNight, setAutoDayNight] = useState<boolean>(true);

  // Inventory & Hotbar
  const [hotbar, setHotbar] = useState<InventorySlot[]>(INITIAL_HOTBAR);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [blockIcons, setBlockIcons] = useState<Record<number, string>>({});

  // Player vitals & telemetry
  const [health, setHealth] = useState<number>(20);
  const [hunger, setHunger] = useState<number>(20);
  const [coords, setCoords] = useState<{ x: number; y: number; z: number; biome: string }>({
    x: 0,
    y: 24,
    z: 0,
    biome: 'Равнины',
  });
  const [targetBlockName, setTargetBlockName] = useState<string | null>(null);
  const [miningProgress, setMiningProgress] = useState<number>(0);
  const [hostileCount, setHostileCount] = useState<number>(0);
  const [eventBanner, setEventBanner] = useState<string | null>(null);

  // Treasure Hunt / World Event state
  const [activeQuest, setActiveQuest] = useState<WorldEventQuest>({
    id: 'quest-1',
    type: 'treasure',
    title: 'Поиск древнего клада',
    x: 28,
    y: 20,
    z: -26,
    foundCount: 0,
  });

  // Multiplayer & World environment
  const [netStatus, setNetStatus] = useState<{
    wsConnected: boolean;
    p2pConnected: boolean;
    p2pRole: 'host' | 'client' | 'connecting';
    peerCount: number;
  }>({
    wsConnected: false,
    p2pConnected: false,
    p2pRole: 'connecting',
    peerCount: 0,
  });
  const [onlinePlayers, setOnlinePlayers] = useState<NetworkPlayerPayload[]>([]);
  const [activeRoomsList, setActiveRoomsList] = useState<ActiveRoomSummary[]>([]);
  const [chatMessages, setChatMessages] = useState<NetworkChatPayload[]>([]);
  const [chatDraft, setChatDraft] = useState<string>('');
  const [timeOfDay, setTimeOfDay] = useState<number>(0.25); // 0.25 = Noon, 0.75 = Midnight
  const [weather, setWeather] = useState<'clear' | 'rain' | 'snow'>('clear');

  // Mutable refs for 60fps Three.js game loop access
  const stateRef = useRef({
    inTitleScreen,
    showGithubModal,
    gameMode,
    isFlying,
    cameraMode,
    showInventory,
    showChat,
    hotbar,
    activeSlot,
    playerName,
    selectedSkin,
    timeOfDay,
    weather,
    health,
    autoDayNight,
    showMiniMap,
    activeQuest,
  });

  useEffect(() => {
    stateRef.current = {
      inTitleScreen,
      showGithubModal,
      gameMode,
      isFlying,
      cameraMode,
      showInventory,
      showChat,
      hotbar,
      activeSlot,
      playerName,
      selectedSkin,
      timeOfDay,
      weather,
      health,
      autoDayNight,
      showMiniMap,
      activeQuest,
    };
  }, [
    inTitleScreen,
    showGithubModal,
    gameMode,
    isFlying,
    cameraMode,
    showInventory,
    showChat,
    hotbar,
    activeSlot,
    playerName,
    selectedSkin,
    timeOfDay,
    weather,
    health,
    autoDayNight,
    showMiniMap,
    activeQuest,
  ]);

  // Refs to engine instances
  const worldRef = useRef<VoxelWorld | null>(null);
  const netRef = useRef<MultiplayerManager | null>(null);
  const selfIdRef = useRef<string>(`p_${Math.random().toString(36).slice(2, 10)}`);
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0.5, 28, 0.5));
  const playerVelRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(-0.15);
  const keysRef = useRef<Record<string, boolean>>({});
  const mouseDownLeftRef = useRef<boolean>(false);
  const touchMoveVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggerActionRef = useRef<{
    breakBlock: () => void;
    placeBlock: () => void;
    spawnEvent: (eventType?: 'treasure' | 'meteor') => void;
  }>({
    breakBlock: () => {},
    placeBlock: () => {},
    spawnEvent: () => {},
  });

  // Detect touch device on mount
  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(touch);
  }, []);

  // Save player profile
  useEffect(() => {
    localStorage.setItem('mc_player_name', playerName);
    localStorage.setItem('mc_player_skin', selectedSkin);
  }, [playerName, selectedSkin]);

  // Fetch active server rooms list when lobby is opened
  const fetchRoomsList = useCallback(() => {
    fetch('/api/rooms')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.rooms)) {
          setActiveRoomsList(data.rooms);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (inTitleScreen) {
      fetchRoomsList();
    }
  }, [inTitleScreen, fetchRoomsList]);

  // Copy room invite link
  const handleCopyInvite = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString()).catch(() => {});
    setCopiedLink(true);
    soundEngine.playClick();
    setTimeout(() => setCopiedLink(false), 2200);
  }, [roomId]);

  // Publish to GitHub handler
  const handlePublishToGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ghToken.trim()) {
      setGhError('Пожалуйста, вставьте ваш GitHub Personal Access Token (classic с правами repo).');
      return;
    }
    localStorage.setItem('mc_gh_token', ghToken.trim());
    setGhPublishing(true);
    setGhError(null);
    setGhResult(null);

    try {
      const response = await fetch('/api/github/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: ghToken.trim(),
          repoName: ghRepoName.trim() || 'minecraft-voxel-online',
          description: ghDescription.trim(),
          isPrivate: ghPrivate,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setGhError(data.error || 'Не удалось опубликовать репозиторий на GitHub.');
      } else {
        setGhResult({
          repoUrl: data.repoUrl,
          pagesUrl: data.pagesUrl,
          uploadedCount: data.uploadedCount,
        });
      }
    } catch (err) {
      setGhError(err instanceof Error ? err.message : 'Ошибка соединения при отправке в GitHub');
    } finally {
      setGhPublishing(false);
    }
  };

  // Add item to hotbar
  const addBlockToInventory = useCallback((blockId: BlockId, amount = 1) => {
    if (blockId === BlockId.AIR) return;
    setHotbar((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const existingIdx = next.findIndex((s) => s.blockId === blockId && s.count > 0);
      if (existingIdx !== -1) {
        next[existingIdx].count = Math.min(999, next[existingIdx].count + amount);
        return next;
      }
      const emptyIdx = next.findIndex((s) => s.count <= 0);
      if (emptyIdx !== -1) {
        next[emptyIdx] = { blockId, count: amount };
        return next;
      }
      next[stateRef.current.activeSlot] = { blockId, count: amount };
      return next;
    });
  }, []);

  // Craft recipe handler
  const handleCraftRecipe = useCallback(
    (recipe: CraftingRecipe) => {
      soundEngine.playClick();
      if (stateRef.current.gameMode === 'creative') {
        addBlockToInventory(recipe.output.blockId, recipe.output.count);
        return;
      }

      setHotbar((prev) => {
        const next = prev.map((s) => ({ ...s }));
        for (const req of recipe.inputs) {
          const total = next
            .filter((s) => s.blockId === req.blockId)
            .reduce((acc, s) => acc + s.count, 0);
          if (total < req.count) return prev;
        }
        for (const req of recipe.inputs) {
          let rem = req.count;
          for (const slot of next) {
            if (slot.blockId === req.blockId && slot.count > 0 && rem > 0) {
              const take = Math.min(slot.count, rem);
              slot.count -= take;
              rem -= take;
            }
          }
        }
        const outSlot = next.find((s) => s.blockId === recipe.output.blockId && s.count > 0);
        if (outSlot) {
          outSlot.count += recipe.output.count;
        } else {
          const emptySlot = next.find((s) => s.count <= 0);
          if (emptySlot) {
            emptySlot.blockId = recipe.output.blockId;
            emptySlot.count = recipe.output.count;
          } else {
            next[stateRef.current.activeSlot] = {
              blockId: recipe.output.blockId,
              count: recipe.output.count,
            };
          }
        }
        return next;
      });
    },
    [addBlockToInventory]
  );

  // Send chat message
  const handleSendChat = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = chatDraft.trim();
      if (!trimmed) {
        setShowChat(false);
        return;
      }
      if (netRef.current) {
        netRef.current.sendChat(trimmed, playerName);
      }
      setChatDraft('');
      setShowChat(false);
    },
    [chatDraft, playerName]
  );

  // Sync environment change to server & P2P peers
  const updateWorldEnv = useCallback((newTime?: number, newWeather?: 'clear' | 'rain' | 'snow') => {
    soundEngine.playClick();
    const t = typeof newTime === 'number' ? newTime : stateRef.current.timeOfDay;
    const w = newWeather || stateRef.current.weather;
    setTimeOfDay(t);
    stateRef.current.timeOfDay = t;
    setWeather(w);
    if (netRef.current) {
      netRef.current.sendWorldEnv(t, w);
    }
  }, []);

  // Teleport helper for quick navigation to Spawn, Village, or Quest
  const teleportPlayerTo = useCallback((tx: number, tz: number, label: string) => {
    const world = worldRef.current;
    if (!world) return;
    soundEngine.playClick();
    world.updateChunksAroundPlayer(tx, tz, 2);
    const ty = world.getTerrainHeight(Math.floor(tx), Math.floor(tz)).height;
    playerPosRef.current.set(tx + 0.5, Math.max(ty + 1.2, WATER_LEVEL + 2), tz + 0.5);
    playerVelRef.current.set(0, 0, 0);
    setEventBanner(`Перемещение: ${label} (${tx}, ${tz})`);
    setTimeout(() => setEventBanner(null), 3200);
  }, []);

  // Main Three.js & Dual-Transport Online Multiplayer Initialization
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#78a7ff');
    scene.fog = new THREE.FogExp2('#78a7ff', 0.018);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight('#d6e8ff', '#4b5e38', 0.78);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff8e7', 1.15);
    sunLight.position.set(40, 80, 30);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 160;
    const d = 36;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const celestialGroup = new THREE.Group();
    const sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#fff380' })
    );
    const moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#dce8ff' })
    );
    celestialGroup.add(sunMesh, moonMesh);
    scene.add(celestialGroup);

    const cloudCount = 32;
    const cloudGeo = new THREE.BoxGeometry(12, 1.8, 8);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.86,
    });
    const cloudInstanced = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
    cloudInstanced.frustumCulled = false;
    const cloudDummy = new THREE.Object3D();
    const cloudOffsets: { x: number; z: number; scaleX: number; scaleZ: number }[] = [];
    for (let i = 0; i < cloudCount; i++) {
      const cx = ((i % 8) - 4) * 24 + (i * 7) % 13;
      const cz = (Math.floor(i / 8) - 2) * 24 + (i * 11) % 15;
      const sx = 0.8 + (i % 3) * 0.45;
      const sz = 0.8 + ((i + 1) % 3) * 0.45;
      cloudOffsets.push({ x: cx, z: cz, scaleX: sx, scaleZ: sz });
      cloudDummy.position.set(cx, 48, cz);
      cloudDummy.scale.set(sx, 1, sz);
      cloudDummy.updateMatrix();
      cloudInstanced.setMatrixAt(i, cloudDummy.matrix);
    }
    cloudInstanced.instanceMatrix.needsUpdate = true;
    scene.add(cloudInstanced);

    const atlas = getMinecraftAtlas();
    setBlockIcons(atlas.blockIcons);

    const world = new VoxelWorld(scene, atlas.texture, 42069);
    worldRef.current = world;

    const spawnGroundY = world.getTerrainHeight(0, 0).height;
    playerPosRef.current.set(0.5, Math.max(spawnGroundY + 1.05, WATER_LEVEL + 2), 0.5);
    world.updateChunksAroundPlayer(0, 0, 2);

    // Show nameplate on local player too so nickname is visible above head in 3rd-person view
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const localPlayerModel = new VoxelCharacterModel(
      stateRef.current.playerName,
      stateRef.current.selectedSkin,
      isTouch ? 'mobile' : 'desktop',
      true
    );
    localPlayerModel.group.visible = false;
    scene.add(localPlayerModel.group);

    const fpHandGroup = new THREE.Group();
    const fpBlockGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const fpBlockMat = new THREE.MeshLambertMaterial({ map: atlas.texture });
    const fpBlockMesh = new THREE.Mesh(fpBlockGeo, fpBlockMat);
    fpBlockMesh.position.set(0.38, -0.32, -0.52);
    fpBlockMesh.rotation.set(0.2, -0.65, -0.1);
    fpHandGroup.add(fpBlockMesh);
    camera.add(fpHandGroup);
    scene.add(camera);

    let lastHeldBlockId = -1;
    const updateHeldBlockUV = (blockId: number) => {
      if (blockId === lastHeldBlockId) return;
      lastHeldBlockId = blockId;
      const def = BLOCKS[blockId] || BLOCKS[BlockId.GRASS];
      const uvAttr = fpBlockGeo.attributes.uv as THREE.BufferAttribute;
      const faceMapping = [4, 5, 0, 1, 3, 2];
      for (let f = 0; f < 6; f++) {
        const tileIdx = def.faces[faceMapping[f]];
        const col = tileIdx % ATLAS_COLS;
        const row = Math.floor(tileIdx / ATLAS_COLS);
        const u0 = col / ATLAS_COLS + 0.002;
        const u1 = (col + 1) / ATLAS_COLS - 0.002;
        const v1 = 1 - row / ATLAS_ROWS - 0.002;
        const v0 = 1 - (row + 1) / ATLAS_ROWS + 0.002;

        const base = f * 4;
        uvAttr.setXY(base + 0, u0, v1);
        uvAttr.setXY(base + 1, u1, v1);
        uvAttr.setXY(base + 2, u0, v0);
        uvAttr.setXY(base + 3, u1, v0);
      }
      uvAttr.needsUpdate = true;
    };
    updateHeldBlockUV(BlockId.GRASS);

    const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const wireMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const selectionBox = new THREE.LineSegments(wireGeo, wireMat);
    selectionBox.visible = false;
    scene.add(selectionBox);

    const crackGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const crackMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      wireframe: true,
    });
    const crackMesh = new THREE.Mesh(crackGeo, crackMat);
    crackMesh.visible = false;
    scene.add(crackMesh);

    const mobs: PassiveMobModel[] = [];
    const villagers: VillagerMobModel[] = [];
    const hostileMobs: HostileMobModel[] = [];

    const spawnMobsAndVillagers = () => {
      for (const m of mobs) scene.remove(m.group);
      mobs.length = 0;
      const mobCoords = [
        [-6, -5, 'sheep'],
        [7, -4, 'pig'],
        [-5, 7, 'sheep'],
        [8, 6, 'pig'],
        [12, -9, 'sheep'],
        [-11, 9, 'pig'],
      ] as const;
      for (const [mx, mz, mtype] of mobCoords) {
        const my = world.getTerrainHeight(mx, mz).height + 1;
        if (my > WATER_LEVEL + 1) {
          const mob = new PassiveMobModel(mtype, mx + 0.5, my, mz + 0.5);
          scene.add(mob.group);
          mobs.push(mob);
        }
      }

      // Spawn Villagers in all 3 distant Villages
      for (const v of villagers) scene.remove(v.group);
      villagers.length = 0;
      const villagerProfessions = [
        { role: 'Житель-Кузнец', color: '#4a3525', dx: 3, dz: 2 },
        { role: 'Житель-Фермер', color: '#7c5832', dx: -3, dz: 3 },
        { role: 'Житель-Торговец', color: '#2b5b84', dx: 2, dz: -3 },
      ];
      for (const vc of VoxelWorld.VILLAGE_CENTERS) {
        for (const prof of villagerProfessions) {
          const vx = vc.x + prof.dx;
          const vz = vc.z + prof.dz;
          const vy = world.getTerrainHeight(vx, vz).height + 1;
          const villager = new VillagerMobModel(
            `${prof.role} (${vc.nameRu.split(' ')[0]})`,
            prof.color,
            vx + 0.5,
            vy,
            vz + 0.5
          );
          scene.add(villager.group);
          villagers.push(villager);
        }
      }
    };
    spawnMobsAndVillagers();

    const particles: ParticleBurst[] = [];
    const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const spawnBlockParticles = (bx: number, by: number, bz: number, count = 14, colorHex = 0x999999) => {
      const mat = new THREE.MeshLambertMaterial({ color: colorHex });
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(partGeo, mat);
        mesh.position.set(
          bx + 0.2 + Math.random() * 0.6,
          by + 0.2 + Math.random() * 0.6,
          bz + 0.2 + Math.random() * 0.6
        );
        scene.add(mesh);
        particles.push({
          mesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 4.2,
            1.5 + Math.random() * 3.5,
            (Math.random() - 0.5) * 4.2
          ),
          life: 0.45 + Math.random() * 0.3,
        });
      }
    };

    // Spawn a Treasure Chest or Meteor Event in the world
    const spawnWorldQuestEvent = (eventType: 'treasure' | 'meteor' = 'treasure', announce = true) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 26 + Math.floor(Math.random() * 30);
      const qx = Math.round(playerPosRef.current.x + Math.cos(angle) * dist);
      const qz = Math.round(playerPosRef.current.z + Math.sin(angle) * dist);
      world.updateChunksAroundPlayer(qx, qz, 1);
      const qy = Math.max(world.getTerrainHeight(qx, qz).height + 1, WATER_LEVEL + 1);

      if (eventType === 'meteor') {
        // Build a glowing meteorite crater with gold/diamond ore & treasure chest
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            world.setBlock(qx + dx, qy - 1, qz + dz, BlockId.COBBLESTONE, false);
          }
        }
        world.setBlock(qx + 1, qy, qz, BlockId.GOLD_ORE, false);
        world.setBlock(qx - 1, qy, qz, BlockId.DIAMOND_ORE, false);
        world.setBlock(qx, qy + 1, qz, BlockId.GLOWSTONE, false);
        world.setBlock(qx, qy, qz, BlockId.TREASURE_CHEST, true);
      } else {
        // Place Treasure Chest on a Gold/Brick pedestal with a Glowstone beacon
        world.setBlock(qx, qy - 1, qz, BlockId.GOLD_BLOCK, false);
        world.setBlock(qx, qy + 2, qz, BlockId.GLOWSTONE, false);
        world.setBlock(qx, qy, qz, BlockId.TREASURE_CHEST, true);
      }

      const nextQuest: WorldEventQuest = {
        id: `q_${Date.now()}`,
        type: eventType,
        title: eventType === 'meteor' ? 'Звёздный метеорит' : 'Поиск древнего клада',
        x: qx,
        y: qy,
        z: qz,
        foundCount: stateRef.current.activeQuest.foundCount,
      };
      setActiveQuest(nextQuest);
      stateRef.current.activeQuest = nextQuest;

      if (announce) {
        const msg =
          eventType === 'meteor'
            ? `☄️ Ивент «Звёздный метеорит» упал на координатах X:${qx} Z:${qz}!`
            : `🗺️ Ивент «Поиск клада»: сундук спрятан на X:${qx} Z:${qz}!`;
        setEventBanner(msg);
        setTimeout(() => setEventBanner(null), 5000);
      }
    };

    // Place initial treasure chest at (28, -26)
    {
      const initX = 28;
      const initZ = -26;
      const initY = Math.max(world.getTerrainHeight(initX, initZ).height + 1, WATER_LEVEL + 1);
      world.setBlock(initX, initY - 1, initZ, BlockId.GOLD_BLOCK, false);
      world.setBlock(initX, initY + 2, initZ, BlockId.GLOWSTONE, false);
      world.setBlock(initX, initY, initZ, BlockId.TREASURE_CHEST, true);
      setActiveQuest((prev) => ({ ...prev, x: initX, y: initY, z: initZ }));
    }

    const weatherCount = 240;
    const weatherGeo = new THREE.BufferGeometry();
    const weatherPositions = new Float32Array(weatherCount * 3);
    for (let i = 0; i < weatherCount; i++) {
      weatherPositions[i * 3] = (Math.random() - 0.5) * 32;
      weatherPositions[i * 3 + 1] = Math.random() * 24;
      weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 32;
    }
    weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPositions, 3));
    const weatherMat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.18,
      transparent: true,
      opacity: 0.75,
    });
    const weatherPoints = new THREE.Points(weatherGeo, weatherMat);
    weatherPoints.visible = false;
    scene.add(weatherPoints);

    const remoteModels = new Map<string, VoxelCharacterModel>();

    const syncRemotePlayersList = () => {
      const arr: NetworkPlayerPayload[] = [];
      for (const [id, model] of remoteModels.entries()) {
        arr.push({
          id,
          name: model.playerName,
          skin: model.skinId,
          x: model.targetPos.x,
          y: model.targetPos.y,
          z: model.targetPos.z,
          yaw: model.targetYaw,
          pitch: model.targetPitch,
          heldBlockId: 1,
          swinging: false,
          sneaking: false,
          deviceType: model.deviceType,
        });
      }
      setOnlinePlayers(arr);
    };

    // Initialize Dual-Transport Online Multiplayer (WebSocket + WebRTC PeerJS)
    const netManager = new MultiplayerManager(initialRoomFromUrl, selfIdRef.current, {
      onStatusChange: (st) => {
        setNetStatus(st);
      },
      onInitWorld: (data) => {
        selfIdRef.current = data.selfId;
        setWorldSeed(data.seed);
        setTimeOfDay(data.timeOfDay ?? 0.25);
        setWeather(data.weather ?? 'clear');
        if (Array.isArray(data.chatHistory)) {
          setChatMessages(data.chatHistory);
        }

        world.modifiedBlocks.clear();
        if (Array.isArray(data.modifiedBlocks)) {
          for (const [k, bid] of data.modifiedBlocks) {
            world.modifiedBlocks.set(k, bid);
          }
        }
        world.setSeed(data.seed);
        const sy = world.getTerrainHeight(
          Math.floor(playerPosRef.current.x),
          Math.floor(playerPosRef.current.z)
        ).height;
        playerPosRef.current.y = Math.max(sy + 1.05, WATER_LEVEL + 2);
        world.updateChunksAroundPlayer(playerPosRef.current.x, playerPosRef.current.z, 2);
        spawnMobsAndVillagers();

        for (const [, m] of remoteModels.entries()) {
          scene.remove(m.group);
          m.dispose();
        }
        remoteModels.clear();

        if (Array.isArray(data.players)) {
          for (const p of data.players) {
            if (p.id === selfIdRef.current) continue;
            const model = new VoxelCharacterModel(p.name, p.skin, p.deviceType, true);
            model.group.position.set(p.x, p.y, p.z);
            model.targetPos.set(p.x, p.y, p.z);
            model.targetYaw = p.yaw;
            model.targetPitch = p.pitch;
            scene.add(model.group);
            remoteModels.set(p.id, model);
          }
          syncRemotePlayersList();
        }
      },
      onPlayerJoined: (p, chat) => {
        if (p.id !== selfIdRef.current) {
          let model = remoteModels.get(p.id);
          if (!model) {
            model = new VoxelCharacterModel(p.name, p.skin, p.deviceType, true);
            model.group.position.set(p.x, p.y, p.z);
            model.targetPos.set(p.x, p.y, p.z);
            scene.add(model.group);
            remoteModels.set(p.id, model);
          } else {
            model.setName(p.name, p.deviceType);
          }
          syncRemotePlayersList();
        }
        if (chat) {
          setChatMessages((prev) => [...prev.slice(-39), chat]);
        }
      },
      onPlayerMoved: (p) => {
        if (p.id === selfIdRef.current) return;
        let model = remoteModels.get(p.id);
        if (!model) {
          model = new VoxelCharacterModel(p.name, p.skin, p.deviceType, true);
          model.group.position.set(p.x, p.y, p.z);
          scene.add(model.group);
          remoteModels.set(p.id, model);
          syncRemotePlayersList();
        } else if (model.playerName !== p.name) {
          model.setName(p.name, p.deviceType);
          syncRemotePlayersList();
        }
        model.targetPos.set(p.x, p.y, p.z);
        model.targetYaw = p.yaw;
        model.targetPitch = p.pitch;
        if (p.swinging) model.triggerSwing();
      },
      onPlayerSwung: (id) => {
        const model = remoteModels.get(id);
        if (model) model.triggerSwing();
      },
      onPlayerLeft: (id, chat) => {
        const model = remoteModels.get(id);
        if (model) {
          scene.remove(model.group);
          model.dispose();
          remoteModels.delete(id);
          syncRemotePlayersList();
        }
        if (chat) {
          setChatMessages((prev) => [...prev.slice(-39), chat]);
        }
      },
      onBlockUpdated: (x, y, z, blockId) => {
        world.setBlock(x, y, z, blockId, true);
        if (blockId === BlockId.AIR) {
          spawnBlockParticles(x, y, z, 10);
          soundEngine.playBlockBreak();
        } else {
          soundEngine.playBlockPlace();
        }
      },
      onBlockBatchUpdated: (updates) => {
        const dirtyChunks = new Set<string>();
        for (const u of updates) {
          world.setBlock(u.x, u.y, u.z, u.blockId, false);
          const [cx, cz] = world.getChunkCoord(u.x, u.z);
          dirtyChunks.add(`${cx},${cz}`);
          dirtyChunks.add(`${cx - 1},${cz}`);
          dirtyChunks.add(`${cx + 1},${cz}`);
          dirtyChunks.add(`${cx},${cz - 1}`);
          dirtyChunks.add(`${cx},${cz + 1}`);
        }
        for (const ck of dirtyChunks) {
          const [cx, cz] = ck.split(',').map(Number);
          if (world.chunkMeshes.has(ck)) {
            world.rebuildChunkMesh(cx, cz);
          }
        }
        soundEngine.playExplosion();
      },
      onWorldEnvUpdated: (t, w) => {
        setTimeOfDay(t);
        stateRef.current.timeOfDay = t;
        setWeather(w);
      },
      onChatMessage: (chat) => {
        setChatMessages((prev) => [...prev.slice(-39), chat]);
      },
    });

    netManager.connect({
      id: selfIdRef.current,
      name: stateRef.current.playerName,
      skin: stateRef.current.selectedSkin,
      x: playerPosRef.current.x,
      y: playerPosRef.current.y,
      z: playerPosRef.current.z,
      yaw: 0,
      pitch: 0,
      heldBlockId: 1,
      swinging: false,
      sneaking: false,
      deviceType: isTouch ? 'mobile' : 'desktop',
    });
    netRef.current = netManager;

    (window as unknown as { __switchMcRoom?: (r: string) => void }).__switchMcRoom = (newRoom: string) => {
      localPlayerModel.setName(stateRef.current.playerName, isTouch ? 'mobile' : 'desktop');
      netManager.switchRoom(newRoom, {
        id: selfIdRef.current,
        name: stateRef.current.playerName,
        skin: stateRef.current.selectedSkin,
        x: playerPosRef.current.x,
        y: playerPosRef.current.y,
        z: playerPosRef.current.z,
        yaw: yawRef.current,
        pitch: pitchRef.current,
        heldBlockId: 1,
        swinging: false,
        sneaking: false,
        deviceType: isTouch ? 'mobile' : 'desktop',
      });
    };

    const PLAYER_HALF_W = 0.3;
    const PLAYER_HEIGHT = 1.75;
    const PLAYER_EYE_H = 1.62;

    const collidesWithWorld = (px: number, py: number, pz: number): boolean => {
      const minX = Math.floor(px - PLAYER_HALF_W);
      const maxX = Math.floor(px + PLAYER_HALF_W);
      const minY = Math.floor(py);
      const maxY = Math.floor(py + PLAYER_HEIGHT);
      const minZ = Math.floor(pz - PLAYER_HALF_W);
      const maxZ = Math.floor(pz + PLAYER_HALF_W);

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
    };

    const detonateTNT = (tx: number, ty: number, tz: number) => {
      soundEngine.playExplosion();
      spawnBlockParticles(tx, ty, tz, 28, 0xff5533);
      const updates: { x: number; y: number; z: number; blockId: number }[] = [];
      const dirtyChunks = new Set<string>();

      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (dx * dx + dy * dy + dz * dz <= 6) {
              const bx = tx + dx;
              const by = ty + dy;
              const bz = tz + dz;
              if (by >= 1) {
                const bid = world.getBlock(bx, by, bz);
                if (bid !== BlockId.AIR && bid !== BlockId.BEDROCK) {
                  world.setBlock(bx, by, bz, BlockId.AIR, false);
                  updates.push({ x: bx, y: by, z: bz, blockId: BlockId.AIR });
                  const [cx, cz] = world.getChunkCoord(bx, bz);
                  dirtyChunks.add(`${cx},${cz}`);
                  dirtyChunks.add(`${cx - 1},${cz}`);
                  dirtyChunks.add(`${cx + 1},${cz}`);
                  dirtyChunks.add(`${cx},${cz - 1}`);
                  dirtyChunks.add(`${cx},${cz + 1}`);
                }
              }
            }
          }
        }
      }

      for (const ck of dirtyChunks) {
        const [cx, cz] = ck.split(',').map(Number);
        if (world.chunkMeshes.has(ck)) {
          world.rebuildChunkMesh(cx, cz);
        }
      }

      if (updates.length > 0) {
        netManager.sendBlockBatch(updates);
      }
    };

    const openTreasureChest = (cx: number, cy: number, cz: number) => {
      soundEngine.playExplosion();
      spawnBlockParticles(cx, cy, cz, 26, 0xffd700);
      world.setBlock(cx, cy, cz, BlockId.AIR, true);
      netManager.sendBlockUpdate(cx, cy, cz, BlockId.AIR);

      addBlockToInventory(BlockId.DIAMOND_BLOCK, 4);
      addBlockToInventory(BlockId.EMERALD_BLOCK, 8);
      addBlockToInventory(BlockId.GOLD_BLOCK, 6);
      addBlockToInventory(BlockId.TNT, 8);
      setHealth(20);

      const bannerMsg = `🏆 Сундук сокровищ открыт! Получено: +4 Алмазных, +8 Изумрудных, +6 Золотых блоков!`;
      setEventBanner(bannerMsg);
      setTimeout(() => setEventBanner(null), 5500);

      netManager.sendChat(
        `🏆 нашёл и открыл Сундук Сокровищ на (${cx}, ${cz})!`,
        stateRef.current.playerName
      );

      setActiveQuest((prev) => ({ ...prev, foundCount: prev.foundCount + 1 }));
      // Spawn next treasure quest automatically
      setTimeout(() => {
        spawnWorldQuestEvent(Math.random() > 0.4 ? 'treasure' : 'meteor', true);
      }, 1500);
    };

    const toggleVillageDoor = (dx: number, dy: number, dz: number, currentId: number) => {
      const targetId =
        currentId === BlockId.DOOR_CLOSED ? BlockId.DOOR_OPEN : BlockId.DOOR_CLOSED;
      soundEngine.playClick();
      world.setBlock(dx, dy, dz, targetId, true);
      netManager.sendBlockUpdate(dx, dy, dz, targetId);

      // Toggle upper or lower half of the 2-block-tall door automatically
      const aboveId = world.getBlock(dx, dy + 1, dz);
      if (aboveId === BlockId.DOOR_CLOSED || aboveId === BlockId.DOOR_OPEN) {
        world.setBlock(dx, dy + 1, dz, targetId, true);
        netManager.sendBlockUpdate(dx, dy + 1, dz, targetId);
      }
      const belowId = world.getBlock(dx, dy - 1, dz);
      if (belowId === BlockId.DOOR_CLOSED || belowId === BlockId.DOOR_OPEN) {
        world.setBlock(dx, dy - 1, dz, targetId, true);
        netManager.sendBlockUpdate(dx, dy - 1, dz, targetId);
      }
    };

    let handSwingAnim = 0;

    // Attack hostile mobs or trade with villagers on left/right click
    const tryAttackHostileMob = (): boolean => {
      const eyeOrigin = new THREE.Vector3(
        playerPosRef.current.x,
        playerPosRef.current.y + PLAYER_EYE_H,
        playerPosRef.current.z
      );
      camera.getWorldDirection(_rayDir);

      let closestIdx = -1;
      let closestDist = 4.3;

      for (let i = 0; i < hostileMobs.length; i++) {
        const hm = hostileMobs[i];
        const mobCenter = new THREE.Vector3(hm.position.x, hm.position.y + 1.0, hm.position.z);
        const toMob = mobCenter.sub(eyeOrigin);
        const dist = toMob.length();
        if (dist < closestDist) {
          toMob.normalize();
          const dot = toMob.dot(_rayDir);
          if (dot > 0.72) {
            closestDist = dist;
            closestIdx = i;
          }
        }
      }

      if (closestIdx !== -1) {
        const targetMob = hostileMobs[closestIdx];
        soundEngine.playBlockHit(0.65);
        spawnBlockParticles(
          targetMob.position.x,
          targetMob.position.y + 1.0,
          targetMob.position.z,
          10,
          0xcc2222
        );
        const died = targetMob.takeDamage(1, _rayDir);
        if (died) {
          scene.remove(targetMob.group);
          hostileMobs.splice(closestIdx, 1);
          setHostileCount(hostileMobs.length);
          soundEngine.playBlockBreak();
          addBlockToInventory(BlockId.EMERALD_BLOCK, 2);
          addBlockToInventory(BlockId.DIAMOND_ORE, 1);
          setEventBanner(`⚔️ Монстр повержен! Добыча: +2 Изумрудных блока и +1 Алмазная руда`);
          setTimeout(() => setEventBanner(null), 3000);
        }
        return true;
      }
      return false;
    };

    const tryInteractWithVillager = (): boolean => {
      for (const v of villagers) {
        const dist = v.position.distanceTo(playerPosRef.current);
        if (dist <= 4.2) {
          soundEngine.playClick();
          addBlockToInventory(BlockId.EMERALD_BLOCK, 2);
          addBlockToInventory(BlockId.GLOWSTONE, 4);
          setHealth((h) => Math.min(20, h + 4));
          setEventBanner(
            `🤝 ${v.professionName}: «Добро пожаловать в нашу деревню! Держи +2 Изумрудных блока и +4 Светокамня!»`
          );
          setTimeout(() => setEventBanner(null), 4000);
          return true;
        }
      }
      return false;
    };

    const executeBreakBlock = (bx: number, by: number, bz: number, blockId: number) => {
      if (blockId === BlockId.TREASURE_CHEST) {
        openTreasureChest(bx, by, bz);
        return;
      }
      if (BLOCKS[blockId]?.unbreakable && stateRef.current.gameMode !== 'creative') return;
      world.setBlock(bx, by, bz, BlockId.AIR, true);
      spawnBlockParticles(bx, by, bz, 14);
      soundEngine.playBlockBreak();

      const dropId =
        blockId === BlockId.STONE
          ? BlockId.COBBLESTONE
          : blockId === BlockId.DOOR_OPEN
          ? BlockId.DOOR_CLOSED
          : blockId;
      addBlockToInventory(dropId, 1);
      netManager.sendBlockUpdate(bx, by, bz, BlockId.AIR);
    };

    const executePlaceBlock = () => {
      handSwingAnim = 0.26;
      localPlayerModel.triggerSwing();

      // Check villager interaction first if close
      if (tryInteractWithVillager()) return;

      const eyeOrigin = new THREE.Vector3(
        playerPosRef.current.x,
        playerPosRef.current.y + PLAYER_EYE_H,
        playerPosRef.current.z
      );
      camera.getWorldDirection(_rayDir);
      const hit = world.raycastVoxel(eyeOrigin, _rayDir, 6.5);
      if (!hit) return;

      const [hx, hy, hz] = hit.hitBlock;

      // Toggle open/close on village house doors!
      if (hit.blockId === BlockId.DOOR_CLOSED || hit.blockId === BlockId.DOOR_OPEN) {
        toggleVillageDoor(hx, hy, hz, hit.blockId);
        return;
      }

      // Open Treasure Chest on right-click!
      if (hit.blockId === BlockId.TREASURE_CHEST) {
        openTreasureChest(hx, hy, hz);
        return;
      }

      if (hit.blockId === BlockId.CRAFTING_TABLE && !keysRef.current['ShiftLeft']) {
        soundEngine.playClick();
        setShowInventory(true);
        if (document.pointerLockElement) document.exitPointerLock();
        return;
      }
      if (hit.blockId === BlockId.TNT && !keysRef.current['ShiftLeft']) {
        detonateTNT(hx, hy, hz);
        return;
      }

      const slot = stateRef.current.hotbar[stateRef.current.activeSlot];
      if (!slot || slot.blockId === BlockId.AIR || (stateRef.current.gameMode === 'survival' && slot.count <= 0)) {
        return;
      }

      const [px, py, pz] = hit.placeBlock;
      if (py < 0 || py >= 64) return;

      const playerMinX = Math.floor(playerPosRef.current.x - PLAYER_HALF_W);
      const playerMaxX = Math.floor(playerPosRef.current.x + PLAYER_HALF_W);
      const playerMinY = Math.floor(playerPosRef.current.y);
      const playerMaxY = Math.floor(playerPosRef.current.y + PLAYER_HEIGHT);
      const playerMinZ = Math.floor(playerPosRef.current.z - PLAYER_HALF_W);
      const playerMaxZ = Math.floor(playerPosRef.current.z + PLAYER_HALF_W);

      if (
        px >= playerMinX &&
        px <= playerMaxX &&
        py >= playerMinY &&
        py <= playerMaxY &&
        pz >= playerMinZ &&
        pz <= playerMaxZ &&
        !BLOCKS[slot.blockId]?.passable
      ) {
        return;
      }

      world.setBlock(px, py, pz, slot.blockId, true);
      soundEngine.playBlockPlace();

      // If placing a door, also place upper half if air
      if (slot.blockId === BlockId.DOOR_CLOSED && world.getBlock(px, py + 1, pz) === BlockId.AIR) {
        world.setBlock(px, py + 1, pz, BlockId.DOOR_CLOSED, true);
        netManager.sendBlockUpdate(px, py + 1, pz, BlockId.DOOR_CLOSED);
      }

      if (stateRef.current.gameMode === 'survival') {
        setHotbar((prev) => {
          const next = prev.map((s) => ({ ...s }));
          const cur = next[stateRef.current.activeSlot];
          if (cur && cur.count > 0) {
            cur.count -= 1;
          }
          return next;
        });
      }

      netManager.sendBlockUpdate(px, py, pz, slot.blockId);
    };

    triggerActionRef.current = {
      breakBlock: () => {
        handSwingAnim = 0.26;
        localPlayerModel.triggerSwing();
        if (tryAttackHostileMob()) return;
        const eyeOrigin = new THREE.Vector3(
          playerPosRef.current.x,
          playerPosRef.current.y + PLAYER_EYE_H,
          playerPosRef.current.z
        );
        camera.getWorldDirection(_rayDir);
        const hit = world.raycastVoxel(eyeOrigin, _rayDir, 6.5);
        if (hit) {
          executeBreakBlock(hit.hitBlock[0], hit.hitBlock[1], hit.hitBlock[2], hit.blockId);
        }
      },
      placeBlock: executePlaceBlock,
      spawnEvent: (eventType = 'treasure') => spawnWorldQuestEvent(eventType, true),
    };

    const onPointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === renderer.domElement);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      const sensitivity = 0.0022;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current = Math.max(
        -Math.PI / 2 + 0.05,
        Math.min(Math.PI / 2 - 0.05, pitchRef.current - e.movementY * sensitivity)
      );
    };

    let lastSpacePress = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        stateRef.current.showChat ||
        stateRef.current.inTitleScreen ||
        stateRef.current.showGithubModal
      ) {
        if (e.code === 'Escape') {
          setShowChat(false);
          setShowInventory(false);
          setShowGithubModal(false);
        }
        return;
      }

      keysRef.current[e.code] = true;

      if (e.code === 'Space' && !e.repeat) {
        const now = performance.now();
        if (now - lastSpacePress < 300) {
          setIsFlying((f) => !f);
          playerVelRef.current.y = 0;
        }
        lastSpacePress = now;
      }

      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          setActiveSlot(num - 1);
          soundEngine.playClick();
        }
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        setShowInventory((prev) => {
          const next = !prev;
          if (next && document.pointerLockElement) document.exitPointerLock();
          return next;
        });
      } else if (e.code === 'KeyT' || e.code === 'Enter') {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        setShowChat(true);
      } else if (e.code === 'KeyF') {
        setIsFlying((f) => !f);
        playerVelRef.current.y = 0;
      } else if (e.code === 'KeyV' || e.code === 'F5') {
        e.preventDefault();
        setCameraMode((m) =>
          m === 'first' ? 'third-back' : m === 'third-back' ? 'third-front' : 'first'
        );
      } else if (e.code === 'KeyH') {
        setDockCollapsed((c) => !c);
      } else if (e.code === 'KeyC') {
        setGameMode((m) => (m === 'survival' ? 'creative' : 'survival'));
      } else if (e.code === 'KeyM') {
        setShowMiniMap((m) => !m);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (
        stateRef.current.inTitleScreen ||
        stateRef.current.showGithubModal ||
        stateRef.current.showInventory ||
        stateRef.current.showChat
      ) {
        return;
      }
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
        return;
      }
      if (e.button === 0) {
        mouseDownLeftRef.current = true;
        handSwingAnim = 0.26;
        localPlayerModel.triggerSwing();
        netManager.sendSwing();
        tryAttackHostileMob();
      } else if (e.button === 2) {
        executePlaceBlock();
      } else if (e.button === 1) {
        const eyeOrigin = new THREE.Vector3(
          playerPosRef.current.x,
          playerPosRef.current.y + PLAYER_EYE_H,
          playerPosRef.current.z
        );
        camera.getWorldDirection(_rayDir);
        const hit = world.raycastVoxel(eyeOrigin, _rayDir, 6.5);
        if (hit && hit.blockId !== BlockId.AIR) {
          addBlockToInventory(hit.blockId, 16);
          soundEngine.playClick();
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDownLeftRef.current = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (stateRef.current.showInventory || stateRef.current.showChat || stateRef.current.showGithubModal) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      setActiveSlot((prev) => (prev + dir + 9) % 9);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    // Mini-map 2D canvas renderer
    const drawMiniMap = () => {
      const canvas = miniMapCanvasRef.current;
      if (!canvas || !stateRef.current.showMiniMap) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      const halfW = W / 2;
      const halfH = H / 2;
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;

      ctx.fillStyle = '#101820';
      ctx.fillRect(0, 0, W, H);

      // Sample terrain grid around player (radius 48 blocks, step 3 blocks)
      const range = 48;
      const step = 3;
      const scale = halfW / range;

      for (let dz = -range; dz <= range; dz += step) {
        for (let dx = -range; dx <= range; dx += step) {
          const wx = Math.floor(px + dx);
          const wz = Math.floor(pz + dz);
          const info = world.getTerrainHeight(wx, wz);
          if (info.height <= WATER_LEVEL) {
            ctx.fillStyle = '#1e4d8c';
          } else if (info.biome === 'desert') {
            ctx.fillStyle = '#c2b267';
          } else if (info.biome === 'snow') {
            ctx.fillStyle = '#d9e3ec';
          } else if (info.biome === 'forest') {
            ctx.fillStyle = '#2d6326';
          } else {
            ctx.fillStyle = '#4c8527';
          }
          const sx = halfW + dx * scale;
          const sy = halfH + dz * scale;
          ctx.fillRect(sx, sy, Math.ceil(step * scale), Math.ceil(step * scale));
        }
      }

      // Helper to project world coords onto radar (clamped to border if far away)
      const projectPoint = (wx: number, wz: number) => {
        const dx = (wx - px) * scale;
        const dz = (wz - pz) * scale;
        const dist = Math.hypot(dx, dz);
        const maxR = halfW - 10;
        if (dist > maxR) {
          const ratio = maxR / dist;
          return { x: halfW + dx * ratio, y: halfH + dz * ratio, clamped: true };
        }
        return { x: halfW + dx, y: halfH + dz, clamped: false };
      };

      // 1. Draw Villages (Emerald House icons)
      for (const vc of VoxelWorld.VILLAGE_CENTERS) {
        const pt = projectPoint(vc.x, vc.z);
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.clamped ? 4.5 : 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 2. Draw World Spawn (0, 0) Star/Cross
      const spawnPt = projectPoint(0, 0);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.fillRect(spawnPt.x - 4, spawnPt.y - 4, 8, 8);
      ctx.strokeRect(spawnPt.x - 4, spawnPt.y - 4, 8, 8);

      // 3. Draw Active Treasure Hunt / Meteor Quest (Gold X)
      const q = stateRef.current.activeQuest;
      const questPt = projectPoint(q.x, q.z);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(questPt.x - 5, questPt.y - 5);
      ctx.lineTo(questPt.x + 5, questPt.y + 5);
      ctx.moveTo(questPt.x + 5, questPt.y - 5);
      ctx.lineTo(questPt.x - 5, questPt.y + 5);
      ctx.stroke();

      // 4. Draw Hostile Mobs (Red dots)
      ctx.fillStyle = '#ef4444';
      for (const hm of hostileMobs) {
        const pt = projectPoint(hm.position.x, hm.position.z);
        if (!pt.clamped) {
          ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
        }
      }

      // 5. Draw Remote Online Players (Cyan dots)
      ctx.fillStyle = '#22d3ee';
      for (const [, rm] of remoteModels.entries()) {
        const pt = projectPoint(rm.group.position.x, rm.group.position.z);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Draw Local Player & View Direction Cone at center
      ctx.save();
      ctx.translate(halfW, halfH);
      // Player look direction in world: (-sin(yaw), -cos(yaw))
      const angle = Math.atan2(-Math.cos(yawRef.current), -Math.sin(yawRef.current));
      ctx.rotate(angle);

      // View cone
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 22, -0.45, 0.45);
      ctx.closePath();
      ctx.fill();

      // Player arrow
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Cardinal letters N/S/W/E
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText('N', halfW, 10);
      ctx.fillStyle = '#d4d4d8';
      ctx.fillText('S', halfW, H - 3);
      ctx.fillText('W', 7, halfH + 3);
      ctx.fillText('E', W - 7, halfH + 3);
    };

    const clock = new THREE.Clock();
    let currentMiningTargetKey = '';
    let currentMiningTimer = 0;
    let stepSoundAccum = 0;
    let chunkSyncAccum = 0;
    let networkSendAccum = 0;
    let uiCoordAccum = 0;
    let walkBobTimer = 0;
    let hostileSpawnAccum = 0;

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

      // Update local player overhead nickname if changed
      localPlayerModel.setName(st.playerName, isTouch ? 'mobile' : 'desktop');

      // Automatic Day/Night Cycle progression
      if (st.autoDayNight) {
        const nextTime = (st.timeOfDay + delta * 0.0045) % 1;
        st.timeOfDay = nextTime;
      }

      const isNight = st.timeOfDay >= 0.55 || st.timeOfDay <= 0.05;

      // Nighttime Hostile Mob Spawning & Daytime Burn
      hostileSpawnAccum += delta;
      if (hostileSpawnAccum > 3.5) {
        hostileSpawnAccum = 0;
        if (isNight && hostileMobs.length < 9 && !st.inTitleScreen) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 12 + Math.random() * 14;
          const mx = Math.floor(playerPosRef.current.x + Math.cos(angle) * dist);
          const mz = Math.floor(playerPosRef.current.z + Math.sin(angle) * dist);
          const my = world.getTerrainHeight(mx, mz).height + 1;
          if (my > WATER_LEVEL + 1) {
            const kind = Math.random() > 0.4 ? 'zombie' : 'creeper';
            const hm = new HostileMobModel(kind, mx + 0.5, my, mz + 0.5);
            scene.add(hm.group);
            hostileMobs.push(hm);
            setHostileCount(hostileMobs.length);
          }
        } else if (!isNight && hostileMobs.length > 2) {
          // Daylight despawns excess night monsters
          const burned = hostileMobs.pop();
          if (burned) {
            spawnBlockParticles(burned.position.x, burned.position.y + 1, burned.position.z, 8, 0xff8800);
            scene.remove(burned.group);
            setHostileCount(hostileMobs.length);
          }
        }
      }

      const activeBlockId = st.hotbar[st.activeSlot]?.blockId || BlockId.GRASS;
      updateHeldBlockUV(activeBlockId);

      const sunAngle = (st.timeOfDay - 0.25) * Math.PI * 2;
      const sunY = Math.cos(sunAngle);
      const sunX = Math.sin(sunAngle);

      celestialGroup.position.copy(playerPosRef.current);
      sunMesh.position.set(sunX * 90, sunY * 90, -25);
      moonMesh.position.set(-sunX * 90, -sunY * 90, 25);

      sunLight.position.set(
        playerPosRef.current.x + sunX * 50,
        playerPosRef.current.y + Math.max(12, Math.abs(sunY) * 75),
        playerPosRef.current.z + 25
      );
      sunLight.target.position.copy(playerPosRef.current);
      sunLight.target.updateMatrixWorld();

      if (sunY > 0.2) {
        _curSky.copy(_skyDay);
        sunLight.intensity = 1.15;
        hemiLight.intensity = 0.8;
      } else if (sunY > -0.15) {
        const t = (sunY + 0.15) / 0.35;
        _curSky.lerpColors(_skySunset, _skyDay, t);
        sunLight.intensity = 0.45 + t * 0.7;
        hemiLight.intensity = 0.45 + t * 0.35;
      } else {
        const t = Math.min(1, (-sunY - 0.15) / 0.3);
        _curSky.lerpColors(_skySunset, _skyNight, t);
        sunLight.intensity = 0.22;
        hemiLight.intensity = 0.32;
      }

      if (st.weather !== 'clear') {
        _curSky.lerp(new THREE.Color('#5a6978'), 0.45);
      }

      (scene.background as THREE.Color).copy(_curSky);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_curSky);
      }

      for (let i = 0; i < cloudCount; i++) {
        const c = cloudOffsets[i];
        const wrappedX =
          playerPosRef.current.x +
          ((((c.x + elapsed * 1.4 - playerPosRef.current.x + 96) % 192) + 192) % 192) -
          96;
        const wrappedZ =
          playerPosRef.current.z +
          ((((c.z - playerPosRef.current.z + 96) % 192) + 192) % 192) -
          96;
        cloudDummy.position.set(wrappedX, 46, wrappedZ);
        cloudDummy.scale.set(c.scaleX, 1, c.scaleZ);
        cloudDummy.updateMatrix();
        cloudInstanced.setMatrixAt(i, cloudDummy.matrix);
      }
      cloudInstanced.instanceMatrix.needsUpdate = true;

      const keys = keysRef.current;
      const isSneaking = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
      const isSprinting = Boolean(keys['ControlLeft'] || keys['KeyR']);

      let moveZ = 0;
      let moveX = 0;
      if (!st.inTitleScreen && !st.showGithubModal && !st.showChat && !st.showInventory) {
        if (keys['KeyW'] || keys['ArrowUp']) moveZ += 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveZ -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;

        moveX += touchMoveVecRef.current.x;
        moveZ += touchMoveVecRef.current.y;
      }

      _forward.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current)).normalize();
      _right.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current)).normalize();

      const wishDir = new THREE.Vector3();
      wishDir.addScaledVector(_forward, moveZ);
      wishDir.addScaledVector(_right, moveX);
      if (wishDir.lengthSq() > 1) wishDir.normalize();

      const inWater =
        world.getBlock(
          playerPosRef.current.x,
          playerPosRef.current.y + 0.5,
          playerPosRef.current.z
        ) === BlockId.WATER;

      let speed = isSprinting ? 6.8 : isSneaking ? 2.4 : 4.6;
      if (st.isFlying) speed = isSprinting ? 14.0 : 9.0;
      else if (inWater) speed *= 0.65;

      playerVelRef.current.x = wishDir.x * speed;
      playerVelRef.current.z = wishDir.z * speed;

      const onGround = collidesWithWorld(
        playerPosRef.current.x,
        playerPosRef.current.y - 0.06,
        playerPosRef.current.z
      );

      if (st.isFlying) {
        let vy = 0;
        if (keys['Space']) vy += 6.5;
        if (isSneaking) vy -= 6.5;
        playerVelRef.current.y = vy;
      } else if (inWater) {
        playerVelRef.current.y -= 7.5 * delta;
        if (keys['Space']) playerVelRef.current.y = 3.8;
        playerVelRef.current.y = Math.max(-3.5, playerVelRef.current.y);
      } else {
        playerVelRef.current.y -= 24.0 * delta;
        playerVelRef.current.y = Math.max(-36.0, playerVelRef.current.y);
        if (
          keys['Space'] &&
          onGround &&
          !st.inTitleScreen &&
          !st.showGithubModal &&
          !st.showChat &&
          !st.showInventory
        ) {
          playerVelRef.current.y = 8.4;
        }
      }

      const nextX = playerPosRef.current.x + playerVelRef.current.x * delta;
      if (!collidesWithWorld(nextX, playerPosRef.current.y, playerPosRef.current.z)) {
        playerPosRef.current.x = nextX;
      }

      const nextZ = playerPosRef.current.z + playerVelRef.current.z * delta;
      if (!collidesWithWorld(playerPosRef.current.x, playerPosRef.current.y, nextZ)) {
        playerPosRef.current.z = nextZ;
      }

      const nextY = playerPosRef.current.y + playerVelRef.current.y * delta;
      if (!collidesWithWorld(playerPosRef.current.x, nextY, playerPosRef.current.z)) {
        playerPosRef.current.y = nextY;
      } else {
        if (playerVelRef.current.y < -13.5 && st.gameMode === 'survival' && !st.isFlying && !inWater) {
          const dmg = Math.max(1, Math.floor((Math.abs(playerVelRef.current.y) - 13) * 0.8));
          setHealth((h) => Math.max(2, h - dmg));
          soundEngine.playBlockHit(0.7);
        }
        playerVelRef.current.y = 0;
      }

      if (playerPosRef.current.y < -10) {
        const sy = world.getTerrainHeight(0, 0).height;
        playerPosRef.current.set(0.5, sy + 2, 0.5);
        playerVelRef.current.set(0, 0, 0);
      }

      const isMovingHoriz = wishDir.lengthSq() > 0.05;
      if (isMovingHoriz && onGround && !st.isFlying) {
        walkBobTimer += delta * (isSprinting ? 13 : 9);
        stepSoundAccum += delta;
        if (stepSoundAccum > (isSprinting ? 0.32 : 0.45)) {
          stepSoundAccum = 0;
          soundEngine.playStep();
        }
      } else {
        walkBobTimer = 0;
      }

      const eyeY = playerPosRef.current.y + (isSneaking ? 1.42 : PLAYER_EYE_H);
      const bobY = Math.sin(walkBobTimer * 2) * 0.045;
      const bobX = Math.cos(walkBobTimer) * 0.03;

      if (st.cameraMode === 'first') {
        localPlayerModel.group.visible = false;
        fpHandGroup.visible = true;
        camera.position.set(
          playerPosRef.current.x + bobX,
          eyeY + bobY,
          playerPosRef.current.z
        );
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yawRef.current;
        camera.rotation.x = pitchRef.current;
      } else {
        localPlayerModel.group.visible = true;
        fpHandGroup.visible = false;
        localPlayerModel.targetPos.copy(playerPosRef.current);
        localPlayerModel.targetYaw = yawRef.current;
        localPlayerModel.targetPitch = pitchRef.current;
        localPlayerModel.update(delta, isMovingHoriz, isSneaking);

        const dist = st.cameraMode === 'third-back' ? 3.8 : -3.5;
        const lookDir = new THREE.Vector3(
          -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
          Math.sin(pitchRef.current),
          -Math.cos(yawRef.current) * Math.cos(pitchRef.current)
        );
        _camTarget.set(playerPosRef.current.x, eyeY, playerPosRef.current.z);
        camera.position.copy(_camTarget).addScaledVector(lookDir, -dist);
        camera.lookAt(_camTarget);
      }

      if (handSwingAnim > 0) {
        handSwingAnim = Math.max(0, handSwingAnim - delta);
        const s = Math.sin(((0.26 - handSwingAnim) / 0.26) * Math.PI);
        fpBlockMesh.position.set(0.38 - s * 0.16, -0.32 - s * 0.14, -0.52 - s * 0.18);
        fpBlockMesh.rotation.set(0.2 - s * 0.9, -0.65 + s * 0.5, -0.1 - s * 0.4);
      } else {
        fpBlockMesh.position.set(
          0.38 + Math.cos(walkBobTimer) * 0.02,
          -0.32 + Math.sin(walkBobTimer * 2) * 0.025 + Math.sin(elapsed * 2) * 0.008,
          -0.52
        );
        fpBlockMesh.rotation.set(0.2, -0.65, -0.1);
      }

      const eyeOrigin = new THREE.Vector3(playerPosRef.current.x, eyeY, playerPosRef.current.z);
      const lookVec = new THREE.Vector3(
        -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        Math.sin(pitchRef.current),
        -Math.cos(yawRef.current) * Math.cos(pitchRef.current)
      ).normalize();

      const hit = world.raycastVoxel(eyeOrigin, lookVec, 6.5);
      if (hit) {
        const [hx, hy, hz] = hit.hitBlock;
        selectionBox.position.set(hx + 0.5, hy + 0.5, hz + 0.5);
        selectionBox.visible = true;

        const bDef = BLOCKS[hit.blockId];
        setTargetBlockName(bDef ? bDef.nameRu : null);

        if (mouseDownLeftRef.current && document.pointerLockElement === renderer.domElement) {
          if (handSwingAnim <= 0) handSwingAnim = 0.26;
          const targetKey = `${hx},${hy},${hz}`;
          if (targetKey !== currentMiningTargetKey) {
            currentMiningTargetKey = targetKey;
            currentMiningTimer = 0;
          }

          const breakDuration = st.gameMode === 'creative' ? 0.08 : (bDef?.hardness || 0.8) * 0.55;
          currentMiningTimer += delta;

          if (Math.floor(currentMiningTimer * 10) !== Math.floor((currentMiningTimer - delta) * 10)) {
            soundEngine.playBlockHit(0.9 + Math.random() * 0.2);
          }

          const progress = Math.min(1, currentMiningTimer / breakDuration);
          setMiningProgress(progress);

          crackMesh.position.set(hx + 0.5, hy + 0.5, hz + 0.5);
          crackMesh.visible = true;
          crackMat.opacity = progress * 0.75;

          if (progress >= 1) {
            executeBreakBlock(hx, hy, hz, hit.blockId);
            currentMiningTimer = 0;
            setMiningProgress(0);
            crackMesh.visible = false;
          }
        } else {
          currentMiningTimer = 0;
          setMiningProgress(0);
          crackMesh.visible = false;
        }
      } else {
        selectionBox.visible = false;
        crackMesh.visible = false;
        setTargetBlockName(null);
        setMiningProgress(0);
      }

      for (const [, model] of remoteModels.entries()) {
        const distSq = model.group.position.distanceToSquared(model.targetPos);
        model.update(delta, distSq > 0.002, false);
      }

      const groundFn = (x: number, z: number) =>
        world.getTerrainHeight(Math.floor(x), Math.floor(z)).height + 1;

      for (const mob of mobs) {
        mob.update(delta, groundFn);
      }

      for (const v of villagers) {
        v.update(delta, playerPosRef.current, groundFn);
      }

      for (const hm of hostileMobs) {
        hm.update(delta, playerPosRef.current, groundFn, (dmg) => {
          if (st.gameMode === 'survival' && !st.inTitleScreen) {
            soundEngine.playBlockHit(0.5);
            setHealth((h) => {
              const nextH = h - dmg;
              if (nextH <= 0) {
                const sy = world.getTerrainHeight(0, 0).height;
                playerPosRef.current.set(0.5, sy + 2, 0.5);
                setEventBanner('💀 Вы погибли в бою с ночными монстрами! Возрождение на спавне (0, 0).');
                setTimeout(() => setEventBanner(null), 4000);
                return 20;
              }
              return nextH;
            });
          }
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= delta;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          particles.splice(i, 1);
        } else {
          p.vel.y -= 16 * delta;
          p.mesh.position.addScaledVector(p.vel, delta);
          p.mesh.rotation.x += 5 * delta;
          p.mesh.rotation.y += 5 * delta;
        }
      }

      if (st.weather !== 'clear') {
        weatherPoints.visible = true;
        weatherMat.color.set(st.weather === 'snow' ? 0xffffff : 0x77b5fe);
        const posArr = weatherGeo.attributes.position.array as Float32Array;
        const fallSpeed = st.weather === 'snow' ? 3.5 : 16.0;
        for (let i = 0; i < weatherCount; i++) {
          posArr[i * 3 + 1] -= fallSpeed * delta;
          if (posArr[i * 3 + 1] < 0) {
            posArr[i * 3 + 1] = 24;
          }
        }
        weatherGeo.attributes.position.needsUpdate = true;
        weatherPoints.position.set(
          playerPosRef.current.x,
          playerPosRef.current.y - 4,
          playerPosRef.current.z
        );
      } else {
        weatherPoints.visible = false;
      }

      chunkSyncAccum += delta;
      if (chunkSyncAccum > 0.6) {
        chunkSyncAccum = 0;
        world.updateChunksAroundPlayer(playerPosRef.current.x, playerPosRef.current.z, 2);
      }

      networkSendAccum += delta;
      if (networkSendAccum > 0.05) {
        networkSendAccum = 0;
        netManager.sendPlayerMove({
          id: selfIdRef.current,
          name: st.playerName,
          skin: st.selectedSkin,
          x: Number(playerPosRef.current.x.toFixed(2)),
          y: Number(playerPosRef.current.y.toFixed(2)),
          z: Number(playerPosRef.current.z.toFixed(2)),
          yaw: Number(yawRef.current.toFixed(3)),
          pitch: Number(pitchRef.current.toFixed(3)),
          heldBlockId: activeBlockId,
          swinging: handSwingAnim > 0,
          sneaking: isSneaking,
          deviceType: isTouch ? 'mobile' : 'desktop',
        });
      }

      uiCoordAccum += delta;
      if (uiCoordAccum > 0.2) {
        uiCoordAccum = 0;
        const bx = Math.floor(playerPosRef.current.x);
        const by = Math.floor(playerPosRef.current.y);
        const bz = Math.floor(playerPosRef.current.z);
        const bInfo = world.getTerrainHeight(bx, bz);
        const biomeMap: Record<string, string> = {
          plains: 'Равнины',
          forest: 'Дубовый лес',
          desert: 'Пустыня',
          snow: 'Снежная тундра',
        };
        setCoords({
          x: bx,
          y: by,
          z: bz,
          biome: biomeMap[bInfo.biome] || 'Равнины',
        });
        if (st.autoDayNight) {
          setTimeOfDay(st.timeOfDay);
        }
        drawMiniMap();
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      netManager.dispose();
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [addBlockToInventory, initialRoomFromUrl]);

  const handleSwitchRoom = (e?: React.FormEvent, targetRoomOverride?: string) => {
    if (e) e.preventDefault();
    const trimmedName = playerName.trim() || `Игрок_${Math.floor(100 + Math.random() * 899)}`;
    setPlayerName(trimmedName);
    stateRef.current.playerName = trimmedName;

    const raw = targetRoomOverride ?? roomInput;
    const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') || 'overworld-1';
    setRoomId(cleaned);
    setRoomInput(cleaned);
    const url = new URL(window.location.href);
    url.searchParams.set('room', cleaned);
    window.history.replaceState({}, '', url.toString());
    const switchFn = (window as unknown as { __switchMcRoom?: (r: string) => void }).__switchMcRoom;
    if (switchFn) switchFn(cleaned);
    setInTitleScreen(false);
    soundEngine.playClick();
  };

  const touchLookRef = useRef<{ id: number; lastX: number; lastY: number } | null>(null);

  const handleTouchLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    touchLookRef.current = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
  };

  const handleTouchLookMove = (e: React.TouchEvent) => {
    if (!touchLookRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchLookRef.current.id) {
        const dx = t.clientX - touchLookRef.current.lastX;
        const dy = t.clientY - touchLookRef.current.lastY;
        touchLookRef.current.lastX = t.clientX;
        touchLookRef.current.lastY = t.clientY;
        yawRef.current -= dx * 0.0055;
        pitchRef.current = Math.max(
          -Math.PI / 2 + 0.05,
          Math.min(Math.PI / 2 - 0.05, pitchRef.current - dy * 0.0055)
        );
      }
    }
  };

  const handleTouchLookEnd = () => {
    touchLookRef.current = null;
  };

  const currentSlot = hotbar[activeSlot];
  const currentBlockDef = currentSlot ? BLOCKS[currentSlot.blockId] : null;
  const isNightTime = timeOfDay >= 0.55 || timeOfDay <= 0.05;
  const distToQuest = Math.round(
    Math.hypot(activeQuest.x - coords.x, activeQuest.z - coords.z)
  );
  const distToSpawn = Math.round(Math.hypot(coords.x, coords.z));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#111] select-none">
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Mobile Touch Look Zone */}
      {isTouchDevice && !inTitleScreen && !showGithubModal && !showInventory && !showChat && (
        <div
          className="absolute top-14 right-0 w-1/2 bottom-36 z-10"
          onTouchStart={handleTouchLookStart}
          onTouchMove={handleTouchLookMove}
          onTouchEnd={handleTouchLookEnd}
        />
      )}

      {/* Event / Achievement Banner Notification */}
      {eventBanner && !inTitleScreen && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-black/90 border-2 border-amber-400 px-4 py-2 text-xs font-bold text-amber-200 shadow-2xl text-center max-w-md">
          {eventBanner}
        </div>
      )}

      {/* Center Crosshair & Mining Progress Bar */}
      {!inTitleScreen && !showGithubModal && !showInventory && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div className="w-4 h-0.5 bg-white/90 shadow-[0_0_2px_#000]" />
            <div className="absolute h-4 w-0.5 bg-white/90 shadow-[0_0_2px_#000]" />
          </div>
          {miningProgress > 0 && (
            <div className="mt-3 w-20 h-1.5 bg-black/70 border border-white/30 overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.round(miningProgress * 100)}%` }}
              />
            </div>
          )}
          {targetBlockName && (
            <div className="mt-2 px-2 py-0.5 bg-black/60 text-[11px] font-mono-tabular text-neutral-200 border border-white/15">
              {targetBlockName}
            </div>
          )}
        </div>
      )}

      {/* Top-Left Spec Bar + Survival HUD Mini-Map */}
      <div className="pointer-events-auto absolute top-3 left-3 z-20 flex flex-col items-start gap-2 max-w-[92vw]">
        <div className="flex flex-wrap items-center gap-2 bg-black/80 border border-white/15 px-3 py-1.5 text-xs text-neutral-200">
          <button
            onClick={() => {
              if (document.pointerLockElement) document.exitPointerLock();
              setInTitleScreen(true);
            }}
            className="font-pixel text-[11px] text-emerald-400 hover:text-emerald-300 tracking-tight cursor-pointer whitespace-nowrap"
          >
            MINECRAFT ONLINE
          </button>
          <span aria-hidden="true" className="text-neutral-500">·</span>
          <span className="font-mono-tabular text-white font-semibold whitespace-nowrap">
            Ник: {playerName}
          </span>
          <span aria-hidden="true" className="text-neutral-500">·</span>
          <span className="font-mono-tabular whitespace-nowrap">
            XYZ: {coords.x} / {coords.y} / {coords.z}
          </span>
          <span aria-hidden="true" className="text-neutral-500">·</span>
          <button
            onClick={() => {
              if (document.pointerLockElement) document.exitPointerLock();
              setInTitleScreen(true);
            }}
            className="font-mono-tabular text-amber-300 hover:underline cursor-pointer whitespace-nowrap flex items-center gap-1"
            title="Сменить никнейм или онлайн-комнату"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Сервер: {roomId} ({onlinePlayers.length + 1} игр.)
            </span>
          </button>

          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1 px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
            title="Скопировать ссылку для приглашения друга в этот мир"
          >
            {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copiedLink ? 'Ссылка скопирована' : 'Пригласить по ссылке'}</span>
          </button>
        </div>

        {/* Survival HUD Mini-Map & World Navigation Radar */}
        {!inTitleScreen && showMiniMap && (
          <div className="bg-black/85 border-2 border-neutral-600 p-2 w-48 text-[11px] text-neutral-200 shadow-xl space-y-1.5">
            <div className="flex items-center justify-between border-b border-white/15 pb-1">
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                <span>МИНИ-КАРТА [M]</span>
              </span>
              <span className="font-mono-tabular text-[10px] text-neutral-400">
                Спавн: {distToSpawn}м
              </span>
            </div>

            <div className="relative flex items-center justify-center">
              <canvas
                ref={miniMapCanvasRef}
                width={156}
                height={156}
                className="w-[156px] h-[156px] border border-white/25 pixelated"
              />
            </div>

            {/* Map Legend */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-neutral-300">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-sky-400 inline-block" />
                <span>Спавн (0,0)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span>Деревни (3)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-400 inline-block" />
                <span>Клад ({distToQuest}м)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 inline-block" />
                <span>Мобы ({hostileCount})</span>
              </div>
            </div>

            {/* Quick Navigation & Village Teleport Buttons */}
            <div className="pt-1 border-t border-white/15 flex flex-wrap gap-1">
              <button
                onClick={() => teleportPlayerTo(0, 0, 'Спавн мира')}
                className="flex-1 px-1.5 py-1 bg-sky-900/70 hover:bg-sky-800 border border-sky-400/40 text-[10px] text-sky-200 cursor-pointer text-center"
                title="Вернуться на точку спавна (0, 0)"
              >
                На Спавн
              </button>
              <button
                onClick={() => teleportPlayerTo(40, -34, 'Северная Деревня')}
                className="flex-1 px-1.5 py-1 bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-400/40 text-[10px] text-emerald-200 cursor-pointer text-center"
                title="Переместиться к Северной Деревне с жителями и домами"
              >
                В Деревню
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pointer Lock Prompt Pill */}
      {!isPointerLocked &&
        !isTouchDevice &&
        !inTitleScreen &&
        !showGithubModal &&
        !showInventory &&
        !showChat && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-black/80 border border-amber-400/40 px-4 py-1.5 text-xs text-amber-200 whitespace-nowrap">
            Кликните по 3D-миру для игры (ПКМ по двери — открыть/закрыть, ПКМ по сундуку — забрать клад)
          </div>
        )}

      {/* Live Multiplayer Chat Box + Active World Event Card (Top-Right overlay) */}
      <div className="pointer-events-auto absolute top-3 right-3 z-20 w-72 max-w-[85vw] flex flex-col items-end gap-2">
        <div className="w-full bg-black/75 border border-white/15 p-2 text-xs space-y-1 max-h-32 overflow-y-auto">
          {chatMessages.slice(-6).map((msg) => (
            <div key={msg.id} className="leading-snug break-words">
              <span
                className={
                  msg.system ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'
                }
              >
                {msg.sender}:{' '}
              </span>
              <span className="text-neutral-200">{msg.text}</span>
            </div>
          ))}
        </div>
        {showChat ? (
          <form onSubmit={handleSendChat} className="w-full flex gap-1">
            <input
              type="text"
              autoFocus
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Чат или сообщение друзьям..."
              className="flex-1 bg-black/90 border border-white/30 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
            >
              Отпр.
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowChat(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-black/75 hover:bg-black/90 border border-white/15 text-[11px] text-neutral-300 cursor-pointer whitespace-nowrap"
          >
            <MessageSquare className="w-3 h-3 text-emerald-400" />
            <span>Онлайн-чат [T]</span>
          </button>
        )}

        {/* Active Treasure Hunt / World Event HUD Card */}
        {!inTitleScreen && (
          <div className="w-full bg-black/85 border border-amber-400/50 p-2.5 text-xs text-neutral-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>ИВЕНТ: {activeQuest.title}</span>
              </span>
              <span className="px-1.5 py-0.5 bg-amber-900/70 text-amber-200 text-[10px] font-mono-tabular">
                Найдено: {activeQuest.foundCount}
              </span>
            </div>
            <div className="text-[11px] text-neutral-300 font-mono-tabular flex items-center justify-between">
              <span>
                Цель: X:{activeQuest.x} Z:{activeQuest.z}
              </span>
              <span className="text-emerald-300 font-bold">До клада: {distToQuest} м</span>
            </div>
            <div className="flex items-center gap-1 pt-0.5">
              <button
                onClick={() => triggerActionRef.current.spawnEvent('treasure')}
                className="flex-1 px-2 py-1 bg-amber-800/80 hover:bg-amber-700 border border-amber-400/40 text-[10px] text-white font-semibold cursor-pointer"
                title="Спрятать новый сундук с сокровищами"
              >
                Новый клад
              </button>
              <button
                onClick={() => triggerActionRef.current.spawnEvent('meteor')}
                className="flex-1 px-2 py-1 bg-purple-900/80 hover:bg-purple-800 border border-purple-400/40 text-[10px] text-white font-semibold cursor-pointer"
                title="Вызвать падение метеорита с рудой и сокровищами"
              >
                Метеорит
              </button>
              <button
                onClick={() =>
                  teleportPlayerTo(activeQuest.x, activeQuest.z + 2, activeQuest.title)
                }
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 border border-white/20 text-[10px] text-amber-200 cursor-pointer"
                title="Переместиться к месту ивента"
              >
                К цели
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      {isTouchDevice && !inTitleScreen && !showGithubModal && !showInventory && (
        <>
          <div className="pointer-events-auto absolute bottom-28 left-4 z-20 grid grid-cols-3 gap-1.5 w-36 h-36">
            <div />
            <button
              onTouchStart={() => (touchMoveVecRef.current.y = 1)}
              onTouchEnd={() => (touchMoveVecRef.current.y = 0)}
              className="mc-btn flex items-center justify-center text-sm font-bold text-white active:bg-emerald-700"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={() => (touchMoveVecRef.current.x = -1)}
              onTouchEnd={() => (touchMoveVecRef.current.x = 0)}
              className="mc-btn flex items-center justify-center text-sm font-bold text-white active:bg-emerald-700"
            >
              ◀
            </button>
            <button
              onTouchStart={() => (keysRef.current['Space'] = true)}
              onTouchEnd={() => (keysRef.current['Space'] = false)}
              className="mc-btn flex items-center justify-center text-[10px] font-bold text-amber-200"
            >
              ПРЫЖ
            </button>
            <button
              onTouchStart={() => (touchMoveVecRef.current.x = 1)}
              onTouchEnd={() => (touchMoveVecRef.current.x = 0)}
              className="mc-btn flex items-center justify-center text-sm font-bold text-white active:bg-emerald-700"
            >
              ▶
            </button>
            <div />
            <button
              onTouchStart={() => (touchMoveVecRef.current.y = -1)}
              onTouchEnd={() => (touchMoveVecRef.current.y = 0)}
              className="mc-btn flex items-center justify-center text-sm font-bold text-white active:bg-emerald-700"
            >
              ▼
            </button>
            <div />
          </div>

          <div className="pointer-events-auto absolute bottom-28 right-4 z-20 flex flex-col gap-2">
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                triggerActionRef.current.breakBlock();
              }}
              className="mc-btn px-4 py-3 text-xs font-bold text-red-200"
            >
              УДАР / ЛОМАТЬ
            </button>
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                triggerActionRef.current.placeBlock();
              }}
              className="mc-btn px-4 py-3 text-xs font-bold text-emerald-200"
            >
              ОТКР. / СТАВИТЬ
            </button>
          </div>
        </>
      )}

      {/* Unified Collapsible Bottom Control & Hotbar Dock */}
      <div
        className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-200"
        style={{
          maxWidth: 'min(960px, 96vw)',
          transform: dockCollapsed ? 'translateY(calc(100% - 28px))' : 'translateY(0)',
        }}
      >
        <div className="flex items-center justify-between w-full px-2 mb-1 gap-4">
          {gameMode === 'survival' && !dockCollapsed && (
            <div className="flex items-center gap-1 bg-black/70 px-2 py-0.5 border border-white/10">
              {Array.from({ length: 10 }).map((_, i) => {
                const full = health >= (i + 1) * 2;
                const half = !full && health >= i * 2 + 1;
                return (
                  <span
                    key={i}
                    className={`text-xs leading-none ${
                      full ? 'text-red-500' : half ? 'text-red-400/70' : 'text-neutral-700'
                    }`}
                  >
                    ♥
                  </span>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setDockCollapsed((c) => !c)}
            className="mx-auto flex items-center gap-1.5 px-3 py-1 bg-black/85 hover:bg-black border border-white/20 text-[11px] text-neutral-200 cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>
              {dockCollapsed
                ? 'Показать панель и хотбар [H]'
                : `${currentBlockDef?.nameRu || 'Пусто'} · Скрыть панель [H]`}
            </span>
          </button>

          {gameMode === 'survival' && !dockCollapsed && (
            <div className="flex items-center gap-1 bg-black/70 px-2 py-0.5 border border-white/10">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className={`text-xs leading-none ${
                    hunger >= (i + 1) * 2 ? 'text-amber-500' : 'text-neutral-700'
                  }`}
                >
                  ✦
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Main 9-Slot Hotbar + Quick Controls */}
        <div className="bg-black/85 border-2 border-neutral-600 p-2 flex flex-col items-center gap-2 shadow-2xl">
          <div className="flex items-center gap-1">
            {hotbar.map((slot, idx) => {
              const isSelected = idx === activeSlot;
              const iconUrl = blockIcons[slot.blockId];
              const def = BLOCKS[slot.blockId];
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveSlot(idx);
                    soundEngine.playClick();
                  }}
                  title={def?.nameRu}
                  className={`relative w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer transition-transform ${
                    isSelected
                      ? 'bg-[#b5b5b5] border-2 border-white scale-105 z-10'
                      : 'mc-slot hover:bg-[#9c9c9c]'
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] font-mono-tabular text-neutral-300">
                    {idx + 1}
                  </span>
                  {slot.blockId !== BlockId.AIR && iconUrl && (
                    <img
                      src={iconUrl}
                      alt={def?.name || 'Block'}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 sm:w-8 sm:h-8 pixelated"
                    />
                  )}
                  {gameMode === 'survival' && slot.count > 0 && (
                    <span className="absolute bottom-0.5 right-1 text-[10px] font-mono-tabular font-bold text-white drop-shadow-[1px_1px_0_#000]">
                      {slot.count}
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={() => {
                soundEngine.playClick();
                if (document.pointerLockElement) document.exitPointerLock();
                setShowInventory((s) => !s);
              }}
              className="ml-1 w-11 h-11 sm:w-12 sm:h-12 mc-btn flex flex-col items-center justify-center text-white cursor-pointer"
              title="Инвентарь и Верстак [E]"
            >
              <Package className="w-4 h-4" />
              <span className="text-[9px] font-mono-tabular mt-0.5">[E]</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-neutral-200">
            <button
              onClick={() => {
                soundEngine.playClick();
                if (document.pointerLockElement) document.exitPointerLock();
                setInTitleScreen(true);
              }}
              className="px-2.5 py-1 bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-400/40 flex items-center gap-1 cursor-pointer whitespace-nowrap text-white"
            >
              <Users className="w-3 h-3" />
              <span>Ник и Сервер ({onlinePlayers.length + 1})</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                setGameMode((m) => (m === 'survival' ? 'creative' : 'survival'));
              }}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-white/15 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Режим: {gameMode === 'survival' ? 'Выживание' : 'Креатив'} [C]</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                setIsFlying((f) => !f);
                playerVelRef.current.y = 0;
              }}
              className={`px-2.5 py-1 border flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                isFlying
                  ? 'bg-emerald-800/90 border-emerald-400 text-white'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-white/15'
              }`}
            >
              <Feather className="w-3 h-3" />
              <span>Полёт: {isFlying ? 'ВКЛ' : 'ВЫКЛ'} [F]</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                setCameraMode((m) =>
                  m === 'first' ? 'third-back' : m === 'third-back' ? 'third-front' : 'first'
                );
              }}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-white/15 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-3 h-3 text-sky-400" />
              <span>
                Камера:{' '}
                {cameraMode === 'first'
                  ? '1-е лицо'
                  : cameraMode === 'third-back'
                  ? '3-е (виден ник)'
                  : '3-е спереди'}{' '}
                [V]
              </span>
            </button>

            <button
              onClick={() => updateWorldEnv(!isNightTime ? 0.75 : 0.25, weather)}
              className={`px-2.5 py-1 border flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                isNightTime
                  ? 'bg-indigo-950/90 border-indigo-400 text-indigo-200'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-white/15'
              }`}
              title="Переключить День / Ночь (ночью спавнятся враждебные мобы)"
            >
              {!isNightTime ? (
                <Sun className="w-3 h-3 text-amber-300" />
              ) : (
                <Moon className="w-3 h-3 text-indigo-300" />
              )}
              <span>
                {!isNightTime ? 'День' : `Ночь (Мобов: ${hostileCount})`}
              </span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                setAutoDayNight((a) => !a);
              }}
              className={`px-2 py-1 border flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                autoDayNight
                  ? 'bg-amber-900/60 border-amber-400/50 text-amber-200'
                  : 'bg-neutral-800 border-white/15 text-neutral-400'
              }`}
              title="Автоматическая смена дня и ночи"
            >
              <Sword className="w-3 h-3" />
              <span>Авто-сутки: {autoDayNight ? 'ВКЛ' : 'ВЫКЛ'}</span>
            </button>

            <button
              onClick={() =>
                updateWorldEnv(
                  timeOfDay,
                  weather === 'clear' ? 'rain' : weather === 'rain' ? 'snow' : 'clear'
                )
              }
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-white/15 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <CloudRain className="w-3 h-3 text-sky-300" />
              <span>
                Погода: {weather === 'clear' ? 'Ясно' : weather === 'rain' ? 'Дождь' : 'Снег'}
              </span>
            </button>

            <button
              onClick={() => {
                const next = !soundMuted;
                setSoundMuted(next);
                soundEngine.enabled = !next;
              }}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 border border-white/15 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Звук"
            >
              {soundMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Inventory & Crafting Table Modal [E] */}
      {showInventory && (
        <div className="pointer-events-auto fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
          <div className="mc-panel w-full max-w-3xl p-5 text-neutral-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-neutral-500 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Hammer className="w-5 h-5 text-neutral-800" />
                <h2 className="font-pixel text-sm text-neutral-900">
                  ВЕРСТАК И КАТАЛОГ БЛОКОВ
                </h2>
              </div>
              <button
                onClick={() => setShowInventory(false)}
                className="mc-btn px-3 py-1 text-xs font-bold text-white cursor-pointer"
              >
                ЗАКРЫТЬ [E]
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                  Рецепты крафта (клик — создать блок)
                </h3>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {CRAFTING_RECIPES.map((recipe) => {
                    const outDef = BLOCKS[recipe.output.blockId];
                    const outIcon = blockIcons[recipe.output.blockId];
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => handleCraftRecipe(recipe)}
                        className="w-full mc-slot p-2 flex items-center justify-between hover:bg-[#9e9e9e] text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          {outIcon && (
                            <img
                              src={outIcon}
                              alt={outDef?.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 pixelated"
                            />
                          )}
                          <div>
                            <div className="text-xs font-bold text-white drop-shadow-[1px_1px_0_#000]">
                              {recipe.nameRu}
                            </div>
                            <div className="text-[11px] text-neutral-200">
                              Требуется:{' '}
                              {recipe.inputs
                                .map((inp) => `${BLOCKS[inp.blockId]?.nameRu} x${inp.count}`)
                                .join(', ')}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-emerald-700 text-white text-[10px] font-bold">
                          +{recipe.output.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                  Все блоки игры (клик — добавить в слот #{activeSlot + 1})
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-72 overflow-y-auto p-1">
                  {PLACEABLE_BLOCKS.map((bid) => {
                    const def = BLOCKS[bid];
                    const icon = blockIcons[bid];
                    return (
                      <button
                        key={bid}
                        onClick={() => {
                          soundEngine.playClick();
                          addBlockToInventory(bid, 64);
                        }}
                        title={def?.nameRu}
                        className="mc-slot p-2 flex flex-col items-center justify-center hover:bg-[#a6a6a6] cursor-pointer group"
                      >
                        {icon && (
                          <img
                            src={icon}
                            alt={def?.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 pixelated group-hover:scale-110 transition-transform"
                          />
                        )}
                        <span className="mt-1 text-[9px] text-white font-medium truncate w-full text-center drop-shadow-[1px_1px_0_#000]">
                          {def?.nameRu}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Screen / Nickname Entry & Online Multiplayer Server Lobby Modal */}
      {inTitleScreen && (
        <div className="pointer-events-auto fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="mc-panel w-full max-w-2xl p-6 text-neutral-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-neutral-500 pb-3 mb-4">
              <div>
                <h1 className="font-pixel text-base sm:text-lg text-neutral-900 tracking-tight">
                  ВХОД В МИР MINECRAFT ONLINE
                </h1>
                <p className="text-xs text-neutral-700 mt-1">
                  Введите ваш никнейм и нажмите «ВОЙТИ В МИР» — ваш ник будет отображаться над головой персонажа у всех игроков!
                </p>
              </div>
              <button
                onClick={() => handleSwitchRoom()}
                className="mc-btn px-4 py-2 text-xs font-bold text-emerald-300 cursor-pointer"
              >
                ВОЙТИ
              </button>
            </div>

            <form onSubmit={(e) => handleSwitchRoom(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Ваш никнейм (высвечивается над игроком)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Введите ваш ник..."
                    maxLength={18}
                    className="w-full bg-[#2b2b2b] border-2 border-emerald-400 px-3 py-2.5 text-sm text-white font-mono-tabular focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Код онлайн-комнаты (сервера)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      maxLength={24}
                      placeholder="overworld-1"
                      className="flex-1 bg-[#373737] border-2 border-white px-3 py-2.5 text-sm text-amber-300 font-mono-tabular focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="mc-btn px-4 py-2.5 text-xs font-bold text-emerald-300 cursor-pointer whitespace-nowrap"
                    >
                      ВОЙТИ
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Rooms Server List */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-800">
                    Активные онлайн-комнаты (клик для входа):
                  </span>
                  <button
                    type="button"
                    onClick={fetchRoomsList}
                    className="text-xs text-neutral-700 hover:text-black flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Обновить список</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-[#999] p-2 border border-neutral-600">
                  {activeRoomsList.length === 0 ? (
                    <div className="text-xs text-neutral-800 col-span-2 py-2 text-center">
                      Комната <b>{roomId}</b> готова к игре (WebRTC P2P + WebSocket)
                    </div>
                  ) : (
                    activeRoomsList.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => handleSwitchRoom(undefined, r.id)}
                        className={`p-2 text-left border flex items-center justify-between cursor-pointer ${
                          r.id === roomId
                            ? 'bg-emerald-800 text-white border-white'
                            : 'bg-[#444] text-neutral-100 border-neutral-700 hover:bg-[#555]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold font-mono-tabular">{r.id}</div>
                          <div className="text-[10px] text-neutral-300">
                            Сид: {r.seed} · Блоков изм.: {r.modifiedCount}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-black/50 text-emerald-300 text-[11px] font-mono-tabular">
                          {r.playerCount} игр.
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 3D Skin Selector */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  Скин вашего 3D-персонажа
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.values(SKIN_PALETTES).map((skin) => (
                    <button
                      type="button"
                      key={skin.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setSelectedSkin(skin.id);
                      }}
                      className={`p-2 text-left border-2 cursor-pointer transition-colors ${
                        selectedSkin === skin.id
                          ? 'bg-emerald-800 text-white border-white'
                          : 'bg-[#555] text-neutral-200 border-neutral-700 hover:bg-[#666]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="w-3.5 h-3.5 border border-black"
                          style={{ backgroundColor: skin.shirt }}
                        />
                        <span
                          className="w-3.5 h-3.5 border border-black"
                          style={{ backgroundColor: skin.pants }}
                        />
                      </div>
                      <div className="text-[11px] font-bold truncate">{skin.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* New Features Summary Box */}
              <div className="bg-[#a8a8a8] border border-neutral-600 p-3 text-xs space-y-1 text-neutral-900">
                <div className="font-bold">Что нового в мире:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>
                    <b>Деревни и жители:</b> 3 деревни вокруг спавна с домами, открывающимися дверями (ПКМ) и жителями-торговцами.
                  </li>
                  <li>
                    <b>Мини-карта [M]:</b> Радар спавна (0,0), деревень, кладов, друзей и мобов + быстрый телепорт.
                  </li>
                  <li>
                    <b>Авто-смена дня и ночи:</b> Ночью спавнятся Зомби и Криперы (сражайтесь ЛКМ за алмазы и изумруды).
                  </li>
                  <li>
                    <b>Ивенты «Поиск клада» и «Метеорит»:</b> Ищите сундуки с сокровищами по координатам!
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="mc-btn px-3.5 py-2.5 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Ссылка скопирована!' : 'Ссылка для друга'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  className="mc-btn px-6 py-2.5 text-xs font-bold text-emerald-300 flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>ВОЙТИ В МИР</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
