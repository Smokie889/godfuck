import { LOCAL_PREDICTION_SCALE, TICK_DELTA, TICK_MS, WORLD_SIZE } from "./config.js";
import {
  buildShootIntent,
  markAimSent,
  shouldSendAim,
  updateLocalFacingFromMouse,
  updateSpread,
} from "./game/shooting.js";
import { updateLocalBullets } from "./game/bullets.js";
import { createChatController } from "./chat/chatUi.js";
import { simulateInputTick, updateRenderPlayers } from "./game/movement.js";
import { createInputController } from "./input/inputController.js";
import { createSocketClient } from "./network/socket.js";
import { createRenderer } from "./render/renderer.js";
import { createGameState } from "./state/gameState.js";

const canvas = document.getElementById("game");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const joinOverlay = document.getElementById("joinOverlay");
const joinForm = document.getElementById("joinForm");
const joinNameInput = document.getElementById("joinNameInput");

canvas.width = WORLD_SIZE;
canvas.height = WORLD_SIZE;

const bounds = {
  width: canvas.width,
  height: canvas.height,
};

let accumulator = 0;
let lastTime = performance.now();
let gameStarted = false;
let state = null;
let socketClient = null;
let renderer = null;

function cloneInputState(inputState) {
  return {
    up: inputState.up,
    down: inputState.down,
    left: inputState.left,
    right: inputState.right,
  };
}

function getInputSignature(inputState) {
  return `${+inputState.up},${+inputState.down},${+inputState.left},${+inputState.right}`;
}

function hasMovementInput(inputState) {
  return inputState.up || inputState.down || inputState.left || inputState.right;
}

function gameLoop(now) {
  if (!gameStarted) {
    requestAnimationFrame(gameLoop);
    return;
  }

  let frameTime = now - lastTime;
  if (frameTime > 100) frameTime = 100;
  lastTime = now;

  if (state.mouse.insideCanvas && !state.isChatting) {
    const aimDirection = updateLocalFacingFromMouse(state);
    if (shouldSendAim(state, aimDirection)) {
      socketClient.sendAim(aimDirection.x, aimDirection.y);
      markAimSent(state, aimDirection);
    }
  }

  if (state.mouse.leftDown && !state.isChatting) {
    const intent = buildShootIntent(state, canvas);
    if (intent) {
      socketClient.sendShoot(intent.aimX, intent.aimY);
    }
  }

  accumulator += frameTime;

  while (accumulator >= TICK_MS) {
    const inputSnapshot = cloneInputState(state.inputState);
    const inputSignature = getInputSignature(inputSnapshot);
    const shouldSendInput =
      hasMovementInput(inputSnapshot) ||
      inputSignature !== state.localMeta.lastSentInputSignature;

    if (shouldSendInput) {
      const seq = socketClient.sendCurrentInputState(inputSnapshot);
      if (seq) {
        state.pendingInputs.push({
          seq,
          inputState: inputSnapshot,
        });
        state.localMeta.lastSentInputSignature = inputSignature;
      }
    }

    simulateInputTick(state, inputSnapshot, TICK_DELTA * LOCAL_PREDICTION_SCALE, bounds);
    updateSpread(state, TICK_DELTA);
    updateLocalBullets(state, TICK_DELTA, bounds.width);
    accumulator -= TICK_MS;
  }

  updateRenderPlayers(state);
  renderer.draw();
  requestAnimationFrame(gameLoop);
}

function generateFallbackPlayerId() {
  return `player-${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizePlayerIdInput(value) {
  return value
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 16);
}

function startGame(requestedPlayerId) {
  if (gameStarted) {
    return;
  }

  state = createGameState();
  state.requestedPlayerId = requestedPlayerId;

  const chatController = createChatController(state, chatBox, chatInput);
  socketClient = createSocketClient(state, bounds, chatController, requestedPlayerId);
  renderer = createRenderer(canvas, state, socketClient);

  createInputController(state, chatInput, {
    canvas,
    closeChat: chatController.closeChat,
    openChat: chatController.openChat,
    handleShoot: () => {
      const intent = buildShootIntent(state, canvas);
      if (!intent) {
        return;
      }

      socketClient.sendShoot(intent.aimX, intent.aimY);
    },
    sendChat: socketClient.sendChat,
    sendCurrentInputState: socketClient.sendCurrentInputState,
  });

  joinOverlay.classList.add("hidden");
  gameStarted = true;
  lastTime = performance.now();
}

joinNameInput.value = generateFallbackPlayerId();
joinNameInput.focus();
joinNameInput.addEventListener("input", () => {
  const sanitized = sanitizePlayerIdInput(joinNameInput.value);
  if (joinNameInput.value !== sanitized) {
    joinNameInput.value = sanitized;
  }
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const requestedPlayerId =
    sanitizePlayerIdInput(joinNameInput.value.trim()) || generateFallbackPlayerId();
  startGame(requestedPlayerId);
});

requestAnimationFrame(gameLoop);
