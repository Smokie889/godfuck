import { API_URL, LOCAL_PREDICTION_SCALE, TICK_DELTA, TICK_MS, WORLD_SIZE, WS_URL } from "./config.js";
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

const canvas = document.getElementById("game");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const joinOverlay = document.getElementById("joinOverlay");
const joinForm = document.getElementById("joinForm");
const joinNameInput = document.getElementById("joinNameInput");
const joinPasswordInput = document.getElementById("joinPasswordInput");
const loginModeButton = document.getElementById("loginModeButton");
const registerModeButton = document.getElementById("registerModeButton");
const authFeedback = document.getElementById("authFeedback");
const joinSubmitButton = document.getElementById("joinSubmitButton");
const lobbyOverlay = document.getElementById("lobbyOverlay");
const roomLobbyOverlay = document.getElementById("roomLobbyOverlay");
const lobbyAvatar = document.getElementById("lobbyAvatar");
const lobbyDisplayName = document.getElementById("lobbyDisplayName");
const lobbyUserId = document.getElementById("lobbyUserId");
const openProfileButton = document.getElementById("openProfileButton");
const createRoomButton = document.getElementById("createRoomButton");
const profileModal = document.getElementById("profileModal");
const closeProfileButton = document.getElementById("closeProfileButton");
const createRoomModal = document.getElementById("createRoomModal");
const closeCreateRoomButton = document.getElementById("closeCreateRoomButton");
const createRoomNameInput = document.getElementById("createRoomNameInput");
const createRoomFeedback = document.getElementById("createRoomFeedback");
const confirmCreateRoomButton = document.getElementById("confirmCreateRoomButton");
const profileUserIdInput = document.getElementById("profileUserIdInput");
const displayNameInput = document.getElementById("displayNameInput");
const saveDisplayNameButton = document.getElementById("saveDisplayNameButton");
const profileFeedback = document.getElementById("profileFeedback");
const roomList = document.getElementById("roomList");
const announcementList = document.getElementById("announcementList");
const roomLobbyName = document.getElementById("roomLobbyName");
const roomLobbyMemberList = document.getElementById("roomLobbyMemberList");
const leaveRoomLobbyButton = document.getElementById("leaveRoomLobbyButton");
const readyRoomButton = document.getElementById("readyRoomButton");
const cancelReadyButton = document.getElementById("cancelReadyButton");
const startRoomGameButton = document.getElementById("startRoomGameButton");
const gameStartOverlay = document.getElementById("gameStartOverlay");
const gameStartCountdown = document.getElementById("gameStartCountdown");
const gameStartMemberList = document.getElementById("gameStartMemberList");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverMessage = document.getElementById("gameOverMessage");
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

