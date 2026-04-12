const {
  PLAYER_SIZE,
  WORLD_SIZE,
} = require("../config");
const { SERVER_MESSAGE_TYPES } = require("../net/protocol");
const { resetPlayerWeapon } = require("./weapon-drop-system");
const { getWeaponDefinition } = require("./weapon-system");
const { randomSpawn } = require("../world/spawn");
const { resetRoomSyncState } = require("../world/room-manager");

let nextBulletId = 1;

function normalize(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }

  return {
    x: dx / length,
    y: dy / length,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rotateDirection(direction, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: direction.x * cos - direction.y * sin,
    y: direction.x * sin + direction.y * cos,
  };
}

function respawnPlayer(player) {
  const spawn = randomSpawn();
  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = player.maxHp;
  player.hitFlashUntil = 0;
  player.dashTimeRemaining = 0;
  player.dashCooldownRemaining = 0;
  resetPlayerWeapon(player);
}

function getAlivePlayers(players) {
  return Object.values(players).filter((player) => !player.isEliminated);
}

function handlePlayerElimination({ hitTarget, players, room, roomId, wss, broadcast }) {
  hitTarget.livesRemaining = Math.max(0, (hitTarget.livesRemaining || 0) - 1);

  if (hitTarget.livesRemaining > 0) {
    respawnPlayer(hitTarget);
    return;
  }

  hitTarget.isEliminated = true;
  hitTarget.hp = 0;
  hitTarget.hitFlashUntil = 0;
  hitTarget.dashTimeRemaining = 0;
  hitTarget.dashCooldownRemaining = 0;

  const alivePlayers = getAlivePlayers(players);

  if (alivePlayers.length <= 1) {
    const winner = alivePlayers[0] || null;
    room.status = "waiting";
    resetRoomSyncState(room);
    room.gameStartAt = null;

    for (const member of Object.values(room.members || {})) {
      member.isReady = false;
    }

    broadcast(wss, roomId, {
      type: SERVER_MESSAGE_TYPES.MATCH_OVER,
      winnerId: winner?.id || null,
      winnerDisplayName: winner?.displayName || null,
    });
  }
}

function createBullet(ownerId, player, direction, weapon) {
  const now = Date.now();
  return {
    id: `b${nextBulletId++}`,
    ownerId,
    weaponId: weapon.id,
    x: player.x + PLAYER_SIZE / 2,
    y: player.y + PLAYER_SIZE / 2,
    dirX: direction.x,
    dirY: direction.y,
    speed: weapon.bullet.speed,
    length: weapon.bullet.length,
    radius: weapon.bullet.radius,
    damage: weapon.bullet.damage,
    maxDistance: weapon.bullet.maxDistance,
    distanceTravelled: 0,
    spawnedAt: now,
  };
}

function serializeBullet(bullet) {
  return {
    id: bullet.id,
    ownerId: bullet.ownerId,
    weaponId: bullet.weaponId,
    x: bullet.x,
    y: bullet.y,
    dirX: bullet.dirX,
    dirY: bullet.dirY,
    length: bullet.length,
    speed: bullet.speed,
    radius: bullet.radius,
    maxDistance: bullet.maxDistance,
    damage: bullet.damage,
    distanceTravelled: bullet.distanceTravelled,
    spawnedAt: bullet.spawnedAt,
  };
}

function handleShoot({ players, bullets, playerId, data, roomId, wss, broadcast }) {
  const player = players[playerId];
  if (!player) return;
  if (player.isEliminated) return;
  const weapon = getWeaponDefinition(player.currentWeaponId);

  const now = Date.now();
  if (now - player.lastShotTime < weapon.fireIntervalMs) {
    return;
  }

  const originX = player.x + PLAYER_SIZE / 2;
  const originY = player.y + PLAYER_SIZE / 2;
  const direction = normalize(data.aimX - originX, data.aimY - originY);
  if (!direction) {
    return;
  }

  player.lastShotTime = now;
  player.aimFacing.x = direction.x;
  player.aimFacing.y = direction.y;

  const pelletCount = Math.max(1, weapon.pelletCount || 1);
  const spreadRadians = ((weapon.pelletSpreadDeg || 0) * Math.PI) / 180;
  const spawnedBullets = [];

  for (let index = 0; index < pelletCount; index += 1) {
    const spreadOffset =
      pelletCount === 1 ? 0 : (Math.random() - 0.5) * spreadRadians;
    const pelletDirection = rotateDirection(direction, spreadOffset);
    const bullet = createBullet(playerId, player, pelletDirection, weapon);
    bullets[bullet.id] = bullet;
    spawnedBullets.push(bullet);
  }

  for (const bullet of spawnedBullets) {
    broadcast(wss, roomId, {
      type: SERVER_MESSAGE_TYPES.BULLET_SPAWN,
      bullet: serializeBullet(bullet),
    });
  }
}

