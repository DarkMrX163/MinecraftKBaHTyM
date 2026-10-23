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

  // Parse room from URL query for instant cross-platform friend invite
  const initialRoomFromUrl = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'overworld-1';
  })();

  const [inTitleScreen, setInTitleScreen] = useState<boolean>(false);
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('mc_player_name') || `Steve_${Math.floor(100 + Math.random() * 899)}`;
  });
  const [selectedSkin, setSelectedSkin] = useState<string>(() => {
    return localStorage.getItem('mc_player_skin') || 'steve';
  });
  const [roomId, setRoomId] = useState<string>(initialRoomFromUrl);
  const [roomInput, setRoomInput] = useState<string>(initialRoomFromUrl);
  const [worldSeed, setWorldSeed] = useState<number>(42069);

  // GitHub Publisher States
  const [ghToken, setGhToken] = useState<string>(() => localStorage.getItem('mc_gh_token') || '');
  const [ghRepoName, setGhRepoName] = useState<string>('minecraft-voxel-online');
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
  const [timeOfDay, setTimeOfDay] = useState<number>(0.25); // 0.25 = Noon
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
  const triggerActionRef = useRef<{ breakBlock: () => void; placeBlock: () => void }>({
    breakBlock: () => {},
    placeBlock: () => {},
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

  // Publish to GitHub handler (works both via server proxy and direct browser GitHub API)
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
      const existingIdx = next.findIndex((s) => s.blockId === blockId);
      if (existingIdx !== -1) {
        next[existingIdx].count = Math.min(999, next[existingIdx].count + amount);
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
    setWeather(w);
    if (netRef.current) {
      netRef.current.sendWorldEnv(t, w);
    }
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

    const localPlayerModel = new VoxelCharacterModel(
      stateRef.current.playerName,
      stateRef.current.selectedSkin,
      'desktop',
      false
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
    const spawnMobs = () => {
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
    };
    spawnMobs();

    const particles: ParticleBurst[] = [];
    const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const spawnBlockParticles = (bx: number, by: number, bz: number, count = 14) => {
      const mat = new THREE.MeshLambertMaterial({ color: 0x999999 });
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
          deviceType: 'desktop',
        });
      }
      setOnlinePlayers(arr);
    };

    // Initialize Dual-Transport Online Multiplayer (WebSocket + WebRTC PeerJS)
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
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
        spawnMobs();

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
        if (p.id !== selfIdRef.current && !remoteModels.has(p.id)) {
          const model = new VoxelCharacterModel(p.name, p.skin, p.deviceType, true);
          model.group.position.set(p.x, p.y, p.z);
          model.targetPos.set(p.x, p.y, p.z);
          scene.add(model.group);
          remoteModels.set(p.id, model);
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
      spawnBlockParticles(tx, ty, tz, 28);
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

    let handSwingAnim = 0;

    const executeBreakBlock = (bx: number, by: number, bz: number, blockId: number) => {
      if (BLOCKS[blockId]?.unbreakable && stateRef.current.gameMode !== 'creative') return;
      world.setBlock(bx, by, bz, BlockId.AIR, true);
      spawnBlockParticles(bx, by, bz, 14);
      soundEngine.playBlockBreak();

      const dropId = blockId === BlockId.STONE ? BlockId.COBBLESTONE : blockId;
      addBlockToInventory(dropId, 1);
      netManager.sendBlockUpdate(bx, by, bz, BlockId.AIR);
    };

    const executePlaceBlock = () => {
      handSwingAnim = 0.26;
      localPlayerModel.triggerSwing();

      const eyeOrigin = new THREE.Vector3(
        playerPosRef.current.x,
        playerPosRef.current.y + PLAYER_EYE_H,
        playerPosRef.current.z
      );
      camera.getWorldDirection(_rayDir);
      const hit = world.raycastVoxel(eyeOrigin, _rayDir, 6.5);
      if (!hit) return;

      const [hx, hy, hz] = hit.hitBlock;
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
        pz <= playerMaxZ
      ) {
        return;
      }

      world.setBlock(px, py, pz, slot.blockId, true);
      soundEngine.playBlockPlace();

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

    const clock = new THREE.Clock();
    let currentMiningTargetKey = '';
    let currentMiningTimer = 0;
    let stepSoundAccum = 0;
    let chunkSyncAccum = 0;
    let networkSendAccum = 0;
    let uiCoordAccum = 0;
    let walkBobTimer = 0;

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

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

      for (const mob of mobs) {
        mob.update(delta, (x, z) => world.getTerrainHeight(Math.floor(x), Math.floor(z)).height + 1);
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
      if (uiCoordAccum > 0.25) {
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

      {/* Minimal Top-Left Spec & Online Multiplayer Bar */}
      <div className="pointer-events-auto absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 bg-black/80 border border-white/15 px-3 py-1.5 text-xs text-neutral-200">
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
          title="Сменить онлайн-комнату или сервер"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Сервер: {roomId} ({onlinePlayers.length + 1} онлайн)
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

        <button
          onClick={() => {
            soundEngine.playClick();
            if (document.pointerLockElement) document.exitPointerLock();
            setShowGithubModal(true);
          }}
          className="flex items-center gap-1 px-2.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 border border-white/25 text-white text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
          title="Создать репозиторий и ссылку на GitHub / GitHub Pages"
        >
          <Github className="w-3.5 h-3.5" />
          <span>Создать ссылку на GitHub</span>
        </button>
      </div>

      {/* Pointer Lock Prompt Pill */}
      {!isPointerLocked &&
        !isTouchDevice &&
        !inTitleScreen &&
        !showGithubModal &&
        !showInventory &&
        !showChat && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-black/80 border border-amber-400/40 px-4 py-1.5 text-xs text-amber-200 whitespace-nowrap">
            Кликните по 3D-миру для игры (WASD — ход, ЛКМ — ломать, ПКМ — ставить, E — крафт)
          </div>
        )}

      {/* Live Multiplayer Chat Box (Top-Right compact overlay) */}
      <div className="pointer-events-auto absolute top-3 right-3 z-20 w-72 max-w-[85vw] flex flex-col items-end">
        <div className="w-full bg-black/75 border border-white/15 p-2 text-xs space-y-1 max-h-36 overflow-y-auto">
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
          <form onSubmit={handleSendChat} className="w-full mt-1 flex gap-1">
            <input
              type="text"
              autoFocus
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Чат или /time day, /weather snow..."
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
            className="mt-1 flex items-center gap-1.5 px-2.5 py-1 bg-black/75 hover:bg-black/90 border border-white/15 text-[11px] text-neutral-300 cursor-pointer whitespace-nowrap"
          >
            <MessageSquare className="w-3 h-3 text-emerald-400" />
            <span>Онлайн-чат [T]</span>
          </button>
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
              ЛОМАТЬ
            </button>
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                triggerActionRef.current.placeBlock();
              }}
              className="mc-btn px-4 py-3 text-xs font-bold text-emerald-200"
            >
              СТАВИТЬ
            </button>
          </div>
        </>
      )}

      {/* Unified Collapsible Bottom Control & Hotbar Dock */}
      <div
        className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-200"
        style={{
          maxWidth: 'min(940px, 95vw)',
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
              <span>Онлайн-комнаты ({onlinePlayers.length + 1})</span>
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
                  ? '3-е сзади'
                  : '3-е спереди'}{' '}
                [V]
              </span>
            </button>

            <button
              onClick={() => updateWorldEnv(timeOfDay < 0.5 ? 0.75 : 0.25, weather)}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-white/15 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              {timeOfDay < 0.55 && timeOfDay > 0.05 ? (
                <Sun className="w-3 h-3 text-amber-300" />
              ) : (
                <Moon className="w-3 h-3 text-indigo-300" />
              )}
              <span>{timeOfDay < 0.55 && timeOfDay > 0.05 ? 'День' : 'Ночь'}</span>
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

      {/* Online Multiplayer Server Browser & Room Lobby Modal */}
      {inTitleScreen && (
        <div className="pointer-events-auto fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="mc-panel w-full max-w-2xl p-6 text-neutral-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-neutral-500 pb-3 mb-4">
              <div>
                <h1 className="font-pixel text-base sm:text-lg text-neutral-900 tracking-tight">
                   СЕТЕВАЯ ИГРА MINECRAFT
                </h1>
                <p className="text-xs text-neutral-700 mt-1">
                  Двойной протокол связи: WebSocket Сервер + WebRTC P2P (PeerJS) для игры по сети и на GitHub Pages
                </p>
              </div>
              <button
                onClick={() => setInTitleScreen(false)}
                className="mc-btn px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
              >
                В ИГРУ
              </button>
            </div>

            <form onSubmit={(e) => handleSwitchRoom(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Ваш никнейм
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={18}
                    className="w-full bg-[#373737] border-2 border-white px-3 py-2 text-sm text-white font-mono-tabular focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Код онлайн-комнаты (сервера)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      maxLength={24}
                      placeholder="overworld-1"
                      className="flex-1 bg-[#373737] border-2 border-white px-3 py-2 text-sm text-amber-300 font-mono-tabular focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="mc-btn px-3 py-2 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                    >
                      Подключиться
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
                      Комната <b>{roomId}</b> активна (P2P WebRTC + WebSocket)
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

              {/* Network Telemetry & Invite Link */}
              <div className="bg-[#a8a8a8] border border-neutral-600 p-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Протоколы:{' '}
                    {netStatus.wsConnected ? 'WebSocket Онлайн' : 'Автономный'} +{' '}
                    {netStatus.p2pConnected
                      ? `WebRTC P2P (${netStatus.p2pRole === 'host' ? 'Хост комнаты' : 'Клиент'})`
                      : 'P2P соединение...'}
                  </span>
                  <span className="font-mono-tabular text-neutral-800">Сид: {worldSeed}</span>
                </div>
                <p className="text-neutral-800">
                  Скопируйте пригласительную ссылку или опубликуйте игру на свой GitHub — друзья смогут зайти с компьютера или телефона в реальном времени!
                </p>
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

                  <button
                    type="button"
                    onClick={() => {
                      setInTitleScreen(false);
                      setShowGithubModal(true);
                    }}
                    className="mc-btn px-3.5 py-2.5 text-xs font-bold text-amber-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Github className="w-4 h-4" />
                    <span>Создать ссылку на GitHub</span>
                  </button>
                </div>

                <button
                  type="submit"
                  className="mc-btn px-6 py-2.5 text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>ИГРАТЬ ОНЛАЙН</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GitHub Repository & GitHub Pages Link Generator Modal */}
      {showGithubModal && (
        <div className="pointer-events-auto fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="mc-panel w-full max-w-xl p-6 text-neutral-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-neutral-500 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-neutral-900" />
                <h2 className="font-pixel text-sm text-neutral-900">
                  ПУБЛИКАЦИЯ НА GITHUB
                </h2>
              </div>
              <button
                onClick={() => setShowGithubModal(false)}
                className="mc-btn px-3 py-1 text-xs font-bold text-white cursor-pointer"
              >
                ЗАКРЫТЬ
              </button>
            </div>

            <p className="text-xs text-neutral-800 mb-4 leading-relaxed">
              Создайте собственный репозиторий на <b>GitHub</b> с полным исходным кодом игры, текстурами и автоматическим деплоем на <b>GitHub Pages</b>. Благодаря встроенному <b>WebRTC P2P (PeerJS)</b> мультиплееру, по вашей ссылке на GitHub можно играть онлайн с друзьями без платного хостинга!
            </p>

            <form onSubmit={handlePublishToGitHub} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-neutral-900">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Minecraft+Voxel+Edition"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-800 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Получить токен на GitHub (права repo + workflow)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  required
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[#373737] border-2 border-white px-3 py-2 text-xs text-white font-mono-tabular focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Название репозитория
                  </label>
                  <input
                    type="text"
                    required
                    value={ghRepoName}
                    onChange={(e) => setGhRepoName(e.target.value)}
                    placeholder="minecraft-voxel-online"
                    className="w-full bg-[#373737] border-2 border-white px-3 py-2 text-xs text-amber-300 font-mono-tabular focus:outline-none"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-neutral-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ghPrivate}
                      onChange={(e) => setGhPrivate(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Приватный репозиторий</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">
                  Описание репозитория
                </label>
                <input
                  type="text"
                  value={ghDescription}
                  onChange={(e) => setGhDescription(e.target.value)}
                  className="w-full bg-[#373737] border-2 border-white px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {ghError && (
                <div className="bg-red-900/90 border border-red-400 text-red-100 p-2.5 text-xs">
                  {ghError}
                </div>
              )}

              {ghResult && (
                <div className="bg-emerald-900 border-2 border-emerald-400 text-white p-3.5 space-y-2.5 text-xs">
                  <div className="font-bold text-emerald-300">
                    Готово! Загружено файлов: {ghResult.uploadedCount}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] text-neutral-200">Ссылка на ваш GitHub репозиторий:</div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={ghResult.repoUrl}
                        className="flex-1 bg-black/60 border border-white/30 px-2.5 py-1.5 text-xs font-mono-tabular text-amber-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ghResult.repoUrl).catch(() => {});
                          setCopiedGhLink('repo');
                          setTimeout(() => setCopiedGhLink(null), 2000);
                        }}
                        className="mc-btn px-2.5 py-1.5 text-xs text-white cursor-pointer"
                      >
                        {copiedGhLink === 'repo' ? 'Скопировано' : 'Копировать'}
                      </button>
                      <a
                        href={ghResult.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mc-btn px-2.5 py-1.5 text-xs text-white flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] text-neutral-200">
                      Ссылка на онлайн-игру GitHub Pages (активируется после сборки Actions ~1 мин):
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={`${ghResult.pagesUrl}?room=${roomId}`}
                        className="flex-1 bg-black/60 border border-white/30 px-2.5 py-1.5 text-xs font-mono-tabular text-emerald-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(`${ghResult.pagesUrl}?room=${roomId}`)
                            .catch(() => {});
                          setCopiedGhLink('pages');
                          setTimeout(() => setCopiedGhLink(null), 2000);
                        }}
                        className="mc-btn px-2.5 py-1.5 text-xs text-white cursor-pointer"
                      >
                        {copiedGhLink === 'pages' ? 'Скопировано' : 'Копировать'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={ghPublishing}
                  className="mc-btn px-5 py-2.5 text-xs font-bold text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Github className="w-4 h-4" />
                  <span>
                    {ghPublishing
                      ? 'Загрузка файлов на GitHub...'
                      : 'Создать репозиторий и получить ссылку GitHub'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
