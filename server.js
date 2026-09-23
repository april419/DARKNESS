const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const {
  createRoom,
  getOrCreateRoom,
  spawnPlayer,
  startRoom,
  handleMove,
  handleInteract,
  getState,
} = require('./gameCore');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const rooms = new Map();
const clients = new Map();
const playerSockets = new Map();

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function broadcast(room) {
  const state = getState(room);
  const payload = JSON.stringify({ type: 'state', state });
  room.players.forEach((player) => {
    const socket = playerSockets.get(player.id);
    if (socket && socket.readyState === 1) {
      socket.send(payload);
    }
  });
}

function addLog(room, message) {
  room.log.push(message);
  if (room.log.length > 25) room.log.shift();
}

function removePlayer(playerId) {
  playerSockets.delete(playerId);
  for (const [code, room] of rooms) {
    const index = room.players.findIndex((player) => player.id === playerId);
    if (index >= 0) {
      room.players.splice(index, 1);
      addLog(room, 'A figure slips out of the shadows.');
      if (!room.players.length) {
        rooms.delete(code);
      } else if (room.started && room.monster.target === playerId) {
        room.monster.target = room.players[0]?.id ?? null;
      }
      break;
    }
  }
}

function handleMessage(ws, rawMessage) {
  try {
    const data = JSON.parse(rawMessage);
    const client = clients.get(ws);
    if (!client) return;

    if (data.type === 'create') {
      const code = roomCode();
      const newRoom = getOrCreateRoom(rooms, code);
      const player = spawnPlayer(newRoom, data.name || 'Player');
      playerSockets.set(player.id, ws);
      clients.set(ws, { id: player.id, roomCode: code, readyState: ws.readyState });
      ws.send(JSON.stringify({ type: 'joined', playerId: player.id, room: code }));
      broadcast(newRoom);
      return;
    }

    if (data.type === 'join') {
      const roomCodeFromInput = String(data.room || '').trim().toUpperCase();
      const targetRoom = rooms.get(roomCodeFromInput) || getOrCreateRoom(rooms, roomCodeFromInput);
      if (!targetRoom || !targetRoom.code || targetRoom.players.length >= 8) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full.' }));
        return;
      }
      const player = spawnPlayer(targetRoom, data.name || 'Player');
      playerSockets.set(player.id, ws);
      clients.set(ws, { id: player.id, roomCode: targetRoom.code, readyState: ws.readyState });
      ws.send(JSON.stringify({ type: 'joined', playerId: player.id, room: targetRoom.code }));
      broadcast(targetRoom);
      return;
    }

    if (data.type === 'start') {
      const roomForPlayer = rooms.get(client.roomCode);
      if (roomForPlayer) {
        startRoom(roomForPlayer);
        broadcast(roomForPlayer);
      }
      return;
    }

    if (data.type === 'reset') {
      const roomForPlayer = rooms.get(client.roomCode);
      if (roomForPlayer) {
        const { resetRoom } = require('./gameCore');
        resetRoom(roomForPlayer);
        broadcast(roomForPlayer);
      }
      return;
    }

    if (data.type === 'move') {
      const roomForPlayer = rooms.get(client.roomCode);
      const player = roomForPlayer?.players.find((p) => p.id === client.id);
      if (roomForPlayer && player) {
        handleMove(roomForPlayer, player, data);
        broadcast(roomForPlayer);
      }
      return;
    }

    if (data.type === 'interact') {
      const roomForPlayer = rooms.get(client.roomCode);
      const player = roomForPlayer?.players.find((p) => p.id === client.id);
      if (roomForPlayer && player) {
        handleInteract(roomForPlayer, player, data);
        broadcast(roomForPlayer);
      }
    }
  } catch (error) {
    console.error('Failed to parse message', error);
  }
}

function createServer(port) {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname;
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(PUBLIC_DIR, `.${safePath}`);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
      }[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server error');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.set(ws, { id: null, roomCode: null, readyState: ws.readyState });

    ws.on('message', (raw) => handleMessage(ws, raw.toString()));
    ws.on('close', () => {
      const client = clients.get(ws);
      if (client && client.id) removePlayer(client.id);
      clients.delete(ws);
    });
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is busy. Retrying on ${port + 1}.`);
      setTimeout(() => createServer(port + 1), 125);
      server.close();
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    console.log(`Darkness server running at http://localhost:${port}`);
  });
}

createServer(PORT);
