import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PlayerState {
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

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  system?: boolean;
}

interface RoomState {
  id: string;
  seed: number;
  timeOfDay: number; // 0 to 1 (0.25 = noon, 0.75 = midnight)
  weather: 'clear' | 'rain' | 'snow';
  modifiedBlocks: Map<string, number>; // "x,y,z" -> blockId (0 = air)
  players: Map<string, PlayerState>;
  clients: Map<string, WebSocket>;
  chatHistory: ChatMessage[];
}

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(roomId: string): RoomState {
  const cleanId = (roomId || 'overworld-1').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 24) || 'overworld-1';
  let room = rooms.get(cleanId);
  if (!room) {
    // Deterministic seed from room name
    let hash = 1337;
    for (let i = 0; i < cleanId.length; i++) {
      hash = (hash * 31 + cleanId.charCodeAt(i)) | 0;
    }
    room = {
      id: cleanId,
      seed: Math.abs(hash) || 42069,
      timeOfDay: 0.25,
      weather: 'clear',
      modifiedBlocks: new Map<string, number>(),
      players: new Map<string, PlayerState>(),
      clients: new Map<string, WebSocket>(),
      chatHistory: [
        {
          id: 'sys-init',
          sender: 'Сервер',
          text: `Мир "${cleanId}" готов к кроссплатформенной игре (Сид: ${Math.abs(hash) || 42069}).`,
          timestamp: Date.now(),
          system: true,
        },
      ],
    };
    rooms.set(cleanId, room);
  }
  return room;
}

