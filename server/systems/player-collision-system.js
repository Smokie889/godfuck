const { PLAYER_SIZE } = require("../config");
const {
  buildDesiredPlayerPosition,
  clampPlayerPosition,
} = require("./movement-system");

// 目前碰撞圓先直接使用角色尺寸的一半。
// 後續如果想讓碰撞更寬鬆，可以把這個半徑再縮小一點。
const PLAYER_COLLISION_RADIUS = PLAYER_SIZE * 0.5;
// 每個 tick 輪換一次處理起點，避免永遠由同一位玩家拿到優先權。
let collisionOrderOffset = 0;

function getPlayerCenter(position) {
  return {
    x: position.x + PLAYER_SIZE / 2,
    y: position.y + PLAYER_SIZE / 2,
  };
}

// 玩家碰撞採 circle vs circle，只要兩個中心點距離小於直徑就算重疊。
function positionsOverlap(a, b) {
  const centerA = getPlayerCenter(a);
  const centerB = getPlayerCenter(b);
  const minDistance = PLAYER_COLLISION_RADIUS * 2;
  return Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y) < minDistance;
}

// 檢查某位玩家的候選位置，是否會侵入其他玩家已佔用的空間。
// resolvedPositions 優先代表「本 tick 已經先處理完、已經落位」的玩家。
function collidesWithPlayers(playerId, candidatePosition, players, resolvedPositions) {
  for (const otherId in players) {
    if (otherId === playerId) {
      continue;
    }

    const otherPosition = resolvedPositions[otherId] || {
      x: players[otherId].x,
      y: players[otherId].y,
    };

    if (positionsOverlap(candidatePosition, otherPosition)) {
      return true;
    }
  }

  return false;
}

// 透過輪換順序，實作「先到先卡位」但避免固定玩家永久佔便宜。
function buildCollisionOrder(players) {
  const playerIds = Object.keys(players);

  if (playerIds.length <= 1) {
    return playerIds;
  }

  const startIndex = collisionOrderOffset % playerIds.length;
  collisionOrderOffset = (collisionOrderOffset + 1) % playerIds.length;

  return playerIds
    .slice(startIndex)
    .concat(playerIds.slice(0, startIndex));
}

// 第一版碰撞規則：
// 1. 先嘗試完整位移
// 2. 不行就嘗試只走 X
// 3. 再不行就嘗試只走 Y
// 4. 都不行就留在原地
// 這樣可以保留貼邊滑動感，又不會出現兩人互推的物理效果。
function resolvePlayerCollisions(players, deltaTime) {
  const resolvedPositions = {};
  const playerOrder = buildCollisionOrder(players);

  for (const playerId of playerOrder) {
    const player = players[playerId];
    const currentPosition = { x: player.x, y: player.y };
    const desiredPosition = buildDesiredPlayerPosition(
      player,
      player.inputState,
      deltaTime
    );

    const fullMoveBlocked = collidesWithPlayers(
      playerId,
      desiredPosition,
      players,
      resolvedPositions
    );

    if (!fullMoveBlocked) {
      resolvedPositions[playerId] = desiredPosition;
      player.x = desiredPosition.x;
      player.y = desiredPosition.y;
      continue;
    }

    const xOnlyPosition = clampPlayerPosition({
      x: desiredPosition.x,
      y: currentPosition.y,
    });

    if (
      !collidesWithPlayers(playerId, xOnlyPosition, players, resolvedPositions)
    ) {
      resolvedPositions[playerId] = xOnlyPosition;
      player.x = xOnlyPosition.x;
      player.y = xOnlyPosition.y;
      continue;
    }

    const yOnlyPosition = clampPlayerPosition({
      x: currentPosition.x,
      y: desiredPosition.y,
    });

    if (
      !collidesWithPlayers(playerId, yOnlyPosition, players, resolvedPositions)
    ) {
      resolvedPositions[playerId] = yOnlyPosition;
      player.x = yOnlyPosition.x;
      player.y = yOnlyPosition.y;
      continue;
    }

    resolvedPositions[playerId] = currentPosition;
    player.x = currentPosition.x;
    player.y = currentPosition.y;
  }
}

module.exports = {
  resolvePlayerCollisions,
};
