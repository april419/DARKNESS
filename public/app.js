let ws, myId, roomCode, running = false, flashlight = true;
let flashlightAngle = 0;
const $ = (id) => document.getElementById(id);
const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const FLOOR_THEMES = [
  { bg1: '#3b4139', bg2: '#1c201c', accent: '#d2d3b1', glow: 'rgba(210, 211, 177, 0.12)', border: 'rgba(180, 196, 170, 0.18)' },
  { bg1: '#4b5146', bg2: '#212620', accent: '#dfe4b8', glow: 'rgba(223, 228, 184, 0.12)', border: 'rgba(202, 212, 178, 0.18)' },
  { bg1: '#4f4948', bg2: '#1e1a1b', accent: '#d9b4a6', glow: 'rgba(217, 180, 166, 0.12)', border: 'rgba(216, 182, 160, 0.18)' },
  { bg1: '#3c3433', bg2: '#171210', accent: '#e4b08d', glow: 'rgba(228, 176, 141, 0.12)', border: 'rgba(220, 188, 160, 0.18)' },
  { bg1: '#3f3d2e', bg2: '#17170d', accent: '#d8d082', glow: 'rgba(216, 208, 130, 0.12)', border: 'rgba(211, 205, 130, 0.18)' },
  { bg1: '#41333d', bg2: '#171216', accent: '#dbb8c6', glow: 'rgba(219, 184, 198, 0.12)', border: 'rgba(219, 184, 198, 0.18)' },
  { bg1: '#2d392d', bg2: '#0f140f', accent: '#cfe2b4', glow: 'rgba(207, 226, 180, 0.12)', border: 'rgba(199, 226, 175, 0.18)' },
];
const WALLS = [
  { x: 18, y: 16, w: 10, h: 54 },
  { x: 72, y: 14, w: 10, h: 52 },
  { x: 34, y: 58, w: 32, h: 8 },
  { x: 24, y: 72, w: 52, h: 8 },
  { x: 48, y: 24, w: 8, h: 26 },
];

function applyFloorTheme(floorIndex) {
  const board = document.querySelector('.gameBoard');
  if (!board) return;
  const theme = FLOOR_THEMES[Math.max(0, Math.min(floorIndex, FLOOR_THEMES.length - 1))] || FLOOR_THEMES[0];
  board.style.setProperty('--theme-bg-1', theme.bg1);
  board.style.setProperty('--theme-bg-2', theme.bg2);
  board.style.setProperty('--theme-accent', theme.accent);
  board.style.setProperty('--theme-glow', theme.glow);
  board.style.setProperty('--theme-border', theme.border);
}

function isWallCollision(x, y) {
  return WALLS.some((wall) => x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h);
}

function clampPoint(x, y) {
  const nextX = clamp(Number(x) || 50, 4, 96);
  const nextY = clamp(Number(y) || 50, 8, 92);
  if (isWallCollision(nextX, nextY)) {
    return { x: clamp((Number(x) || 50) - 3, 4, 96), y: clamp((Number(y) || 50) - 3, 8, 92) };
  }
  return { x: nextX, y: nextY };
}

function connect(msg) {
  ws = new WebSocket(wsUrl());
  ws.onopen = () => ws.send(JSON.stringify(msg));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'error') {
      $('error').textContent = m.message;
    }
    if (m.type === 'joined') {
      myId = m.playerId;
      roomCode = m.room;
      $('roomCode').textContent = roomCode;
      showLobby();
    }
    if (m.type === 'state') {
      render(m.state);
    }
  };
  ws.onclose = () => {
    if (running) {
      showOverlay('CONNECTION LOST', 'The building connection was interrupted.', 'RELOAD');
    }
  };
}

$('create').onclick = () => connect({ type: 'create', name: $('name').value.trim() || 'Player' });
$('join').onclick = () => connect({ type: 'join', room: $('room').value.trim(), name: $('name').value.trim() || 'Player' });
$('start').onclick = () => send({ type: 'start' });

function send(x) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(x));
}

function showLobby() {
  $('startScreen').classList.add('hidden');
  $('lobbyScreen').classList.remove('hidden');
}

function startGameUI() {
  running = true;
  $('lobbyScreen').classList.add('hidden');
  $('game').classList.remove('hidden');
}

