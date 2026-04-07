import { LOCAL_RENDER_LERP, PLAYER_SIZE, PLAYER_SPEED, REMOTE_RENDER_LERP } from "../config.js";
import { clamp, lerp, normalize } from "./math.js";

export function applyInputToPosition(position, inputState, deltaTime, facingHolder, bounds) {
  let dx = 0;
  let dy = 0;

  if (inputState.up) dy -= 1;
  if (inputState.down) dy += 1;
  if (inputState.left) dx -= 1;
  if (inputState.right) dx += 1;

  if (dx === 0 && dy === 0) return;

  const dir = normalize(dx, dy);
  dx = dir.x;
  dy = dir.y;

  if (facingHolder) {
    facingHolder.x = dx;
    facingHolder.y = dy;
  }

  position.x += dx * PLAYER_SPEED * deltaTime;
  position.y += dy * PLAYER_SPEED * deltaTime;

  position.x = clamp(position.x, 0, bounds.width - PLAYER_SIZE);
  position.y = clamp(position.y, 0, bounds.height - PLAYER_SIZE);
}

export function simulateLocalTick(state, deltaTime, bounds) {
  applyInputToPosition(
    state.localPlayer,
    state.inputState,
    deltaTime,
    state.localPlayer.moveFacing,
    bounds
  );
}

export function simulateInputTick(state, inputState, deltaTime, bounds) {
  applyInputToPosition(
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
