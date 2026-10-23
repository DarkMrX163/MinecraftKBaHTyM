import Peer, { DataConnection } from 'peerjs';

export interface NetworkPlayerPayload {
  id: string;
  name: string;
  skin: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  heldBlockId: number;
  swinging: boolean;
  sneaking: boolean;
  deviceType: 'desktop' | 'mobile';
}

export interface NetworkChatPayload {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  system?: boolean;
}

export interface NetworkCallbacks {
  onStatusChange: (status: {
    wsConnected: boolean;
    p2pConnected: boolean;
    p2pRole: 'host' | 'client' | 'connecting';
    peerCount: number;
  }) => void;
  onInitWorld: (data: {
    selfId: string;
    seed: number;
    timeOfDay: number;
    weather: 'clear' | 'rain' | 'snow';
    modifiedBlocks: [string, number][];
    players: NetworkPlayerPayload[];
    chatHistory: NetworkChatPayload[];
  }) => void;
  onPlayerJoined: (player: NetworkPlayerPayload, chat?: NetworkChatPayload) => void;
  onPlayerMoved: (player: NetworkPlayerPayload) => void;
  onPlayerSwung: (id: string) => void;
  onPlayerLeft: (id: string, chat?: NetworkChatPayload) => void;
  onBlockUpdated: (x: number, y: number, z: number, blockId: number) => void;
  onBlockBatchUpdated: (updates: { x: number; y: number; z: number; blockId: number }[]) => void;
  onWorldEnvUpdated: (timeOfDay: number, weather: 'clear' | 'rain' | 'snow') => void;
  onChatMessage: (chat: NetworkChatPayload) => void;
}

