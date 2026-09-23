function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createRoom(code = 'ROOM') {
  return {
    code,
    players: [],
    started: false,
    floorIndex: 0,
    log: ['The elevator doors hiss open.'],
    monster: { active: false, target: null },
    lastTick: Date.now(),
  };
}

function getOrCreateRoom(rooms, code) {
  if (!rooms.has(code)) {
    rooms.set(code, createRoom(code));
  }
  return rooms.get(code);
}

function spawnPlayer(room, name) {
  const player = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: name || 'Player',
    x: randomBetween(10, 90),
    y: randomBetween(15, 85),
    health: 100,
    stamina: 100,
    battery: 100,
    alive: true,
    inventory: [],
    roomCode: room.code,
  };
  room.players.push(player);
  return player;
}

function addLog(room, message) {
  room.log.push(message);
  if (room.log.length > 25) room.log.shift();
}

function startRoom(room) {
  if (room.players.length < 2) return;
  room.started = true;
  room.floorIndex = 0;
  room.monster.active = true;
  room.monster.target = room.players[0]?.id ?? null;
  room.players.forEach((player) => {
    player.x = randomBetween(15, 85);
    player.y = randomBetween(20, 80);
    player.health = 100;
    player.stamina = 100;
    player.battery = 100;
    player.alive = true;
    player.inventory = [];
  });
  addLog(room, 'The descent begins. The darkness is awake.');
}

function resetRoom(room) {
  room.started = false;
  room.floorIndex = 0;
  room.monster.active = false;
  room.monster.target = null;
  room.players.forEach((player) => {
    player.x = randomBetween(15, 85);
    player.y = randomBetween(20, 80);
    player.health = 100;
    player.stamina = 100;
    player.battery = 100;
    player.alive = true;
    player.inventory = [];
  });
  room.log = ['The elevator doors hiss open.'];
  addLog(room, 'The room resets and the descent waits for another team.');
}

function chooseMonsterTarget(room) {
  const alivePlayers = room.players.filter((player) => player.alive);
  if (!alivePlayers.length) return null;
  const current = room.monster.target ? room.players.find((player) => player.id === room.monster.target && player.alive) : null;
  if (current) return current.id;
  return alivePlayers[0].id;
}

function advanceMonster(room) {
  if (!room.started || !room.monster.active) return;
  const targetId = chooseMonsterTarget(room);
  room.monster.target = targetId;
  if (!targetId) return;

  const target = room.players.find((player) => player.id === targetId && player.alive);
  if (!target) return;

  const dangerLevel = 4 + room.floorIndex * 2;
  const monsterX = target.x + 8;
  const monsterY = target.y + 8;
  for (const player of room.players) {
    if (!player.alive) continue;
    if (Math.abs(player.x - monsterX) <= 8 && Math.abs(player.y - monsterY) <= 8) {
      player.health = clamp(player.health - dangerLevel, 0, 100);
      if (player.health <= 0) {
        player.alive = false;
        addLog(room, `${player.name} was swallowed by the darkness.`);
      }
    }
  }
}

function handleMove(room, player, payload) {
  if (!room.started || !player.alive) return;
  player.x = clamp(Number(payload.x) || player.x, 4, 96);
  player.y = clamp(Number(payload.y) || player.y, 8, 92);
  if (payload.running) {
    player.stamina = clamp(player.stamina - 2, 0, 100);
  } else {
    player.stamina = clamp(player.stamina + 1, 0, 100);
  }
  player.battery = payload.flashlight ? clamp(player.battery - 0.5, 0, 100) : clamp(player.battery + 0.4, 0, 100);
  if (room.monster.active) {
    const target = room.players.find((p) => p.id === room.monster.target && p.alive);
    if (target && Math.abs(player.x - target.x) <= 12 && Math.abs(player.y - target.y) <= 12) {
      player.health = clamp(player.health - 3, 0, 100);
      if (player.health <= 0) {
        player.alive = false;
        addLog(room, `${player.name} was swallowed by the darkness.`);
      }
    }
  }
}

