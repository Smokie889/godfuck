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

export function updateLocalBullets(state, deltaTime, worldSize) {
  for (const id in state.bullets) {
    const bullet = state.bullets[id];
    const remainingDistance = Math.max(0, bullet.maxDistance - bullet.distanceTravelled);
    const intendedDistance = bullet.speed * deltaTime;
    const stepDistance = Math.min(intendedDistance, remainingDistance);
    const startX = bullet.x;
    const startY = bullet.y;
    const endX = startX + bullet.dirX * stepDistance;
    const endY = startY + bullet.dirY * stepDistance;

    bullet.x = endX;
    bullet.y = endY;
    bullet.distanceTravelled += stepDistance;

    let removeBullet = false;

    for (const playerId in state.renderPlayers) {
      if (playerId === bullet.ownerId) {
        continue;
      }

      const playerPosition = state.renderPlayers[playerId];
      if (!playerPosition) {
        continue;
      }

      const collisionT = segmentIntersectsExpandedRect(
        startX,
        startY,
        endX,
        endY,
        playerPosition,
        bullet.radius || 3
      );

      if (collisionT !== null) {
        bullet.x = startX + (endX - startX) * collisionT;
        bullet.y = startY + (endY - startY) * collisionT;
        if (!circleIntersectsRect(bullet, playerPosition)) {
          bullet.x = endX;
          bullet.y = endY;
        }
        removeBullet = true;
        break;
      }
    }

    const outsideWorld =
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > worldSize ||
      bullet.y > worldSize ||
      bullet.distanceTravelled >= bullet.maxDistance ||
      stepDistance <= 0;

    if (removeBullet || outsideWorld) {
      delete state.bullets[id];
    }
  }
}