function computeSeedFromRoom(roomId: string): number {
  let hash = 1337;
  for (let i = 0; i < roomId.length; i++) {
    hash = (hash * 31 + roomId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 42069;
}

/**
 * Dual-Transport Online Multiplayer Engine:
 * 1. Express WebSocket (`/ws`) for instant low-latency server sync when hosted on Node/Cloud Run.
 * 2. WebRTC PeerJS (`peerjs`) deterministic room host/mesh so players on static GitHub Pages URLs
 *    or across different tabs/devices can play online together in real time without a backend server.
 */
export class MultiplayerManager {
  private roomId: string;
  private selfId: string;
  private callbacks: NetworkCallbacks;

  private ws: WebSocket | null = null;
  private wsConnected = false;
  private wsReconnectTimer: number | null = null;

  private peer: Peer | null = null;
  private isP2PHost = false;
  private p2pConnected = false;
  private hostConn: DataConnection | null = null;
  private clientConns = new Map<string, DataConnection>();

  // Authoritative state maintained by P2P Host (used when WebSocket server is unavailable, e.g. GitHub Pages)
  private p2pModifiedBlocks = new Map<string, number>();
  private p2pPlayers = new Map<string, NetworkPlayerPayload>();
  private p2pChatHistory: NetworkChatPayload[] = [];
  private p2pTimeOfDay = 0.25;
  private p2pWeather: 'clear' | 'rain' | 'snow' = 'clear';

  constructor(roomId: string, selfId: string, callbacks: NetworkCallbacks) {
    this.roomId = this.sanitizeRoom(roomId);
    this.selfId = selfId;
    this.callbacks = callbacks;
  }

  private sanitizeRoom(r: string): string {
    return (r || 'overworld-1').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 24) || 'overworld-1';
  }

  private emitStatus() {
    const peerCount = this.isP2PHost
      ? this.clientConns.size
      : this.hostConn && this.hostConn.open
      ? 1
      : 0;
    this.callbacks.onStatusChange({
      wsConnected: this.wsConnected,
      p2pConnected: this.p2pConnected,
      p2pRole: this.p2pConnected ? (this.isP2PHost ? 'host' : 'client') : 'connecting',
      peerCount,
    });
  }

  public connect(initialPlayer: NetworkPlayerPayload) {
    this.p2pPlayers.set(this.selfId, initialPlayer);
    this.connectWebSocket(initialPlayer);
    this.connectPeerJS(initialPlayer);
  }

  public switchRoom(newRoomId: string, currentPlayer: NetworkPlayerPayload) {
    this.dispose();
    this.roomId = this.sanitizeRoom(newRoomId);
    this.p2pModifiedBlocks.clear();
    this.p2pPlayers.clear();
    this.p2pChatHistory = [];
    this.connect(currentPlayer);
  }

  private connectWebSocket(initialPlayer: NetworkPlayerPayload) {
    // Skip WS if running on github.io static domain where no WS backend exists
    if (window.location.hostname.endsWith('github.io')) {
      return;
    }

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.wsConnected = true;
        this.emitStatus();
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId: this.roomId,
            playerId: this.selfId,
            name: initialPlayer.name,
            skin: initialPlayer.skin,
            x: initialPlayer.x,
            y: initialPlayer.y,
            z: initialPlayer.z,
            deviceType: initialPlayer.deviceType,
          })
        );
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          this.handleIncomingPacket(data);
        } catch {
          // ignore malformed packet
        }
      };

      ws.onclose = () => {
        this.wsConnected = false;
        this.emitStatus();
      };

      ws.onerror = () => {
        this.wsConnected = false;
        this.emitStatus();
      };
    } catch {
      this.wsConnected = false;
      this.emitStatus();
    }
  }

  private connectPeerJS(initialPlayer: NetworkPlayerPayload) {
    const hostPeerId = `mc-voxel-room-${this.roomId}-host`;

    // First attempt to claim the deterministic Room Host ID on PeerJS Cloud
    const peer = new Peer(hostPeerId, {
      debug: 0,
    });
    this.peer = peer;

    peer.on('open', () => {
      // Successfully became the P2P Room Host
      this.isP2PHost = true;
      this.p2pConnected = true;
      this.emitStatus();

      // If WebSocket isn't active (e.g., on GitHub Pages), initialize the world locally from deterministic seed
      if (!this.wsConnected) {
        const seed = computeSeedFromRoom(this.roomId);
        const sysMsg: NetworkChatPayload = {
          id: `p2p_init_${Date.now()}`,
          sender: 'Онлайн P2P',
          text: `Вы создали P2P комнату "${this.roomId}" (WebRTC активен). Отправьте ссылку друзьям!`,
          timestamp: Date.now(),
          system: true,
        };
        this.p2pChatHistory = [sysMsg];
        this.callbacks.onInitWorld({
          selfId: this.selfId,
          seed,
          timeOfDay: this.p2pTimeOfDay,
          weather: this.p2pWeather,
          modifiedBlocks: Array.from(this.p2pModifiedBlocks.entries()),
          players: Array.from(this.p2pPlayers.values()),
          chatHistory: this.p2pChatHistory,
        });
      }
    });

    peer.on('connection', (conn) => {
      this.setupHostClientConnection(conn);
    });

    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'unavailable-id') {
        // Another player is already hosting this room via P2P! Join as a P2P Client
        peer.destroy();
        this.connectAsP2PClient(hostPeerId, initialPlayer);
      } else {
        this.p2pConnected = false;
        this.emitStatus();
      }
    });
  }

  private connectAsP2PClient(hostPeerId: string, initialPlayer: NetworkPlayerPayload) {
    const clientPeer = new Peer({ debug: 0 });
    this.peer = clientPeer;
    this.isP2PHost = false;

    clientPeer.on('open', () => {
      const conn = clientPeer.connect(hostPeerId, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        this.p2pConnected = true;
        this.emitStatus();
        conn.send({
          type: 'join',
          roomId: this.roomId,
          playerId: this.selfId,
          name: initialPlayer.name,
          skin: initialPlayer.skin,
          x: initialPlayer.x,
          y: initialPlayer.y,
          z: initialPlayer.z,
          deviceType: initialPlayer.deviceType,
        });
      });

      conn.on('data', (raw: unknown) => {
        // Only apply P2P packets if WebSocket is not already handling them, or if WS is offline
        if (!this.wsConnected && raw && typeof raw === 'object') {
          this.handleIncomingPacket(raw as Record<string, unknown>);
        }
      });

      conn.on('close', () => {
        this.p2pConnected = false;
        this.emitStatus();
      });
    });
  }

  private setupHostClientConnection(conn: DataConnection) {
    let remotePlayerId = '';

    conn.on('data', (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const data = raw as Record<string, unknown>;

      if (data.type === 'join') {
        remotePlayerId = String(data.playerId || `p2p_${Math.random().toString(36).slice(2, 8)}`);
        this.clientConns.set(remotePlayerId, conn);
        this.emitStatus();

        const newPlayer: NetworkPlayerPayload = {
          id: remotePlayerId,
          name: String(data.name || 'Steve').slice(0, 18),
          skin: String(data.skin || 'steve'),
          x: Number(data.x) || 0,
          y: Number(data.y) || 28,
          z: Number(data.z) || 0,
          yaw: 0,
          pitch: 0,
          heldBlockId: 1,
          swinging: false,
          sneaking: false,
          deviceType: data.deviceType === 'mobile' ? 'mobile' : 'desktop',
        };
        this.p2pPlayers.set(remotePlayerId, newPlayer);

        const joinMsg: NetworkChatPayload = {
          id: `p2p_join_${Date.now()}`,
          sender: 'Онлайн P2P',
          text: `${newPlayer.name} подключился по WebRTC P2P`,
          timestamp: Date.now(),
          system: true,
        };
        this.p2pChatHistory.push(joinMsg);

        // Send full world state to joining P2P client
        conn.send({
          type: 'init',
          selfId: remotePlayerId,
          roomId: this.roomId,
          seed: computeSeedFromRoom(this.roomId),
          timeOfDay: this.p2pTimeOfDay,
          weather: this.p2pWeather,
          modifiedBlocks: Array.from(this.p2pModifiedBlocks.entries()),
          players: Array.from(this.p2pPlayers.values()),
          chatHistory: this.p2pChatHistory.slice(-40),
        });

        // Notify host locally if WS is not already doing it
        if (!this.wsConnected) {
          this.callbacks.onPlayerJoined(newPlayer, joinMsg);
        }

        // Broadcast to other P2P clients
        this.broadcastP2PFromHost(
          {
            type: 'player:joined',
            player: newPlayer,
            chat: joinMsg,
          },
          remotePlayerId
        );
        return;
      }

      if (!remotePlayerId) return;

      if (data.type === 'player:move') {
        const p = this.p2pPlayers.get(remotePlayerId);
        if (p) {
          p.x = Number(data.x) || 0;
          p.y = Number(data.y) || 0;
          p.z = Number(data.z) || 0;
          p.yaw = Number(data.yaw) || 0;
          p.pitch = Number(data.pitch) || 0;
          p.heldBlockId = Number(data.heldBlockId) || 1;
          p.swinging = Boolean(data.swinging);
          p.sneaking = Boolean(data.sneaking);
          if (data.name) p.name = String(data.name).slice(0, 18);
          if (data.skin) p.skin = String(data.skin);

          if (!this.wsConnected) {
            this.callbacks.onPlayerMoved(p);
          }
          this.broadcastP2PFromHost({ type: 'player:moved', player: p }, remotePlayerId);
        }
      } else if (data.type === 'player:swing') {
        if (!this.wsConnected) {
          this.callbacks.onPlayerSwung(remotePlayerId);
        }
        this.broadcastP2PFromHost({ type: 'player:swung', id: remotePlayerId }, remotePlayerId);
      } else if (data.type === 'block:update') {
        const bx = Math.floor(Number(data.x));
        const by = Math.floor(Number(data.y));
        const bz = Math.floor(Number(data.z));
        const bid = Number(data.blockId);
        this.p2pModifiedBlocks.set(`${bx},${by},${bz}`, bid);
        if (!this.wsConnected) {
          this.callbacks.onBlockUpdated(bx, by, bz, bid);
        }
        this.broadcastP2PFromHost(
          { type: 'block:updated', x: bx, y: by, z: bz, blockId: bid },
          remotePlayerId
        );
      } else if (data.type === 'block:batch') {
        if (Array.isArray(data.updates)) {
          const valid = data.updates as { x: number; y: number; z: number; blockId: number }[];
          for (const u of valid) {
            this.p2pModifiedBlocks.set(`${u.x},${u.y},${u.z}`, u.blockId);
          }
          if (!this.wsConnected) {
            this.callbacks.onBlockBatchUpdated(valid);
          }
          this.broadcastP2PFromHost({ type: 'block:batch_updated', updates: valid }, remotePlayerId);
        }
      } else if (data.type === 'world:env') {
        if (typeof data.timeOfDay === 'number') this.p2pTimeOfDay = data.timeOfDay;
        if (data.weather) this.p2pWeather = data.weather as 'clear' | 'rain' | 'snow';
        if (!this.wsConnected) {
          this.callbacks.onWorldEnvUpdated(this.p2pTimeOfDay, this.p2pWeather);
        }
        this.broadcastP2PFromHost({
          type: 'world:env_updated',
          timeOfDay: this.p2pTimeOfDay,
          weather: this.p2pWeather,
        });
      } else if (data.type === 'chat:send') {
        const p = this.p2pPlayers.get(remotePlayerId);
        const chatMsg: NetworkChatPayload = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sender: p ? p.name : 'Steve',
          text: String(data.text || '').slice(0, 240),
          timestamp: Date.now(),
        };
        this.p2pChatHistory.push(chatMsg);
        if (!this.wsConnected) {
          this.callbacks.onChatMessage(chatMsg);
        }
        this.broadcastP2PFromHost({ type: 'chat:message', chat: chatMsg });
      }
    });

    conn.on('close', () => {
      if (remotePlayerId) {
        const p = this.p2pPlayers.get(remotePlayerId);
        this.p2pPlayers.delete(remotePlayerId);
        this.clientConns.delete(remotePlayerId);
        this.emitStatus();

        const leaveMsg: NetworkChatPayload = {
          id: `leave_${Date.now()}`,
          sender: 'Онлайн P2P',
          text: `${p?.name || 'Игрок'} отключился`,
          timestamp: Date.now(),
          system: true,
        };
        if (!this.wsConnected) {
          this.callbacks.onPlayerLeft(remotePlayerId, leaveMsg);
        }
        this.broadcastP2PFromHost({ type: 'player:left', id: remotePlayerId, chat: leaveMsg });
      }
    });
  }

  private broadcastP2PFromHost(payload: unknown, excludeId?: string) {
    for (const [cid, conn] of this.clientConns.entries()) {
      if (cid !== excludeId && conn.open) {
        conn.send(payload);
      }
    }
  }

  private handleIncomingPacket(data: Record<string, unknown>) {
    const type = data.type;
    if (type === 'init') {
      this.callbacks.onInitWorld({
        selfId: String(data.selfId || this.selfId),
        seed: Number(data.seed) || 42069,
        timeOfDay: typeof data.timeOfDay === 'number' ? data.timeOfDay : 0.25,
        weather: (data.weather as 'clear' | 'rain' | 'snow') || 'clear',
        modifiedBlocks: (data.modifiedBlocks as [string, number][]) || [],
        players: (data.players as NetworkPlayerPayload[]) || [],
        chatHistory: (data.chatHistory as NetworkChatPayload[]) || [],
      });
    } else if (type === 'player:joined') {
      this.callbacks.onPlayerJoined(
        data.player as NetworkPlayerPayload,
        data.chat as NetworkChatPayload | undefined
      );
    } else if (type === 'player:moved') {
      this.callbacks.onPlayerMoved(data.player as NetworkPlayerPayload);
    } else if (type === 'player:swung') {
      this.callbacks.onPlayerSwung(String(data.id));
    } else if (type === 'player:left') {
      this.callbacks.onPlayerLeft(
        String(data.id),
        data.chat as NetworkChatPayload | undefined
      );
    } else if (type === 'block:updated') {
      this.callbacks.onBlockUpdated(
        Number(data.x),
        Number(data.y),
        Number(data.z),
        Number(data.blockId)
      );
    } else if (type === 'block:batch_updated') {
      this.callbacks.onBlockBatchUpdated(
        (data.updates as { x: number; y: number; z: number; blockId: number }[]) || []
      );
    } else if (type === 'world:env_updated') {
      this.callbacks.onWorldEnvUpdated(
        typeof data.timeOfDay === 'number' ? data.timeOfDay : 0.25,
        (data.weather as 'clear' | 'rain' | 'snow') || 'clear'
      );
    } else if (type === 'chat:message') {
      if (data.chat) {
        this.callbacks.onChatMessage(data.chat as NetworkChatPayload);
      }
    }
  }

  // Outgoing methods called by local player actions
  public sendPlayerMove(player: NetworkPlayerPayload) {
    this.p2pPlayers.set(this.selfId, player);
    const packet = {
      type: 'player:move',
      ...player,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
    if (this.isP2PHost) {
      this.broadcastP2PFromHost({ type: 'player:moved', player });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(packet);
    }
  }

  public sendSwing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'player:swing' }));
    }
    if (this.isP2PHost) {
      this.broadcastP2PFromHost({ type: 'player:swung', id: this.selfId });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: 'player:swing' });
    }
  }

  public sendBlockUpdate(x: number, y: number, z: number, blockId: number) {
    this.p2pModifiedBlocks.set(`${x},${y},${z}`, blockId);
    const packet = { type: 'block:update', x, y, z, blockId };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
    if (this.isP2PHost) {
      this.broadcastP2PFromHost({ type: 'block:updated', x, y, z, blockId });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(packet);
    }
  }

  public sendBlockBatch(updates: { x: number; y: number; z: number; blockId: number }[]) {
    for (const u of updates) {
      this.p2pModifiedBlocks.set(`${u.x},${u.y},${u.z}`, u.blockId);
    }
    const packet = { type: 'block:batch', updates };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
    if (this.isP2PHost) {
      this.broadcastP2PFromHost({ type: 'block:batch_updated', updates });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(packet);
    }
  }

  public sendWorldEnv(timeOfDay: number, weather: 'clear' | 'rain' | 'snow') {
    this.p2pTimeOfDay = timeOfDay;
    this.p2pWeather = weather;
    const packet = { type: 'world:env', timeOfDay, weather };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
    if (this.isP2PHost) {
      this.broadcastP2PFromHost({ type: 'world:env_updated', timeOfDay, weather });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(packet);
    }
  }

  public sendChat(text: string, senderName: string) {
    const packet = { type: 'chat:send', text };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    } else if (this.isP2PHost) {
      const chatMsg: NetworkChatPayload = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender: senderName,
        text,
        timestamp: Date.now(),
      };
      this.p2pChatHistory.push(chatMsg);
      this.callbacks.onChatMessage(chatMsg);
      this.broadcastP2PFromHost({ type: 'chat:message', chat: chatMsg });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(packet);
    }
  }

  public dispose() {
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    for (const [, c] of this.clientConns.entries()) {
      c.close();
    }
    this.clientConns.clear();
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