let accumulator = 0;
let lastTime = performance.now();
let gameStarted = false;
let state = null;
let socketClient = null;
let renderer = null;
let hudUi = null;
let debugBridge = null;
let inputControllerHandle = null;
let authMode = "login";
let currentUser = null;
let activeRoomLobby = null;
let isCurrentUserReady = false;
let roomLobbySocket = null;
let roomLobbySocketClosing = false;
let pendingRoomLobbyAckTimer = null;
let sentRoomLobbyAckNonce = null;
let roomStartCountdownTimer = null;
let roomStartCommitted = false;
let lobbyStream = null;
let didShowMatchOver = false;
let matchReturnTimer = null;

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

  if (state.match.isOver) {
    if (!didShowMatchOver) {
      didShowMatchOver = true;
      gameOverOverlay.classList.remove("hidden");
      gameOverMessage.textContent = state.match.winnerDisplayName
        ? `Winner: ${state.match.winnerDisplayName}`
        : "Match finished.";
      matchReturnTimer = window.setTimeout(() => {
        returnToRoomLobbyFromMatch().catch(() => {});
      }, 2500);
    }
    renderer.draw();
    hudUi.render();
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
  hudUi.render();
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

function setAuthMode(mode) {
  authMode = mode;
  loginModeButton.classList.toggle("active", mode === "login");
  registerModeButton.classList.toggle("active", mode === "register");
  joinSubmitButton.textContent = mode === "login" ? "Log In" : "Register";
  authFeedback.textContent = "";
  authFeedback.classList.remove("success");
}

function setAuthFeedback(message, isSuccess = false) {
  authFeedback.textContent = message;
  authFeedback.classList.toggle("success", isSuccess);
}

function setProfileFeedback(message, isSuccess = false) {
  profileFeedback.textContent = message;
  profileFeedback.classList.toggle("success", isSuccess);
}

function setCreateRoomFeedback(message, isSuccess = false) {
  createRoomFeedback.textContent = message;
  createRoomFeedback.classList.toggle("success", isSuccess);
}

function closeLobbyStream() {
  if (lobbyStream) {
    lobbyStream.close();
    lobbyStream = null;
  }
}

function closeRoomLobbySocket() {
  if (pendingRoomLobbyAckTimer) {
    window.clearTimeout(pendingRoomLobbyAckTimer);
    pendingRoomLobbyAckTimer = null;
  }

  if (roomLobbySocket) {
    roomLobbySocketClosing = true;
    roomLobbySocket.close(1000, "ROOM_LOBBY_END");
    roomLobbySocket = null;
  }
}

function mapAuthError(errorCode) {
  switch (errorCode) {
    case "USER_EXISTS":
      return "This user_id already exists.";
    case "INVALID_CREDENTIALS":
      return "Wrong user_id or password.";
    case "INVALID_USER_ID":
      return "user_id must be 3-16 chars using letters, numbers, _ or -.";
    case "INVALID_PASSWORD":
      return "Password must be 6-72 characters.";
    case "INVALID_DISPLAY_NAME":
      return "display_name must be 2-20 chars using letters, numbers, _ or -.";
    case "USER_NOT_FOUND":
      return "User profile was not found.";
    case "MISSING_CREDENTIALS":
      return "Please enter user_id and password.";
    case "ROOM_FULL":
      return "This room is already full.";
    case "ROOM_NOT_READY":
      return "Everyone must be ready before the host can start.";
    case "ROOM_HOST_ONLY":
      return "Only the host can start the game.";
    case "ROOM_NOT_JOINABLE":
      return "This room is no longer joinable.";
    case "ROOM_NOT_FOUND":
      return "This room no longer exists.";
    default:
      return "Request failed. Please try again.";
  }
}

async function submitAuth(userId, password) {
  const endpoint = authMode === "login" ? "/api/login" : "/api/register";
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      password,
    }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload.user;
}

async function fetchLobbyData(userId) {
  const response = await fetch(`${API_URL}/api/lobby?userId=${encodeURIComponent(userId)}`);
  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload;
}

function openLobbyStream() {
  if (!currentUser || lobbyStream) {
    return;
  }

  lobbyStream = new EventSource(
    `${API_URL}/api/lobby/stream?userId=${encodeURIComponent(currentUser.userId)}`
  );

  lobbyStream.addEventListener("roomList", (event) => {
    const payload = JSON.parse(event.data);
    renderRoomList(payload.rooms || []);
  });

  lobbyStream.onerror = () => {
    closeLobbyStream();
    window.setTimeout(() => {
      if (!activeRoomLobby && !gameStarted) {
        openLobbyStream();
      }
    }, 1500);
  };
}

async function saveDisplayName(userId, displayName) {
  const response = await fetch(`${API_URL}/api/profile/display-name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      displayName,
    }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload.profile;
}

async function createRoom(roomName) {
  const response = await fetch(`${API_URL}/api/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roomName,
      userId: currentUser?.userId,
    }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload.room;
}

