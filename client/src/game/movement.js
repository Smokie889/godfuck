import {
  DASH_COOLDOWN_MS,
  DASH_DURATION_MS,
  DASH_MIN_STAMINA_REQUIRED,
  DASH_SPEED_MULTIPLIER,
  DASH_STAMINA_COST,
  LOCAL_RENDER_LERP,
  PLAYER_SIZE,
  PLAYER_SPEED,
  REMOTE_RENDER_LERP,
  STAMINA_RECOVERY_PER_SECOND,
} from "../config.js";
import { clamp, lerp, normalize } from "./math.js";

// client 端的輕量碰撞預測半徑，先和 server 保持同樣大小。
const PLAYER_COLLISION_RADIUS = PLAYER_SIZE * 0.5;

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

function tryStartLocalDash(player, inputState) {
  if (!inputState.dash) {
    return false;
  }

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

function tickLocalDashState(player, deltaTime) {
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

function buildMovementDelta(player, inputState, deltaTime, facingHolder) {
  tryStartLocalDash(player, inputState);

  if (player.dashTimeRemaining > 0) {
    if (facingHolder) {
      facingHolder.x = player.dashFacing.x;
      facingHolder.y = player.dashFacing.y;
    }

    return {
      dx: player.dashFacing.x * PLAYER_SPEED * DASH_SPEED_MULTIPLIER * deltaTime,
      dy: player.dashFacing.y * PLAYER_SPEED * DASH_SPEED_MULTIPLIER * deltaTime,
    };
  }

  const dir = getMovementDirection(inputState);
  if (!dir) {
    return null;
  }

  if (facingHolder) {
    facingHolder.x = dir.x;
    facingHolder.y = dir.y;
  }

  return {
    dx: dir.x * PLAYER_SPEED * deltaTime,
    dy: dir.y * PLAYER_SPEED * deltaTime,
  };
}

function clampPosition(position, bounds) {
  return {
    x: clamp(position.x, 0, bounds.width - PLAYER_SIZE),
    y: clamp(position.y, 0, bounds.height - PLAYER_SIZE),
  };
}

function getPlayerCenter(position) {
  return {
    x: position.x + PLAYER_SIZE / 2,
    y: position.y + PLAYER_SIZE / 2,
  };
}

function positionsOverlap(a, b) {
  const centerA = getPlayerCenter(a);
  const centerB = getPlayerCenter(b);
  const minDistance = PLAYER_COLLISION_RADIUS * 2;
  return Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y) < minDistance;
}

function collidesWithOtherPlayers(state, candidatePosition) {
  for (const playerId in state.players) {
    if (playerId === state.myId) {
      continue;
    }

    const otherPlayer = state.players[playerId];
    if (!otherPlayer) {
      continue;
    }

    if (positionsOverlap(candidatePosition, otherPlayer)) {
      return true;
    }
  }

  return false;
}

export function applyInputToPosition(position, inputState, deltaTime, facingHolder, bounds) {
  const movement = buildMovementDelta(position, inputState, deltaTime, facingHolder);
  if (!movement) {
    tickLocalDashState(position, deltaTime);
    return;
  }

  position.x += movement.dx;
  position.y += movement.dy;

  position.x = clamp(position.x, 0, bounds.width - PLAYER_SIZE);
  position.y = clamp(position.y, 0, bounds.height - PLAYER_SIZE);
  tickLocalDashState(position, deltaTime);
}

// 只對本地玩家做輕量版玩家碰撞預測：
// 先嘗試完整位移，不行就拆成 X / Y 單軸嘗試，盡量貼近 server 規則。
export function applyInputToPositionWithPlayerCollision(
  state,
  position,
  inputState,
  deltaTime,
  facingHolder,
  bounds
) {
  const movement = buildMovementDelta(position, inputState, deltaTime, facingHolder);
  if (!movement) {
    tickLocalDashState(position, deltaTime);
    return;
  }

  const currentPosition = {
    x: position.x,
    y: position.y,
  };

  const desiredPosition = clampPosition(
    {
      x: currentPosition.x + movement.dx,
      y: currentPosition.y + movement.dy,
    },
    bounds
  );

  if (!collidesWithOtherPlayers(state, desiredPosition)) {
    position.x = desiredPosition.x;
    position.y = desiredPosition.y;
    tickLocalDashState(position, deltaTime);
    return;
  }

  const xOnlyPosition = clampPosition(
    {
      x: desiredPosition.x,
      y: currentPosition.y,
    },
    bounds
  );

  if (!collidesWithOtherPlayers(state, xOnlyPosition)) {
    position.x = xOnlyPosition.x;
    position.y = xOnlyPosition.y;
    tickLocalDashState(position, deltaTime);
    return;
  }

  const yOnlyPosition = clampPosition(
    {
      x: currentPosition.x,
      y: desiredPosition.y,
    },
    bounds
  );

  if (!collidesWithOtherPlayers(state, yOnlyPosition)) {
    position.x = yOnlyPosition.x;
    position.y = yOnlyPosition.y;
  }

  tickLocalDashState(position, deltaTime);
}

export function simulateLocalTick(state, deltaTime, bounds) {
  applyInputToPositionWithPlayerCollision(
    state,
    state.localPlayer,
    state.inputState,
    deltaTime,
    state.localPlayer.moveFacing,
    bounds
  );
}

export function simulateInputTick(state, inputState, deltaTime, bounds) {
  applyInputToPositionWithPlayerCollision(
    state,
    state.localPlayer,
    inputState,
    deltaTime,
    state.localPlayer.moveFacing,
    bounds
  );
}

export function updateRenderPlayers(state) {
  for (const id in state.players) {
    if (!state.renderPlayers[id]) {
      state.renderPlayers[id] = {
        x: state.players[id].x,
        y: state.players[id].y,
      };
    }

    if (id === state.myId) {
      state.localRenderPlayer.x = lerp(
        state.localRenderPlayer.x,
        state.localPlayer.x,
        LOCAL_RENDER_LERP
      );
      state.localRenderPlayer.y = lerp(
        state.localRenderPlayer.y,
        state.localPlayer.y,
        LOCAL_RENDER_LERP
      );

      state.renderPlayers[id].x = state.localRenderPlayer.x;
      state.renderPlayers[id].y = state.localRenderPlayer.y;
      continue;
    }

    state.renderPlayers[id].x = lerp(
      state.renderPlayers[id].x,
      state.players[id].x,
      REMOTE_RENDER_LERP
    );
    state.renderPlayers[id].y = lerp(
      state.renderPlayers[id].y,
      state.players[id].y,
      REMOTE_RENDER_LERP
    );
  }
}
