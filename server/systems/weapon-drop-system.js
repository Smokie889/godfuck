const { PLAYER_SIZE, WORLD_SIZE } = require("../config");
const { randomSpawn } = require("../world/spawn");
const { DEFAULT_WEAPON_ID, getWeaponDefinition } = require("./weapon-system");

const DEFAULT_DROP_COUNT = 2;
const PICKUP_RANGE = 34;

let nextDropId = 1;

function createWeaponDrop(weaponId, spawn = randomSpawn()) {
  const weapon = getWeaponDefinition(weaponId);

  return {
    id: `wd${nextDropId++}`,
    weaponId: weapon.id,
    x: Math.max(28, Math.min(WORLD_SIZE - 28, spawn.x + PLAYER_SIZE / 2)),
    y: Math.max(28, Math.min(WORLD_SIZE - 28, spawn.y + PLAYER_SIZE / 2)),
  };
}

function serializeWeaponDrop(drop) {
  return {
    id: drop.id,
    weaponId: drop.weaponId,
    x: drop.x,
    y: drop.y,
  };
}

function serializeWeaponDrops(weaponDrops) {
  const result = {};

  for (const id in weaponDrops) {
    result[id] = serializeWeaponDrop(weaponDrops[id]);
  }

  return result;
}

function ensureWeaponDrops(weaponDrops, desiredCount = DEFAULT_DROP_COUNT) {
  while (Object.keys(weaponDrops).length < desiredCount) {
    const drop = createWeaponDrop("shotgun");
    weaponDrops[drop.id] = drop;
  }
}

function findNearbyWeaponDrop(player, weaponDrops) {
  const playerCenterX = player.x + PLAYER_SIZE / 2;
  const playerCenterY = player.y + PLAYER_SIZE / 2;
  let nearestDrop = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const dropId in weaponDrops) {
    const drop = weaponDrops[dropId];
    const distance = Math.hypot(drop.x - playerCenterX, drop.y - playerCenterY);

    if (distance > PICKUP_RANGE || distance >= nearestDistance) {
      continue;
    }

    nearestDrop = drop;
    nearestDistance = distance;
  }

  return nearestDrop;
}

function resetPlayerWeapon(player) {
  player.currentWeaponId = DEFAULT_WEAPON_ID;
}

module.exports = {
  DEFAULT_DROP_COUNT,
  PICKUP_RANGE,
  createWeaponDrop,
  ensureWeaponDrops,
  findNearbyWeaponDrop,
  resetPlayerWeapon,
  serializeWeaponDrop,
  serializeWeaponDrops,
};