async function fetchRoomLobby(roomId, userId) {
  const response = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}?userId=${encodeURIComponent(userId)}`);
  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload.room;
}

async function joinRoomLobby(roomId, userId) {
  const response = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload.room;
}

async function leaveRoomLobbyOnServer(roomId, userId) {
  const response = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/leave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload;
}

async function setRoomReady(roomId, userId, ready) {
  const response = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/ready`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      isReady: ready,
    }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "REQUEST_FAILED");
  }

  return payload.room;
}

async function startRoomMatch(roomId, userId) {
  const response = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error || "REQUEST_FAILED");
    error.details = payload.details || null;
    throw error;
  }

  return payload.room;
}

function queueRoomLobbyAck(room) {
  if (!roomLobbySocket || roomLobbySocket.readyState !== WebSocket.OPEN || !currentUser) {
    return;
  }

  const selfMember = room.members.find((member) => member.userId === currentUser.userId);

  if (!selfMember || selfMember.syncStatus !== "pending") {
    return;
  }

  if (sentRoomLobbyAckNonce === room.syncNonce) {
    return;
  }

  if (pendingRoomLobbyAckTimer) {
    window.clearTimeout(pendingRoomLobbyAckTimer);
  }

  pendingRoomLobbyAckTimer = window.setTimeout(() => {
    if (!roomLobbySocket || roomLobbySocket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!activeRoomLobby || activeRoomLobby.syncNonce !== room.syncNonce || activeRoomLobby.status !== "syncing") {
      return;
    }

    sentRoomLobbyAckNonce = room.syncNonce;
    roomLobbySocket.send(
      JSON.stringify({
        type: "roomLobbyAck",
        syncNonce: room.syncNonce,
      })
    );
    pendingRoomLobbyAckTimer = null;
  }, 180);
}

function openRoomLobbySocket(roomId) {
  if (!currentUser || roomLobbySocket) {
    return;
  }

  const url = new URL(WS_URL);
  url.searchParams.set("mode", "roomLobby");
  url.searchParams.set("roomId", roomId);
  url.searchParams.set("userId", currentUser.userId);

  roomLobbySocket = new WebSocket(url.toString());
  roomLobbySocketClosing = false;

  roomLobbySocket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "roomLobbySync") {
      activeRoomLobby = data.room;
      const selfMember = data.room.members.find((member) => member.userId === currentUser.userId);
      isCurrentUserReady = !!selfMember?.isReady;
      queueRoomLobbyAck(data.room);
      renderRoomLobby();
      syncRoomStartTransition();
      return;
    }

    if (data.type === "roomClosed") {
      closeRoomLobbySocket();
      hideGameStartOverlay();
      activeRoomLobby = null;
      roomLobbyOverlay.classList.add("hidden");
      lobbyOverlay.classList.remove("hidden");
      refreshLobby().catch(() => {});
      openLobbyStream();
      window.alert("Room was closed because the host left.");
    }
  };

  roomLobbySocket.onclose = () => {
    roomLobbySocket = null;

    if (!roomLobbySocketClosing && activeRoomLobby && !gameStarted && !roomStartCommitted) {
      window.setTimeout(() => {
        if (activeRoomLobby && !roomLobbySocket && !gameStarted) {
          openRoomLobbySocket(activeRoomLobby.id);
        }
      }, 1000);
    }

    roomLobbySocketClosing = false;
  };
}

function renderAnnouncements(announcements) {
  announcementList.innerHTML = "";

  for (const announcement of announcements) {
    const item = document.createElement("div");
    item.className = "announcement-card";
    item.textContent = announcement;
    announcementList.appendChild(item);
  }
}

function openProfileModal() {
  if (!currentUser) {
    return;
  }

  setProfileFeedback("");
  profileModal.classList.remove("hidden");
}

function closeProfileModal() {
  profileModal.classList.add("hidden");
}

function openCreateRoomModal() {
  setCreateRoomFeedback("");
  createRoomNameInput.value = "";
  createRoomModal.classList.remove("hidden");
  createRoomNameInput.focus();
}