function handleInteract(room, player, payload) {
  if (!room.started || !player.alive) return;

  switch (payload.action) {
    case 'search': {
      const item = Math.random() > 0.5 ? 'battery' : 'medkit';
      if (player.inventory.includes(item)) {
        addLog(room, `${player.name} searches but finds nothing new.`);
      } else {
        player.inventory.push(item);
        addLog(room, `${player.name} finds a ${item.toUpperCase()}.`);
      }
      break;
    }
    case 'use': {
      if (player.inventory.includes('medkit')) {
        player.inventory = player.inventory.filter((item) => item !== 'medkit');
        player.health = clamp(player.health + 35, 0, 100);
        addLog(room, `${player.name} uses a MEDKIT and steadies themself.`);
        break;
      }

      if (player.inventory.includes('battery')) {
        player.inventory = player.inventory.filter((item) => item !== 'battery');
        player.battery = clamp(player.battery + 45, 0, 100);
        addLog(room, `${player.name} swaps in a fresh BATTERY.`);
        break;
      }

      addLog(room, `${player.name} has nothing useful to use.`);
      break;
    }
    case 'advance': {
      room.floorIndex = clamp(room.floorIndex + 1, 0, 6);
      addLog(room, `${player.name} pushes deeper into the structure.`);
      if (room.floorIndex === 6) {
        room.monster.active = false;
        addLog(room, 'The doors to the surface groan open.');
      }
      break;
    }
    case 'fuse': {
      if (room.floorIndex >= 5 && room.floorIndex < 6) {
        room.floorIndex = 6;
        room.monster.active = false;
        addLog(room, `${player.name} restores the fuse. The exit route is live.`);
      } else {
        addLog(room, `${player.name} fumbles at the wrong controls.`);
      }
      break;
    }
    case 'escape': {
      if (room.floorIndex === 6) {
        room.started = false;
        room.monster.active = false;
        room.monster.target = null;
        addLog(room, `${player.name} escapes through the emergency doors.`);
      }
      break;
    }
    default:
      break;
  }
}

function getState(room) {
  const floorNames = [
    'Lobby',
    'Sublevel 1',
    'Sublevel 2',
    'Sublevel 3',
    'Sublevel 4',
    'Fuse Chamber',
    'Emergency Exit',
  ];

  const alivePlayers = room.players.filter((player) => player.alive);
  if (room.started && alivePlayers.length === 0) {
    room.started = false;
    room.monster.active = false;
    room.monster.target = null;
  }

  let outcome = 'active';
  if (!room.started) {
    if (room.players.length > 0 && room.players.every((player) => !player.alive)) {
      outcome = 'defeat';
    } else if (room.floorIndex === 6 && room.players.some((player) => player.alive)) {
      outcome = 'victory';
    } else {
      outcome = 'none';
    }
  }

  const survivors = room.players.filter((player) => player.alive);
  const summary = !room.started
    ? [
        outcome === 'victory'
          ? `${survivors.length} survivor${survivors.length === 1 ? '' : 's'} escaped the facility.`
          : outcome === 'defeat'
            ? 'Everyone was lost to the darkness.'
            : 'The room is waiting for the next descent.',
        ...room.players.map((player) => `${player.name}: ${player.alive ? 'escaped alive' : 'did not survive'}`),
      ]
    : [];

  return {
    started: room.started,
    floor: room.started ? room.floorIndex + 1 : 0,
    floorIndex: room.floorIndex,
    floorName: room.started ? floorNames[room.floorIndex] ?? 'Unknown' : 'LOBBY',
    objective: !room.started
      ? (outcome === 'defeat' ? 'All survivors were lost' : outcome === 'victory' ? 'Survivors escaped' : 'Awaiting the descent')
      : room.floorIndex < 5
        ? 'Search for a route out'
        : room.floorIndex === 5
          ? 'Restore the main fuse'
          : 'Reach the emergency doors',
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
      health: player.health,
      stamina: player.stamina,
      battery: player.battery,
      alive: player.alive,
      inventory: [...player.inventory],
    })),
    log: room.log.slice(-14),
    monster: {
      active: room.monster.active,
      target: room.monster.target,
    },
    outcome,
    summary,
  };
}

module.exports = {
  randomBetween,
  clamp,
  createRoom,
  getOrCreateRoom,
  spawnPlayer,
  addLog,
  startRoom,
  resetRoom,
  handleMove,
  handleInteract,
  advanceMonster,
  chooseMonsterTarget,
  getState,
};
