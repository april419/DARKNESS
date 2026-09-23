const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoom, spawnPlayer, startRoom, resetRoom, handleMove, handleInteract, getState, advanceMonster, chooseMonsterTarget } = require('./gameCore');

test('createRoom gives a fresh room with lobby state', () => {
  const room = createRoom('TEST');
  assert.equal(room.code, 'TEST');
  assert.equal(room.started, false);
  assert.equal(room.floorIndex, 0);
  assert.equal(room.players.length, 0);
});

test('startRoom begins the match when two players are present', () => {
  const room = createRoom('TEST');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  assert.equal(room.started, true);
  assert.equal(room.players.length, 2);
  assert.equal(room.monster.active, true);
  assert.ok(p1.health > 0 && p2.health > 0);
});

test('handleInteract advance moves the round and updates the state object', () => {
  const room = createRoom('TEST');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  room.floorIndex = 0;
  handleInteract(room, p1, { action: 'advance' });
  const state = getState(room);
  assert.equal(state.floorIndex, 1);
  assert.equal(state.players[0].id, p1.id);
  assert.equal(room.log.at(-1).includes('A'), true);
});

test('handleMove reduces a player health when monster reaches them', () => {
  const room = createRoom('TEST');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  room.monster.active = true;
  room.monster.target = p1.id;
  p1.x = 50;
  p1.y = 50;
  p2.x = 50;
  p2.y = 50;
  handleMove(room, p2, { x: 50, y: 50, running: true, flashlight: true });
  assert.ok(p2.health < 100 || !p2.alive || room.monster.target === p1.id);
});

test('advanceMonster selects a living target and pressures the room', () => {
  const room = createRoom('TEST');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  room.monster.active = true;
  room.monster.target = p1.id;
  p1.x = 20;
  p1.y = 20;
  p2.x = 20;
  p2.y = 20;
  assert.equal(chooseMonsterTarget(room), p1.id);
  advanceMonster(room);
  assert.ok(room.monster.target === p1.id || room.monster.target === p2.id);
});

test('handleInteract use medkit restores health and consumes the item', () => {
  const room = createRoom('TEST');
  const p1 = spawnPlayer(room, 'A');
  spawnPlayer(room, 'B');
  startRoom(room);
  p1.health = 35;
  p1.inventory = ['medkit'];

  handleInteract(room, p1, { action: 'use' });

  assert.equal(p1.inventory.includes('medkit'), false);
  assert.ok(p1.health > 35);
});

test('handleInteract use battery restores flashlight charge and consumes the item', () => {
  const room = createRoom('TEST');
  const p1 = spawnPlayer(room, 'A');
  spawnPlayer(room, 'B');
  startRoom(room);
  p1.battery = 20;
  p1.inventory = ['battery'];

  handleInteract(room, p1, { action: 'use' });

  assert.equal(p1.inventory.includes('battery'), false);
  assert.ok(p1.battery > 20);
});

test('advanceMonster hits harder on deeper floors', () => {
  const roomLow = createRoom('LOW');
  const p1Low = spawnPlayer(roomLow, 'A');
  const p2Low = spawnPlayer(roomLow, 'B');
  startRoom(roomLow);
  roomLow.floorIndex = 0;
  roomLow.monster.active = true;
  roomLow.monster.target = p1Low.id;
  p1Low.x = 50;
  p1Low.y = 50;
  p2Low.x = 50;
  p2Low.y = 50;
  const lowHealth = p1Low.health;
  advanceMonster(roomLow);

  const roomDeep = createRoom('DEEP');
  const p1Deep = spawnPlayer(roomDeep, 'A');
  const p2Deep = spawnPlayer(roomDeep, 'B');
  startRoom(roomDeep);
  roomDeep.floorIndex = 3;
  roomDeep.monster.active = true;
  roomDeep.monster.target = p1Deep.id;
  p1Deep.x = 50;
  p1Deep.y = 50;
  p2Deep.x = 50;
  p2Deep.y = 50;
  const deepHealth = p1Deep.health;
  advanceMonster(roomDeep);

  assert.ok(lowHealth > p1Low.health);
  assert.ok(p1Deep.health < p1Low.health || p1Deep.health < deepHealth);
});

test('room ends when all players are eliminated', () => {
  const room = createRoom('END');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  p1.alive = false;
  p2.alive = false;

  const state = getState(room);

  assert.equal(state.started, false);
  assert.equal(state.outcome, 'defeat');
});

test('survivors win when they escape', () => {
  const room = createRoom('WIN');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  room.floorIndex = 6;
  p1.alive = true;
  p2.alive = true;

  handleInteract(room, p1, { action: 'escape' });
  const state = getState(room);

  assert.equal(state.started, false);
  assert.equal(state.outcome, 'victory');
});

test('resetRoom clears the round back to lobby with the same players', () => {
  const room = createRoom('RESET');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  room.floorIndex = 6;
  p1.health = 15;
  p2.health = 20;
  p1.inventory = ['medkit'];
  p2.inventory = ['battery'];

  resetRoom(room);

  assert.equal(room.started, false);
  assert.equal(room.floorIndex, 0);
  assert.equal(room.players.length, 2);
  assert.equal(room.players.every((player) => player.alive), true);
  assert.equal(room.players.every((player) => player.health === 100), true);
});

test('chooseMonsterTarget keeps a living current target', () => {
  const room = createRoom('CHASE');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  p1.x = 10;
  p1.y = 10;
  p2.x = 15;
  p2.y = 15;
  room.monster.target = p1.id;

  const target = chooseMonsterTarget(room);

  assert.equal(target, p1.id);
});

test('getState includes a match summary after a run resolves', () => {
  const room = createRoom('SUMMARY');
  const p1 = spawnPlayer(room, 'A');
  const p2 = spawnPlayer(room, 'B');
  startRoom(room);
  room.floorIndex = 6;
  handleInteract(room, p1, { action: 'escape' });

  const state = getState(room);

  assert.equal(state.outcome, 'victory');
  assert.ok(Array.isArray(state.summary));
  assert.equal(state.summary[0].includes('escaped'), true);
});