function closeCreateRoomModal() {
  createRoomModal.classList.add("hidden");
}

function renderRoomLobbyMembers() {
  roomLobbyMemberList.innerHTML = "";

  const members = activeRoomLobby?.members || [];

  for (const member of members) {
    const row = document.createElement("div");
    row.className = "room-lobby-member-row";

    const name = document.createElement("div");
    name.className = "room-lobby-member-name";
    name.textContent = `${member.displayName} (@${member.userId})${member.isHost ? " [HOST]" : ""}`;

    const status = document.createElement("div");
    status.className = `room-lobby-member-status ${member.isReady ? "ready" : "waiting"}`;
    status.textContent = member.isReady ? "READY" : "WAITING";

    const squad = document.createElement("div");
    squad.className = "room-lobby-member-squad";
    squad.textContent = member.squadId || "UNASSIGNED";

    row.appendChild(name);
    row.appendChild(status);
    row.appendChild(squad);
    roomLobbyMemberList.appendChild(row);
  }
}

function syncRoomLobbyActions() {
  const status = activeRoomLobby?.status;
  const isWaiting = status === "waiting";
  const isHost = !!activeRoomLobby?.isCurrentUserHost;

  readyRoomButton.disabled = !isWaiting || isCurrentUserReady;
  cancelReadyButton.disabled = !isWaiting || !isCurrentUserReady;
  startRoomGameButton.disabled = !isWaiting || !isHost;
}

function renderRoomLobby() {
  if (!activeRoomLobby) {
    return;
  }

  roomLobbyName.textContent = activeRoomLobby.label;
  renderRoomLobbyMembers();
  syncRoomLobbyActions();
}

function renderGameStartMembers() {
  gameStartMemberList.innerHTML = "";

  for (const member of activeRoomLobby?.members || []) {
    const row = document.createElement("div");
    row.className = "game-start-member-row";

    const name = document.createElement("div");
    name.textContent = member.displayName;

    const sync = document.createElement("div");
    sync.className = "game-start-member-sync";
    sync.textContent = member.syncStatus === "synced" ? "SYNCED" : "SYNCING";

    row.appendChild(name);
    row.appendChild(sync);
    gameStartMemberList.appendChild(row);
  }
}

function hideGameStartOverlay() {
  if (pendingRoomLobbyAckTimer) {
    window.clearTimeout(pendingRoomLobbyAckTimer);
    pendingRoomLobbyAckTimer = null;
  }

  if (roomStartCountdownTimer) {
    window.clearInterval(roomStartCountdownTimer);
    roomStartCountdownTimer = null;
  }

  roomStartCommitted = false;
  gameStartOverlay.classList.add("hidden");
}

function hideGameOverOverlay() {
  if (matchReturnTimer) {
    window.clearTimeout(matchReturnTimer);
    matchReturnTimer = null;
  }
  didShowMatchOver = false;
  gameOverOverlay.classList.add("hidden");
}

async function returnToRoomLobbyFromMatch() {
  if (!gameStarted) {
    return;
  }

  hideGameOverOverlay();

  if (inputControllerHandle) {
    inputControllerHandle.destroy();
    inputControllerHandle = null;
  }

  if (socketClient) {
    socketClient.destroy();
    socketClient = null;
  }

  gameStarted = false;
  state = null;
  renderer = null;
  hudUi = null;
  debugBridge = null;

  if (activeRoomLobby && currentUser) {
    roomLobbyOverlay.classList.remove("hidden");
    try {
      await refreshActiveRoomLobby();
    } catch {
      await refreshLobby();
    }
    openRoomLobbySocket(activeRoomLobby.id);
    return;
  }

  await refreshLobby();
  lobbyOverlay.classList.remove("hidden");
  openLobbyStream();
}