function render(s) {
  const floorIndex = s.started ? (Number(s.floorIndex) || 0) : 0;
  applyFloorTheme(floorIndex);

  if (s.started && $('game').classList.contains('hidden')) {
    startGameUI();
  }

  if (!s.started && running && s.floorIndex === 0) {
    // Lobby state is still active while the room resets.
  }

  if (s.outcome === 'victory') {
    showOverlay('SURVIVORS ESCAPED', `${s.summary[0] || 'A team made it out alive.'}\n${s.summary.slice(1).join(' • ')}`, 'RESTART');
  } else if (s.outcome === 'defeat') {
    showOverlay('ALL PLAYERS LOST', `${s.summary[0] || 'The darkness consumed everyone in the facility.'}\n${s.summary.slice(1).join(' • ')}`, 'RESTART');
  }

  $('floor').textContent = s.floor;
  $('floorName').textContent = (s.floorName || 'LOBBY').toUpperCase();
  $('objective').textContent = (s.objective || 'AWAITING').toUpperCase();

  const me = s.players.find((p) => p.id === myId);
  if (me) {
    const usableItem = me.inventory.includes('medkit') ? 'medkit' : me.inventory.includes('battery') ? 'battery' : null;
    $('health').textContent = Math.round(me.health);
    $('stamina').textContent = Math.round(me.stamina);
    $('battery').textContent = Math.round(me.battery);
    $('inventory').textContent = 'INVENTORY: ' + (me.inventory.length ? me.inventory.map((x) => x.toUpperCase()).join(' • ') : 'EMPTY');
    $('useItem').textContent = usableItem ? `USE ${usableItem.toUpperCase()}` : 'USE ITEM';
    $('useItem').disabled = !usableItem;
    if (!me.alive) {
      showOverlay('PLAYER ELIMINATED', 'You are out of this round. Your teammates can continue.', 'WATCH');
    }
  }

  const localize = (point) => {
    if (!me) return { left: 50, top: 50 };
    const dx = point.x - me.x;
    const dy = point.y - me.y;
    return {
      left: clamp(50 + dx * 1.65, 10, 90),
      top: clamp(50 + dy * 1.65, 12, 88),
    };
  };

  const wallView = (wall) => {
    const center = { x: wall.x + wall.w / 2, y: wall.y + wall.h / 2 };
    const pos = localize(center);
    return {
      left: pos.left - wall.w * 0.825,
      top: pos.top - wall.h * 0.825,
      width: wall.w * 1.65,
      height: wall.h * 1.65,
    };
  };

  const visiblePlayers = (s.players || []).filter((p) => {
    if (!me) return true;
    if (p.id === me.id) return true;
    return Math.abs(p.x - me.x) < 38 && Math.abs(p.y - me.y) < 38;
  });

  $('wallLayer').innerHTML = WALLS.map((wall) => {
    const view = wallView(wall);
    return `<div class="wall" style="left:${view.left}%;top:${view.top}%;width:${view.width}%;height:${view.height}%"></div>`;
  }).join('');

  $('players').innerHTML = visiblePlayers.map((p) => {
    const pos = p.id === me?.id ? { left: 50, top: 50 } : localize(p);
    return `<div class="player ${p.id === myId ? 'me' : ''} ${p.alive ? '' : 'dead'}" style="left:${pos.left}%;top:${pos.top}%"></div>`;
  }).join('');

  if (me) {
    const board = $('visionOverlay');
    const light = flashlight ? 0.9 : 0.5;
    board.style.background = `radial-gradient(circle at ${me.x}% ${me.y}%, rgba(178, 214, 255, ${0.18 + light * 0.22}) 0%, rgba(20, 28, 40, 0.3) 18%, rgba(6, 9, 15, 0.85) 40%, rgba(3, 5, 12, 0.98) 75%)`;
    board.style.setProperty('--flashlight-angle', `${flashlightAngle}deg`);
  }

  $('playerList').innerHTML = s.players.map((p) => `
    <div class="pRow ${p.alive ? '' : 'dead'}">
      <span>${p.name}</span>
      <span>${p.alive ? Math.round(p.health) + ' HP' : 'ELIMINATED'}</span>
    </div>`).join('');

  $('lobbyPlayers').innerHTML = s.players.map((p) => `<div>${p.name}</div>`).join('');
  $('start').disabled = s.players.length < 2 || s.started;
  $('lobbyHint').textContent = s.players.length < 2
    ? 'Waiting for at least 2 players...'
    : s.started
      ? 'Game in progress'
      : 'Ready. Start the descent.';

  $('log').innerHTML = s.log.map((x) => `
    <div class="logLine ${/MOVEMENT|ELIMINATED|DARKNESS|OPEN/.test(x) ? 'alert' : ''}">${x}</div>`).join('');

  const monsterTarget = s.monster.active ? s.players.find((p) => p.id === s.monster.target) : null;
  $('monster').classList.toggle('hidden', !s.monster.active || !monsterTarget || !me);
  $('monster').innerHTML = '<span class="eye left"></span><span class="eye right"></span>';
  if (s.monster.active && monsterTarget && me) {
    const pos = localize(monsterTarget);
    $('monster').style.left = pos.left + '%';
    $('monster').style.top = pos.top + '%';
  }

  const fusePos = me ? localize({ x: 76, y: 18 }) : { left: 75, top: 18 };
  const escapePos = me ? localize({ x: 82, y: 82 }) : { left: 82, top: 82 };
  $('fuseTarget').classList.toggle('hidden', !(s.floorIndex >= 5 && s.floorIndex < 6));
  $('escapeTarget').classList.toggle('hidden', s.floorIndex !== 6);
  if (s.floorIndex >= 5 && s.floorIndex < 6) {
    $('fuseTarget').style.left = fusePos.left + '%';
    $('fuseTarget').style.top = fusePos.top + '%';
  }
  if (s.floorIndex === 6) {
    $('escapeTarget').style.left = escapePos.left + '%';
    $('escapeTarget').style.top = escapePos.top + '%';
  }

  if (me) {
    const currentVision = me.alive ? 'LIVE' : 'DOWN';
    const monsterDistance = monsterTarget ? Math.max(0, Math.round(Math.hypot(monsterTarget.x - me.x, monsterTarget.y - me.y) * 1.4)) : null;
    $('sceneHints').innerHTML = `
      <div><strong>VIEW</strong> ${currentVision}</div>
      <div><strong>MONSTER</strong> ${monsterDistance !== null ? `${monsterDistance}m away` : 'Unseen'}</div>
      <div><strong>EXIT</strong> ${s.floorIndex === 6 ? 'Ahead' : s.floorIndex >= 5 ? 'Nearby' : 'Unknown'}</div>
    `;
    const board = $('visionOverlay');
    board.style.setProperty('--flashlight-x', `${me.x}%`);
    board.style.setProperty('--flashlight-y', `${me.y}%`);
    board.style.setProperty('--flashlight-strength', flashlight ? '1' : '0.45');
  } else {
    $('sceneHints').innerHTML = '<div><strong>VIEW</strong> LOST</div>';
  }

  if (s.floorIndex === 6 && !s.started) {
    showOverlay('GAME COMPLETE', 'The emergency doors are open. At least one survivor made it out.', 'RESTART');
  }
}

