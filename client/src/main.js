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
import { buildDebugSnapshot } from "./debug/debugUi.js";
import { createDebugBridge } from "./debug/debugBridge.js";
import { simulateInputTick, updateRenderPlayers } from "./game/movement.js";
import { createHudUi } from "./hud/hudUi.js";
import { createInputController } from "./input/inputController.js";
import { createSocketClient } from "./network/socket.js";
import { createRenderer } from "./render/renderer.js";
import { createGameState } from "./state/gameState.js";

// 主遊戲頁只保留實際遊玩所需的 DOM。
// debug 畫面已經抽到獨立的 debug.html。
const canvas = document.getElementById("game");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const joinOverlay = document.getElementById("joinOverlay");
const joinForm = document.getElementById("joinForm");
const joinNameInput = document.getElementById("joinNameInput");
const hudHealthRing = document.getElementById("hudHealthRing");
const hudHealth = document.getElementById("hudHealth");
const hudHealthMeta = document.getElementById("hudHealthMeta");
const hudStaminaRing = document.getElementById("hudStaminaRing");
const hudStamina = document.getElementById("hudStamina");
const hudStaminaMeta = document.getElementById("hudStaminaMeta");
const hudPing = document.getElementById("hudPing");

canvas.width = WORLD_SIZE;
canvas.height = WORLD_SIZE;

const bounds = {
  width: canvas.width,
  height: canvas.height,
};

// accumulator 固定步進遊戲邏輯，避免 frame rate 波動直接改變模擬結果。
let accumulator = 0;
let lastTime = performance.now();
let gameStarted = false;
let state = null;
let socketClient = null;
let renderer = null;
let hudUi = null;
let debugBridge = null;

function cloneInputState(inputState) {
  return {
    up: inputState.up,
    down: inputState.down,
    left: inputState.left,
    right: inputState.right,
  };
}

// 用簡單字串表示目前 WASD 狀態，方便判斷輸入是否真的有變。
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

  // 滑鼠瞄準是節流傳送，不需要每一幀無條件送出。
  if (state.mouse.insideCanvas && !state.isChatting) {
    const aimDirection = updateLocalFacingFromMouse(state);
    if (shouldSendAim(state, aimDirection)) {
      socketClient.sendAim(aimDirection.x, aimDirection.y);
      markAimSent(state, aimDirection);
    }
  }

  // 射擊意圖與移動輸入分開處理，避免互相耦合。
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

    // client 端先做本地預測，讓移動不必完全等 server 回來才看到。
    simulateInputTick(state, inputSnapshot, TICK_DELTA * LOCAL_PREDICTION_SCALE, bounds);
    updateSpread(state, TICK_DELTA);
    updateLocalBullets(state, TICK_DELTA, bounds.width);
    accumulator -= TICK_MS;
  }

  updateRenderPlayers(state);
  renderer.draw();
  hudUi.render();
  // 主畫面不再顯示 debug，但仍把快照廣播給獨立 debug 頁。
  debugBridge.publish(buildDebugSnapshot(state));
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

  // 每次開始新的一局，都重新建立整份前端遊戲 state。
  state = createGameState();
  state.requestedPlayerId = requestedPlayerId;

  const chatController = createChatController(state, chatBox, chatInput);
  socketClient = createSocketClient(state, bounds, chatController, requestedPlayerId);
  renderer = createRenderer(canvas, state, socketClient);
  hudUi = createHudUi(state, {
    hudHealthRing,
    hudHealth,
    hudHealthMeta,
    hudStaminaRing,
    hudStamina,
    hudStaminaMeta,
    hudPing,
  });
  debugBridge = createDebugBridge();

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
    sendDash: socketClient.sendDash,
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