function commitRoomGameStart() {
  if (!activeRoomLobby || !currentUser || roomStartCommitted) {
    return;
  }

  roomStartCommitted = true;
  roomLobbyOverlay.classList.add("hidden");
  gameStartOverlay.classList.add("hidden");
  closeRoomLobbySocket();
  closeLobbyStream();
  startGame(currentUser.userId, activeRoomLobby.id);
}

function syncRoomStartTransition() {
  if (!activeRoomLobby) {
    hideGameStartOverlay();
    return;
  }

  if (activeRoomLobby.status === "in-game") {
    commitRoomGameStart();
    return;
  }

  if (activeRoomLobby.status === "syncing") {
    gameStartOverlay.classList.remove("hidden");
    gameStartCountdown.textContent = "SYNC";
    renderGameStartMembers();
    return;
  }

  if (!activeRoomLobby.gameStartAt || activeRoomLobby.status !== "starting") {
    hideGameStartOverlay();
    return;
  }

  gameStartOverlay.classList.remove("hidden");
  renderGameStartMembers();

  const renderCountdown = () => {
    const remainingMs = Math.max(activeRoomLobby.gameStartAt - Date.now(), 0);
    const seconds = Math.max(Math.ceil(remainingMs / 1000), 0);
    gameStartCountdown.textContent = String(seconds);

    if (remainingMs <= 0) {
      commitRoomGameStart();
    }
  };

  renderCountdown();

  if (!roomStartCountdownTimer) {
    roomStartCountdownTimer = window.setInterval(renderCountdown, 100);
  }
}

async function refreshActiveRoomLobby() {
  if (!activeRoomLobby || !currentUser) {
    return;
  }

  try {
    const room = await fetchRoomLobby(activeRoomLobby.id, currentUser.userId);
    activeRoomLobby = room;
    const selfMember = room.members.find((member) => member.userId === currentUser.userId);
    isCurrentUserReady = !!selfMember?.isReady;
    queueRoomLobbyAck(room);
    renderRoomLobby();
    syncRoomStartTransition();
  } catch (error) {
    if (error.message === "ROOM_NOT_FOUND") {
      hideGameStartOverlay();
      closeRoomLobbySocket();
      activeRoomLobby = null;
      roomLobbyOverlay.classList.add("hidden");
      lobbyOverlay.classList.remove("hidden");
      await refreshLobby();
      window.alert("Room was closed because the host left.");
      return;
    }

    throw error;
  }
}

async function openRoomLobby(room) {
  if (!currentUser) {
    return;
  }

  const joinedRoom = await joinRoomLobby(room.id, currentUser.userId);
  activeRoomLobby = joinedRoom;
  const selfMember = joinedRoom.members.find((member) => member.userId === currentUser.userId);
  isCurrentUserReady = !!selfMember?.isReady;
  sentRoomLobbyAckNonce = null;
  closeProfileModal();
  closeCreateRoomModal();
  closeLobbyStream();
  lobbyOverlay.classList.add("hidden");
  roomLobbyOverlay.classList.remove("hidden");
  renderRoomLobby();
  syncRoomStartTransition();
  openRoomLobbySocket(joinedRoom.id);
}

async function closeRoomLobby() {
  if (activeRoomLobby && currentUser && !gameStarted) {
    await leaveRoomLobbyOnServer(activeRoomLobby.id, currentUser.userId);
  }

  closeRoomLobbySocket();
  hideGameStartOverlay();
  activeRoomLobby = null;
  isCurrentUserReady = false;
  sentRoomLobbyAckNonce = null;
  roomLobbyOverlay.classList.add("hidden");
  lobbyOverlay.classList.remove("hidden");
  await refreshLobby();
  openLobbyStream();
}