function broadcastToRoom(room: RoomState, payload: unknown, excludeId?: string) {
  const msg = JSON.stringify(payload);
  for (const [clientId, ws] of room.clients.entries()) {
    if (clientId !== excludeId && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  app.use(express.json());

  // API endpoint to list active rooms and player counts
  app.get('/api/rooms', (_req, res) => {
    const list = Array.from(rooms.values()).map((r) => ({
      id: r.id,
      seed: r.seed,
      playerCount: r.players.size,
      modifiedCount: r.modifiedBlocks.size,
      weather: r.weather,
    }));
    res.json({ rooms: list });
  });

  wss.on('connection', (ws) => {
    let currentRoom: RoomState | null = null;
    let playerId = `p_${Math.random().toString(36).slice(2, 10)}`;

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'join') {
          const room = getOrCreateRoom(data.roomId || 'overworld-1');
          currentRoom = room;
          if (data.playerId && typeof data.playerId === 'string') {
            playerId = data.playerId;
          }

          const newPlayer: PlayerState = {
            id: playerId,
            name: (data.name || 'Steve').slice(0, 18),
            skin: data.skin || 'steve',
            x: typeof data.x === 'number' ? data.x : 0,
            y: typeof data.y === 'number' ? data.y : 28,
            z: typeof data.z === 'number' ? data.z : 0,
            yaw: 0,
            pitch: 0,
            heldBlockId: 1,
            swinging: false,
            sneaking: false,
            deviceType: data.deviceType === 'mobile' ? 'mobile' : 'desktop',
          };

          room.players.set(playerId, newPlayer);
          room.clients.set(playerId, ws);

          // Send full initial authoritative state to joining client
          const blocksArray: [string, number][] = Array.from(room.modifiedBlocks.entries());
          const playersArray: PlayerState[] = Array.from(room.players.values());

          ws.send(
            JSON.stringify({
              type: 'init',
              selfId: playerId,
              roomId: room.id,
              seed: room.seed,
              timeOfDay: room.timeOfDay,
              weather: room.weather,
              modifiedBlocks: blocksArray,
              players: playersArray,
              chatHistory: room.chatHistory.slice(-40),
            })
          );

          const joinMsg: ChatMessage = {
            id: `join_${Date.now()}_${Math.random()}`,
            sender: 'Сервер',
            text: `${newPlayer.name} (${newPlayer.deviceType === 'mobile' ? 'Touch/Mobile' : 'PC'}) присоединился к игре`,
            timestamp: Date.now(),
            system: true,
          };
          room.chatHistory.push(joinMsg);
          if (room.chatHistory.length > 80) room.chatHistory.shift();

          broadcastToRoom(
            room,
            {
              type: 'player:joined',
              player: newPlayer,
              chat: joinMsg,
            },
            playerId
          );
          return;
        }

        if (!currentRoom) return;

        if (data.type === 'player:move') {
          const p = currentRoom.players.get(playerId);
          if (p) {
            p.x = Number(data.x) || 0;
            p.y = Number(data.y) || 0;
            p.z = Number(data.z) || 0;
            p.yaw = Number(data.yaw) || 0;
            p.pitch = Number(data.pitch) || 0;
            p.heldBlockId = Number(data.heldBlockId) || 1;
            p.swinging = Boolean(data.swinging);
            p.sneaking = Boolean(data.sneaking);
            if (data.skin) p.skin = data.skin;
            if (data.name) p.name = String(data.name).slice(0, 18);

            broadcastToRoom(
              currentRoom,
              {
                type: 'player:moved',
                player: p,
              },
              playerId
            );
          }
        } else if (data.type === 'player:swing') {
          broadcastToRoom(
            currentRoom,
            {
              type: 'player:swung',
              id: playerId,
            },
            playerId
          );
        } else if (data.type === 'block:update') {
          const { x, y, z, blockId } = data;
          if (
            typeof x === 'number' &&
            typeof y === 'number' &&
            typeof z === 'number' &&
            typeof blockId === 'number'
          ) {
            const bx = Math.floor(x);
            const by = Math.floor(y);
            const bz = Math.floor(z);
            if (by >= 0 && by < 128) {
              const key = `${bx},${by},${bz}`;
              currentRoom.modifiedBlocks.set(key, blockId);
              broadcastToRoom(
                currentRoom,
                {
                  type: 'block:updated',
                  x: bx,
                  y: by,
                  z: bz,
                  blockId,
                  actorId: playerId,
                },
                playerId
              );
            }
          }
        } else if (data.type === 'block:batch') {
          // For TNT explosions or structures
          if (Array.isArray(data.updates)) {
            const validUpdates: { x: number; y: number; z: number; blockId: number }[] = [];
            for (const u of data.updates.slice(0, 250)) {
              const bx = Math.floor(Number(u.x));
              const by = Math.floor(Number(u.y));
              const bz = Math.floor(Number(u.z));
              const bid = Number(u.blockId);
              if (by >= 1 && by < 128) {
                currentRoom.modifiedBlocks.set(`${bx},${by},${bz}`, bid);
                validUpdates.push({ x: bx, y: by, z: bz, blockId: bid });
              }
            }
            if (validUpdates.length > 0) {
              broadcastToRoom(
                currentRoom,
                {
                  type: 'block:batch_updated',
                  updates: validUpdates,
                  actorId: playerId,
                },
                playerId
              );
            }
          }
        } else if (data.type === 'world:env') {
          if (typeof data.timeOfDay === 'number') {
            currentRoom.timeOfDay = ((data.timeOfDay % 1) + 1) % 1;
          }
          if (data.weather && ['clear', 'rain', 'snow'].includes(data.weather)) {
            currentRoom.weather = data.weather;
          }
          broadcastToRoom(currentRoom, {
            type: 'world:env_updated',
            timeOfDay: currentRoom.timeOfDay,
            weather: currentRoom.weather,
          });
        } else if (data.type === 'chat:send') {
          const text = String(data.text || '').trim().slice(0, 240);
          if (!text) return;
          const p = currentRoom.players.get(playerId);
          const sender = p ? p.name : 'Steve';

          // Handle slash commands
          if (text.startsWith('/')) {
            const parts = text.split(' ');
            const cmd = parts[0].toLowerCase();
            if (cmd === '/time') {
              const arg = parts[1];
              if (arg === 'day' || arg === 'set') currentRoom.timeOfDay = 0.25;
              else if (arg === 'night') currentRoom.timeOfDay = 0.75;
              else if (arg === 'sunset') currentRoom.timeOfDay = 0.52;
              broadcastToRoom(currentRoom, {
                type: 'world:env_updated',
                timeOfDay: currentRoom.timeOfDay,
                weather: currentRoom.weather,
              });
            } else if (cmd === '/weather') {
              const arg = parts[1] as 'clear' | 'rain' | 'snow';
              if (['clear', 'rain', 'snow'].includes(arg)) {
                currentRoom.weather = arg;
                broadcastToRoom(currentRoom, {
                  type: 'world:env_updated',
                  timeOfDay: currentRoom.timeOfDay,
                  weather: currentRoom.weather,
                });
              }
            }
          }

          const chatMsg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            sender,
            text,
            timestamp: Date.now(),
          };
          currentRoom.chatHistory.push(chatMsg);
          if (currentRoom.chatHistory.length > 80) currentRoom.chatHistory.shift();

          broadcastToRoom(currentRoom, {
            type: 'chat:message',
            chat: chatMsg,
          });
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoom) {
        const p = currentRoom.players.get(playerId);
        currentRoom.players.delete(playerId);
        currentRoom.clients.delete(playerId);

        if (p) {
          const leaveMsg: ChatMessage = {
            id: `leave_${Date.now()}_${Math.random()}`,
            sender: 'Сервер',
            text: `${p.name} покинул игру`,
            timestamp: Date.now(),
            system: true,
          };
          currentRoom.chatHistory.push(leaveMsg);
          broadcastToRoom(currentRoom, {
            type: 'player:left',
            id: playerId,
            chat: leaveMsg,
          });
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Minecraft Voxel Edition Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
