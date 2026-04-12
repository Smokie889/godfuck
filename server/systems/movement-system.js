const { WORLD_SIZE, PLAYER_SIZE, PLAYER_SPEED } = require("../config");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: dx / length,
    y: dy / length,
  };
}

// 把輸入方向轉成這個 tick 實際應該移動多少距離。
function getMovementDelta(inputState, deltaTime) {
  let dx = 0;
  let dy = 0;

  if (inputState.up) dy -= 1;
  if (inputState.down) dy += 1;
  if (inputState.left) dx -= 1;
  if (inputState.right) dx += 1;

  if (dx === 0 && dy === 0) {
    return {
      dx: 0,
      dy: 0,
      dir: { x: 0, y: 0 },
    };
  }

  const dir = normalize(dx, dy);

  return {
    dx: dir.x * PLAYER_SPEED * deltaTime,
    dy: dir.y * PLAYER_SPEED * deltaTime,
    dir,
  };
}

// 確保角色不會走出世界邊界。
function clampPlayerPosition(position) {
  return {
    x: clamp(position.x, 0, WORLD_SIZE - PLAYER_SIZE),
    y: clamp(position.y, 0, WORLD_SIZE - PLAYER_SIZE),
  };
}

// 先計算玩家「想走到哪裡」。
// 真正能不能站進去，會由 player-collision-system 決定。
function buildDesiredPlayerPosition(player, inputState, deltaTime) {
  const movement = getMovementDelta(inputState, deltaTime);

  if (movement.dir.x !== 0 || movement.dir.y !== 0) {
    player.moveFacing.x = movement.dir.x;
    player.moveFacing.y = movement.dir.y;
  }

  return clampPlayerPosition({
    x: player.x + movement.dx,
    y: player.y + movement.dy,
  });
}

function applyInputToPlayer(player, inputState, deltaTime) {
  const desiredPosition = buildDesiredPlayerPosition(player, inputState, deltaTime);

  player.x = desiredPosition.x;
  player.y = desiredPosition.y;
}

// 保留這個入口，方便未來單獨測試純移動數學。
function updateMovement(players, deltaTime) {
  for (const id in players) {
    const player = players[id];
    applyInputToPlayer(player, player.inputState, deltaTime);
  }
}

module.exports = {
  updateMovement,
  applyInputToPlayer,
  buildDesiredPlayerPosition,
  clampPlayerPosition,
};