function renderRoomList(rooms) {
  roomList.innerHTML = "";

  if (!rooms.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "announcement-card";
    emptyState.textContent =
      "\u76ee\u524d\u9084\u6c92\u6709\u623f\u9593\uff0c\u6309\u53f3\u4e0a\u89d2\u7684\u5275\u5efa\u623f\u9593\u4f86\u958b\u7b2c\u4e00\u5834\u3002";
    roomList.appendChild(emptyState);
    return;
  }

  for (const room of rooms) {
    const card = document.createElement("div");
    card.className = "room-card";

    const meta = document.createElement("div");
    meta.className = "room-card-meta";

    const title = document.createElement("div");
    title.className = "room-card-title";
    title.textContent = room.label;

    const subtitle = document.createElement("div");
    subtitle.className = "room-card-subtitle";
    subtitle.textContent = `${room.mapId} / ${room.playerCount} players / ${room.status}`;

    const button = document.createElement("button");
    button.className = "lobby-button";
    button.type = "button";
    button.textContent = "Enter Room";
    button.addEventListener("click", async () => {
      try {
        await openRoomLobby(room);
      } catch (error) {
        window.alert(mapAuthError(error.message));
      }
    });

    meta.appendChild(title);
    meta.appendChild(subtitle);
    card.appendChild(meta);
    card.appendChild(button);
    roomList.appendChild(card);
  }
}

function renderLobbyProfile(profile) {
  currentUser = {
    userId: profile.userId,
    displayName: profile.displayName,
  };

  lobbyDisplayName.textContent = profile.displayName;
  lobbyUserId.textContent = `@${profile.userId}`;
  lobbyAvatar.textContent = profile.displayName.slice(0, 1).toUpperCase();
  profileUserIdInput.value = profile.userId;
  displayNameInput.value = profile.displayName;
}

async function refreshLobby() {
  if (!currentUser) {
    return;
  }

  const lobbyData = await fetchLobbyData(currentUser.userId);
  renderLobbyProfile(lobbyData.profile);
  renderRoomList(lobbyData.rooms);
  renderAnnouncements(lobbyData.announcements);
}

async function openLobby(user) {
  currentUser = {
    userId: user.userId,
    displayName: user.displayName,
  };
  await refreshLobby();
  setProfileFeedback("");
  setCreateRoomFeedback("");
  closeProfileModal();
  closeCreateRoomModal();
  hideGameStartOverlay();
  hideGameOverOverlay();
  closeRoomLobbySocket();
  roomLobbyOverlay.classList.add("hidden");
  sentRoomLobbyAckNonce = null;
  joinOverlay.classList.add("hidden");
  lobbyOverlay.classList.remove("hidden");
  openLobbyStream();
}

function startGame(requestedPlayerId, roomId) {
  if (gameStarted) {
    return;
  }

  state = createGameState();
  state.requestedPlayerId = requestedPlayerId;
  hideGameOverOverlay();
  didShowMatchOver = false;

  const chatController = createChatController(state, chatBox, chatInput);
  socketClient = createSocketClient(
    state,
    bounds,
    chatController,
    requestedPlayerId,
    roomId,
    currentUser?.userId,
    currentUser?.displayName
  );
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

  inputControllerHandle = createInputController(state, chatInput, {
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
    pickupWeapon: socketClient.sendPickupWeapon,
    dropWeapon: socketClient.sendDropWeapon,
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

loginModeButton.addEventListener("click", () => {
  setAuthMode("login");
});

registerModeButton.addEventListener("click", () => {
  setAuthMode("register");
});

openProfileButton.addEventListener("click", () => {
  openProfileModal();
});

closeProfileButton.addEventListener("click", () => {
  closeProfileModal();
});

profileModal.addEventListener("click", (event) => {
  if (event.target === profileModal) {
    closeProfileModal();
  }
});

createRoomButton.addEventListener("click", async () => {
  openCreateRoomModal();
});

closeCreateRoomButton.addEventListener("click", () => {
  closeCreateRoomModal();
});

createRoomModal.addEventListener("click", (event) => {
  if (event.target === createRoomModal) {
    closeCreateRoomModal();
  }
});

createRoomNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmCreateRoomButton.click();
  }
});