function circleIntersectsPlayer(bullet, player) {
  const closestX = clamp(bullet.x, player.x, player.x + PLAYER_SIZE);
  const closestY = clamp(bullet.y, player.y, player.y + PLAYER_SIZE);
  const dx = bullet.x - closestX;
  const dy = bullet.y - closestY;

  return dx * dx + dy * dy <= bullet.radius * bullet.radius;
}

function segmentIntersectsExpandedRect(startX, startY, endX, endY, rect, padding) {
  const minX = rect.x - padding;
  const minY = rect.y - padding;
  const maxX = rect.x + PLAYER_SIZE + padding;
  const maxY = rect.y + PLAYER_SIZE + padding;
  const dx = endX - startX;
  const dy = endY - startY;

  let tMin = 0;
  let tMax = 1;

  if (dx === 0) {
    if (startX < minX || startX > maxX) {
      return null;
    }
  } else {
    const invDx = 1 / dx;
    let t1 = (minX - startX) * invDx;
    let t2 = (maxX - startX) * invDx;

    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);

    if (tMin > tMax) {
      return null;
    }
  }

  if (dy === 0) {
    if (startY < minY || startY > maxY) {
      return null;
    }
  } else {
    const invDy = 1 / dy;
    let t1 = (minY - startY) * invDy;
    let t2 = (maxY - startY) * invDy;

    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);

    if (tMin > tMax) {
      return null;
    }
  }

  return tMin;
}

function updateBullets({ bullets, players, room, deltaTime, roomId, wss, broadcast }) {
  const now = Date.now();

  for (const id in bullets) {
    const bullet = bullets[id];
    const remainingDistance = Math.max(0, bullet.maxDistance - bullet.distanceTravelled);
    const intendedDistance = bullet.speed * deltaTime;
    const stepDistance = Math.min(intendedDistance, remainingDistance);
    const startX = bullet.x;
    const startY = bullet.y;
    const endX = startX + bullet.dirX * stepDistance;
    const endY = startY + bullet.dirY * stepDistance;
    let hitTarget = null;
    let hitT = Number.POSITIVE_INFINITY;

    for (const playerId in players) {
      if (playerId === bullet.ownerId) continue;

      const player = players[playerId];
      const collisionT = segmentIntersectsExpandedRect(
        startX,
        startY,
        endX,
        endY,
        player,
        bullet.radius
      );

      if (collisionT !== null && collisionT < hitT) {
        hitTarget = player;
        hitT = collisionT;
      }
    }

    bullet.x = endX;
    bullet.y = endY;
    bullet.distanceTravelled += stepDistance;

    if (hitTarget) {
      bullet.x = startX + (endX - startX) * hitT;
      bullet.y = startY + (endY - startY) * hitT;

      if (!circleIntersectsPlayer(bullet, hitTarget)) {
        bullet.x = endX;
        bullet.y = endY;
      }

      hitTarget.hp -= bullet.damage;
      hitTarget.hitFlashUntil = now + 150;

      broadcast(wss, roomId, {
        type: SERVER_MESSAGE_TYPES.HIT,
        attackerId: bullet.ownerId,
        targetId: hitTarget.id,
        damage: bullet.damage,
        x: bullet.x,
        y: bullet.y,
      });

      if (hitTarget.hp <= 0) {
        handlePlayerElimination({
          hitTarget,
          players,
          room,
          roomId,
          wss,
          broadcast,
        });
      }

      broadcast(wss, roomId, {
        type: SERVER_MESSAGE_TYPES.BULLET_REMOVE,
        bulletId: bullet.id,
      });
      delete bullets[id];
      continue;
    }

    const outsideWorld =
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > WORLD_SIZE ||
      bullet.y > WORLD_SIZE ||
      bullet.distanceTravelled >= bullet.maxDistance ||
      stepDistance <= 0;

    if (outsideWorld) {
      broadcast(wss, roomId, {
        type: SERVER_MESSAGE_TYPES.BULLET_REMOVE,
        bulletId: bullet.id,
      });
      delete bullets[id];
    }
  }
}

function serializeBullets(bullets) {
  const result = {};

  for (const id in bullets) {
    result[id] = serializeBullet(bullets[id]);
  }

  return result;
}

module.exports = {
  handleShoot,
  serializeBullets,
  updateBullets,
};
