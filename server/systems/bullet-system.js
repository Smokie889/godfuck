const {
  BULLET_DAMAGE,
  BULLET_LENGTH,
  BULLET_MAX_DISTANCE,
  BULLET_RADIUS,
  BULLET_SPEED,
  PLAYER_SIZE,
  SHOOT_INTERVAL_MS,
  WORLD_SIZE,
} = require("../config");
const { SERVER_MESSAGE_TYPES } = require("../net/protocol");
const { randomSpawn } = require("../world/spawn");

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

function respawnPlayer(player) {
  const spawn = randomSpawn();
  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = player.maxHp;
  player.stamina = player.maxStamina;
  player.hitFlashUntil = 0;
  player.dashTimeRemaining = 0;
  player.dashCooldownRemaining = 0;
}

function createBullet(ownerId, player, direction) {
  const now = Date.now();
  return {
    id: `b${nextBulletId++}`,
    ownerId,
    x: player.x + PLAYER_SIZE / 2,
    y: player.y + PLAYER_SIZE / 2,
    dirX: direction.x,
    dirY: direction.y,
    speed: BULLET_SPEED,
    length: BULLET_LENGTH,
    radius: BULLET_RADIUS,
    distanceTravelled: 0,
    spawnedAt: now,
  };
}

function serializeBullet(bullet) {
  return {
    id: bullet.id,
    ownerId: bullet.ownerId,
    x: bullet.x,
    y: bullet.y,
    dirX: bullet.dirX,
    dirY: bullet.dirY,
    length: bullet.length,
    speed: bullet.speed,
    radius: bullet.radius,
    maxDistance: BULLET_MAX_DISTANCE,
    distanceTravelled: bullet.distanceTravelled,
    spawnedAt: bullet.spawnedAt,
  };
}

function handleShoot({ players, bullets, playerId, data, wss, broadcast }) {
  const player = players[playerId];
  if (!player) return;

  const now = Date.now();
  if (now - player.lastShotTime < SHOOT_INTERVAL_MS) {
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

  const bullet = createBullet(playerId, player, direction);
  bullets[bullet.id] = bullet;

  broadcast(wss, {
    type: SERVER_MESSAGE_TYPES.BULLET_SPAWN,
    bullet: serializeBullet(bullet),
  });
}

function circleIntersectsPlayer(bullet, player) {
  const closestX = clamp(bullet.x, player.x, player.x + PLAYER_SIZE);
  const closestY = clamp(bullet.y, player.y, player.y + PLAYER_SIZE);
  const dx = bullet.x - closestX;
  const dy = bullet.y - closestY;

  return dx * dx + dy * dy <= bullet.radius * bullet.radius;
}

function updateBullets({ bullets, players, deltaTime, wss, broadcast }) {
  const now = Date.now();

  for (const id in bullets) {
    const bullet = bullets[id];
    const distance = bullet.speed * deltaTime;

    bullet.x += bullet.dirX * distance;
    bullet.y += bullet.dirY * distance;
    bullet.distanceTravelled += distance;

    const outsideWorld =
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > WORLD_SIZE ||
      bullet.y > WORLD_SIZE ||
      bullet.distanceTravelled >= BULLET_MAX_DISTANCE;

    if (outsideWorld) {
      broadcast(wss, {
        type: SERVER_MESSAGE_TYPES.BULLET_REMOVE,
        bulletId: bullet.id,
      });
      delete bullets[id];
      continue;
    }

    let hitTarget = null;

    for (const playerId in players) {
      if (playerId === bullet.ownerId) continue;

      const player = players[playerId];
      if (circleIntersectsPlayer(bullet, player)) {
        hitTarget = player;
        break;
      }
    }

    if (!hitTarget) {
      continue;
    }

    hitTarget.hp -= BULLET_DAMAGE;
    hitTarget.hitFlashUntil = now + 150;

    broadcast(wss, {
      type: SERVER_MESSAGE_TYPES.HIT,
      attackerId: bullet.ownerId,
      targetId: hitTarget.id,
      damage: BULLET_DAMAGE,
      x: bullet.x,
      y: bullet.y,
    });

    if (hitTarget.hp <= 0) {
      respawnPlayer(hitTarget);
    }

    broadcast(wss, {
      type: SERVER_MESSAGE_TYPES.BULLET_REMOVE,
      bulletId: bullet.id,
    });
    delete bullets[id];
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