confirmCreateRoomButton.addEventListener("click", async () => {
  const normalizedRoomName = createRoomNameInput.value.trim();

  if (!normalizedRoomName) {
    setCreateRoomFeedback(
      "\u8acb\u5148\u8f38\u5165\u623f\u9593\u540d\u7a31\u3002"
    );
    return;
  }

  confirmCreateRoomButton.disabled = true;
  setCreateRoomFeedback("\u5efa\u7acb\u4e2d...");

  try {
    const room = await createRoom(normalizedRoomName);
    await refreshLobby();
    setCreateRoomFeedback(
      "\u623f\u9593\u5df2\u5efa\u7acb\uff0c\u5df2\u9032\u5165\u623f\u9593\u5927\u5ef3\u3002",
      true
    );
    await openRoomLobby(room);
  } catch (error) {
    setCreateRoomFeedback(mapAuthError(error.message));
  } finally {
    confirmCreateRoomButton.disabled = false;
  }
});

leaveRoomLobbyButton.addEventListener("click", async () => {
  try {
    await closeRoomLobby();
  } catch (error) {
    window.alert(mapAuthError(error.message));
  }
});

readyRoomButton.addEventListener("click", async () => {
  if (!activeRoomLobby || !currentUser) {
    return;
  }

  try {
    activeRoomLobby = await setRoomReady(activeRoomLobby.id, currentUser.userId, true);
    isCurrentUserReady = true;
    renderRoomLobby();
  } catch (error) {
    window.alert(mapAuthError(error.message));
  }
});

cancelReadyButton.addEventListener("click", async () => {
  if (!activeRoomLobby || !currentUser) {
    return;
  }

  try {
    activeRoomLobby = await setRoomReady(activeRoomLobby.id, currentUser.userId, false);
    isCurrentUserReady = false;
    renderRoomLobby();
  } catch (error) {
    window.alert(mapAuthError(error.message));
  }
});

startRoomGameButton.addEventListener("click", async () => {
  if (!activeRoomLobby || !currentUser) {
    return;
  }

  try {
    activeRoomLobby = await startRoomMatch(activeRoomLobby.id, currentUser.userId);
    renderRoomLobby();
    syncRoomStartTransition();
  } catch (error) {
    if (error.message === "ROOM_NOT_READY" && error.details?.pendingMembers?.length) {
      const pendingNames = error.details.pendingMembers
        .map((member) => member.displayName || member.userId)
        .join(", ");
      window.alert(`Still waiting for: ${pendingNames}`);
      return;
    }

    window.alert(mapAuthError(error.message));
  }
});

saveDisplayNameButton.addEventListener("click", async () => {
  if (!currentUser) {
    return;
  }

  saveDisplayNameButton.disabled = true;
  setProfileFeedback("Saving...");

  try {
    const profile = await saveDisplayName(currentUser.userId, displayNameInput.value.trim());
    renderLobbyProfile(profile);
    setProfileFeedback("Display name updated.", true);
  } catch (error) {
    setProfileFeedback(mapAuthError(error.message));
  } finally {
    saveDisplayNameButton.disabled = false;
  }
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const requestedPlayerId = sanitizePlayerIdInput(joinNameInput.value.trim());
  const password = joinPasswordInput.value;

  if (!requestedPlayerId || !password) {
    setAuthFeedback("Please enter user_id and password.");
    return;
  }

  joinSubmitButton.disabled = true;
  setAuthFeedback(authMode === "login" ? "Logging in..." : "Registering...");

  try {
    const user = await submitAuth(requestedPlayerId, password);
    setAuthFeedback(
      authMode === "login"
        ? `Welcome back, ${user.userId}.`
        : `Registered as ${user.userId}. Entering lobby...`,
      true
    );
    await openLobby(user);
  } catch (error) {
    setAuthFeedback(mapAuthError(error.message));
  } finally {
    joinSubmitButton.disabled = false;
  }
});

setAuthMode("login");
requestAnimationFrame(gameLoop);
