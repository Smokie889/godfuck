import {
  AIM_SEND_INTERVAL_MS,
  PLAYER_SIZE,
} from "../config.js";
import { getWeaponDefinition } from "./weapons.js";

function randomSpreadOffset(radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

function isMoving(inputState) {
  return inputState.up || inputState.down || inputState.left || inputState.right;
}

export function updateSpread(state, deltaTime) {
  const spread = state.spread;
  const moving = isMoving(state.inputState);
  const weapon = getWeaponDefinition(state.localPlayer.currentWeaponId);
  const spreadConfig = weapon.spread;

  if (moving) {
    spread.movement = Math.min(
      spreadConfig.maxMovement,
      spread.movement + spreadConfig.movementGrowth * deltaTime
    );
  } else {
    spread.movement = Math.max(
      0,
      spread.movement - spreadConfig.movementRecovery * deltaTime
    );
  }

  spread.shot = Math.max(0, spread.shot - spreadConfig.shotRecovery * deltaTime);
}

export function getSpreadRadius(state) {
  const weapon = getWeaponDefinition(state.localPlayer.currentWeaponId);
  const spreadConfig = weapon.spread;
  return Math.min(
    spreadConfig.maxTotal,
    spreadConfig.baseRadius + state.spread.movement + state.spread.shot
  );
}

export function resetSpread(state) {
  state.spread.movement = 0;
  state.spread.shot = 0;
  state.spread.lastShotTime = 0;
}

export function buildShootIntent(state, canvas) {
  const now = performance.now();
  const weapon = getWeaponDefinition(state.localPlayer.currentWeaponId);
  const spreadConfig = weapon.spread;

  if (now - state.spread.lastShotTime < weapon.fireIntervalMs) {
    return null;
  }

  const centerX = state.localPlayer.x + PLAYER_SIZE / 2;
  const centerY = state.localPlayer.y + PLAYER_SIZE / 2;
  const spreadRadius = getSpreadRadius(state);
  const offset = randomSpreadOffset(spreadRadius);
  const aimX = state.mouse.x + offset.x;
  const aimY = state.mouse.y + offset.y;
  const dx = aimX - centerX;
  const dy = aimY - centerY;

  if (dx === 0 && dy === 0) {
    return null;
  }

  state.spread.lastShotTime = now;
  state.spread.shot = Math.min(spreadConfig.maxTotal, state.spread.shot + spreadConfig.shotBloom);

  return {
    aimX,
    aimY,
  };
}

export function updateLocalFacingFromMouse(state) {
  const centerX = state.localPlayer.x + PLAYER_SIZE / 2;
  const centerY = state.localPlayer.y + PLAYER_SIZE / 2;
  const dx = state.mouse.x - centerX;
  const dy = state.mouse.y - centerY;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return null;
  }

  const aimX = dx / length;
  const aimY = dy / length;

  state.localPlayer.aimFacing.x = aimX;
  state.localPlayer.aimFacing.y = aimY;

  return { x: aimX, y: aimY };
}

export function shouldSendAim(state, aimDirection) {
  if (!aimDirection) {
    return false;
  }

  const now = performance.now();
  const dx = aimDirection.x - state.aimSync.lastX;
  const dy = aimDirection.y - state.aimSync.lastY;
  const directionChanged = Math.abs(dx) > 0.025 || Math.abs(dy) > 0.025;
  const intervalElapsed = now - state.aimSync.lastSentAt >= AIM_SEND_INTERVAL_MS;

  return directionChanged && intervalElapsed;
}

export function markAimSent(state, aimDirection) {
  state.aimSync.lastSentAt = performance.now();
  state.aimSync.lastX = aimDirection.x;
  state.aimSync.lastY = aimDirection.y;
}