$('search').onclick = () => send({ type: 'interact', action: 'search' });
$('useItem').onclick = () => send({ type: 'interact', action: 'use' });
$('advance').onclick = () => send({ type: 'interact', action: 'advance' });
$('fuse').onclick = () => send({ type: 'interact', action: 'fuse' });
$('escape').onclick = () => send({ type: 'interact', action: 'escape' });
$('flashlight').onclick = () => {
  flashlight = !flashlight;
  $('flashlight').textContent = flashlight ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF';
};

const pressedKeys = new Set();

function updateMovementFromKeys() {
  if (!running) return;

  const meEl = document.querySelector('.player.me');
  if (!meEl) return;

  const meX = Number(meEl?.style.left?.replace('%', '') || 50);
  const meY = Number(meEl?.style.top?.replace('%', '') || 55);
  let x = meX;
  let y = meY;
  let dx = 0;
  let dy = 0;

  if (pressedKeys.has('ArrowUp') || pressedKeys.has('w') || pressedKeys.has('W')) { y -= 1.2; dy = -1; }
  if (pressedKeys.has('ArrowDown') || pressedKeys.has('s') || pressedKeys.has('S')) { y += 1.2; dy = 1; }
  if (pressedKeys.has('ArrowLeft') || pressedKeys.has('a') || pressedKeys.has('A')) { x -= 1.2; dx = -1; }
  if (pressedKeys.has('ArrowRight') || pressedKeys.has('d') || pressedKeys.has('D')) { x += 1.2; dx = 1; }

  if (!(dx || dy)) return;

  flashlightAngle = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
  const next = clampPoint(x, y);
  if (isWallCollision(next.x, next.y)) return;
  send({ type: 'move', x: next.x, y: next.y, running: true, flashlight });
}

window.addEventListener('keydown', (e) => {
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
  if (!keys.includes(e.key)) return;

  e.preventDefault();
  pressedKeys.add(e.key);
  updateMovementFromKeys();
});

window.addEventListener('keyup', (e) => {
  pressedKeys.delete(e.key);
});

setInterval(() => {
  updateMovementFromKeys();
}, 40);

function showOverlay(title, text, button) {
  $('overlayTitle').textContent = title;
  $('overlayText').textContent = text;
  $('overlayBtn').textContent = button;
  $('overlay').classList.remove('hidden');
  $('overlayBtn').onclick = () => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'reset' }));
    }
    $('overlay').classList.add('hidden');
    $('game').classList.add('hidden');
    $('lobbyScreen').classList.remove('hidden');
    running = false;
  };
}
