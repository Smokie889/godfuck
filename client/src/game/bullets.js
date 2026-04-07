import { PLAYER_SIZE } from "../config.js";

export function copyBulletState(source) {
  return {
    id: source.id,
    ownerId: source.ownerId,
    x: source.x,
    y: source.y,
    dirX: source.dirX,
    dirY: source.dirY,
    length: source.length,
    speed: source.speed,
    radius: source.radius || 3,
    maxDistance: source.maxDistance,
    distanceTravelled: source.distanceTravelled || 0,
    spawnedAt: source.spawnedAt || Date.now(),
  };
}

function circleIntersectsRect(bullet, rect) {
  const closestX = Math.max(rect.x, Math.min(bullet.x, rect.x + PLAYER_SIZE));
  const closestY = Math.max(rect.y, Math.min(bullet.y, rect.y + PLAYER_SIZE));
  const dx = bullet.x - closestX;
  const dy = bullet.y - closestY;
  const radius = bullet.radius || 3;

  return dx * dx + dy * dy <= radius * radius;
}

export function updateLocalBullets(state, deltaTime, worldSize) {
  for (const id in state.bullets) {
    const bullet = state.bullets[id];
    const distance = bullet.speed * deltaTime;

    bullet.x += bullet.dirX * distance;
    bullet.y += bullet.dirY * distance;
    bullet.distanceTravelled += distance;

    const outsideWorld =
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > worldSize ||
      bullet.y > worldSize ||
      bullet.distanceTravelled >= bullet.maxDistance;

    if (outsideWorld) {
      delete state.bullets[id];
      continue;
    }

    for (const playerId in state.renderPlayers) {
      if (playerId === bullet.ownerId) {
        continue;
      }

      const playerPosition = state.renderPlayers[playerId];
      if (!playerPosition) {
        continue;
      }

      if (circleIntersectsRect(bullet, playerPosition)) {
        delete state.bullets[id];
        break;
      }
    }
  }
}
