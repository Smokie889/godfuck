const {
  WORLD_SIZE,
  PLAYER_SIZE,
  PLAYER_SPEED,
  DASH_STAMINA_COST,
  DASH_MIN_STAMINA_REQUIRED,
  STAMINA_RECOVERY_PER_SECOND,
  DASH_SPEED_MULTIPLIER,
  DASH_DURATION_MS,
  DASH_COOLDOWN_MS,
} = require("../config");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

// 把輸入方向轉成這個 tick 實際應該移動多少距離。
function getMovementDirection(inputState) {
  let dx = 0;
  let dy = 0;

  if (inputState.up) dy -= 1;
  if (inputState.down) dy += 1;
  if (inputState.left) dx -= 1;
  if (inputState.right) dx += 1;

  if (dx === 0 && dy === 0) {
    return null;
  }

  return normalize(dx, dy);
}

function getMovementDelta(player, inputState, deltaTime) {
  if (player.dashTimeRemaining > 0) {
    return {
      dx: player.dashFacing.x * PLAYER_SPEED * DASH_SPEED_MULTIPLIER * deltaTime,
      dy: player.dashFacing.y * PLAYER_SPEED * DASH_SPEED_MULTIPLIER * deltaTime,
      dir: {
        x: player.dashFacing.x,
        y: player.dashFacing.y,
      },
    };
  }

  const dir = getMovementDirection(inputState);

  if (!dir) {
    return {
      dx: 0,
      dy: 0,
      dir: null,
    };
  }

  return {
    dx: dir.x * PLAYER_SPEED * deltaTime,
    dy: dir.y * PLAYER_SPEED * deltaTime,
    dir,
  };
}

function tryStartDash(player, inputState = player.inputState) {
  if (player.dashTimeRemaining > 0 || player.dashCooldownRemaining > 0) {
    return false;
  }

  if (player.stamina < DASH_MIN_STAMINA_REQUIRED) {
    return false;
  }

  const dir = getMovementDirection(inputState);
  if (!dir) {
    return false;
  }

  player.stamina = Math.max(0, player.stamina - DASH_STAMINA_COST);
  player.dashTimeRemaining = DASH_DURATION_MS / 1000;
  player.dashCooldownRemaining = DASH_COOLDOWN_MS / 1000;
  player.dashFacing.x = dir.x;
  player.dashFacing.y = dir.y;
  player.moveFacing.x = dir.x;
  player.moveFacing.y = dir.y;
  return true;
}

function tickPlayerDashState(player, deltaTime) {
  player.dashTimeRemaining = Math.max(0, player.dashTimeRemaining - deltaTime);
  player.dashCooldownRemaining = Math.max(0, player.dashCooldownRemaining - deltaTime);

  if (player.dashTimeRemaining > 0) {
    return;
  }

  player.stamina = Math.min(
    player.maxStamina,
    player.stamina + STAMINA_RECOVERY_PER_SECOND * deltaTime
  );
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
  const movement = getMovementDelta(player, inputState, deltaTime);

  if (movement.dir) {
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
  tryStartDash,
  tickPlayerDashState,
};
