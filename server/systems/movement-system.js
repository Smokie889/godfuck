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

function applyInputToPlayer(player, inputState, deltaTime) {
  let dx = 0;
  let dy = 0;

  if (inputState.up) dy -= 1;
  if (inputState.down) dy += 1;
  if (inputState.left) dx -= 1;
  if (inputState.right) dx += 1;

  if (dx === 0 && dy === 0) {
    return;
  }

  const dir = normalize(dx, dy);

  player.moveFacing.x = dir.x;
  player.moveFacing.y = dir.y;

  player.x += dir.x * PLAYER_SPEED * deltaTime;
  player.y += dir.y * PLAYER_SPEED * deltaTime;

  player.x = clamp(player.x, 0, WORLD_SIZE - PLAYER_SIZE);
  player.y = clamp(player.y, 0, WORLD_SIZE - PLAYER_SIZE);
}

function updateMovement(players, deltaTime) {
  for (const id in players) {
    const player = players[id];
    applyInputToPlayer(player, player.inputState, deltaTime);
  }
}

module.exports = {
  updateMovement,
  applyInputToPlayer,
};
