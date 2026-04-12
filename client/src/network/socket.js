import { LOCAL_PREDICTION_SCALE, TICK_DELTA, WS_URL } from "../config.js";
import { logOutgoing, logRuntime } from "../debug/debugUi.js";
import { copyBulletState } from "../game/bullets.js";
import { applyInputToPositionWithPlayerCollision } from "../game/movement.js";
import {
  copyPlayerState,
  mergeCombatState,
  mergeMovementState,
} from "../game/player.js";
import { resetSpread } from "../game/shooting.js";

// 建立 WebSocket client，統一管理：
// 1. 對 server 發送輸入/射擊/聊天
// 2. 接收各種 patch/event
// 3. 把同步結果寫回前端 state
export function createSocketClient(state, bounds, chatController, playerId) {
  const connectUrl = new URL(WS_URL);
  connectUrl.searchParams.set("playerId", playerId);

  const ws = new WebSocket(connectUrl.toString());
  state.network.wsReadyState = ws.readyState;
  // 固定 ping 間隔，用來估算目前網路延遲。
  const PING_INTERVAL_MS = 1000;

  function updatePing(rtt) {
    const samples = state.network.pingSamples;
    samples.push(rtt);

    if (samples.length > 8) {
      samples.shift();
    }

    state.network.pingMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  }

  function sendPing() {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const id = state.network.nextPingId++;
    const sentAt = performance.now();
    state.network.pendingPings[id] = sentAt;
    state.network.lastPingSentAt = sentAt;

    const packet = {
      type: "ping",
      id,
    };

    logOutgoing(state, "PING", { id });
    ws.send(JSON.stringify(packet));
  }

  function canSend() {
    return ws.readyState === WebSocket.OPEN && !!state.myId;
  }

  // 移動輸入屬於高頻封包，但只有在「真的在移動」或「輸入狀態有變」時才會送。
  function sendCurrentInputState(inputSnapshot = state.inputState) {
    if (!canSend()) {
      logRuntime(state, "INPUT_BLOCKED", { readyState: ws.readyState, myId: state.myId || "null" });
      return;
    }

    state.lastSentInputSeq = state.nextInputSeq++;

    const packet = {
      type: "input",
      seq: state.lastSentInputSeq,
      up: inputSnapshot.up,
      down: inputSnapshot.down,
      left: inputSnapshot.left,
      right: inputSnapshot.right,
    };

    logOutgoing(state, "INPUT", {
      seq: packet.seq,
      up: +packet.up,
      down: +packet.down,
      left: +packet.left,
      right: +packet.right,
    });
    ws.send(JSON.stringify(packet));
    return state.lastSentInputSeq;
  }

  function sendShoot(aimX, aimY) {
    if (!canSend()) {
      logRuntime(state, "SHOOT_BLOCKED", { readyState: ws.readyState, myId: state.myId || "null" });
      return;
    }

    const packet = {
      type: "shoot",
      aimX,
      aimY,
    };
    logOutgoing(state, "SHOOT", {
      aimX,
      aimY,
    });
    ws.send(JSON.stringify(packet));
  }

  function sendAim(x, y) {
    if (!canSend()) {
      return;
    }

    ws.send(
      JSON.stringify({
        type: "aim",
        x,
        y,
      })
    );
  }

  function sendChat(text) {
    if (!canSend()) {
      logRuntime(state, "CHAT_BLOCKED", { readyState: ws.readyState, myId: state.myId || "null" });
      return;
    }

    const packet = {
      type: "chat",
      text,
    };

    logOutgoing(state, "CHAT", { text });
    ws.send(JSON.stringify(packet));
  }

  ws.onopen = () => {
    state.network.wsReadyState = ws.readyState;
    logRuntime(state, "WS_OPEN", { url: connectUrl.toString() });
    sendPing();
  };

  ws.onerror = (err) => {
    state.network.wsReadyState = ws.readyState;
    logRuntime(state, "WS_ERROR", { message: err?.message || "unknown" });
  };

  ws.onclose = (event) => {
    state.network.wsReadyState = ws.readyState;
    logRuntime(state, "WS_CLOSE", { code: event.code, reason: event.reason || "none" });
  };

  ws.onmessage = (event) => {
    state.network.wsReadyState = ws.readyState;
    const data = JSON.parse(event.data);

    if (data.type === "pong") {
      const sentAt = state.network.pendingPings[data.id];
      if (typeof sentAt === "number") {
        delete state.network.pendingPings[data.id];
        updatePing(performance.now() - sentAt);
      }
      return;
    }

    if (data.type === "init") {
      state.myId = data.id;
      logRuntime(state, "INIT", {
        myId: data.id,
        players: Object.keys(data.players).length,
        bullets: Object.keys(data.bullets || {}).length,
      });

      // init 是全量同步：第一次進場時直接用 server 狀態初始化整個 client 世界。
      for (const id in data.players) {
        state.players[id] = copyPlayerState(data.players[id]);
        state.renderPlayers[id] = {
          x: data.players[id].x,
          y: data.players[id].y,
        };
      }

      state.bullets = {};
      for (const id in data.bullets || {}) {
        state.bullets[id] = copyBulletState(data.bullets[id]);
      }

      if (state.players[state.myId]) {
        state.localPlayer.x = state.players[state.myId].x;
        state.localPlayer.y = state.players[state.myId].y;
        state.localPlayer.moveFacing = { ...state.players[state.myId].moveFacing };
        state.localPlayer.aimFacing = { ...state.players[state.myId].aimFacing };
        state.localMeta.previousHp = state.players[state.myId].hp;
        state.localRenderPlayer.x = state.localPlayer.x;
        state.localRenderPlayer.y = state.localPlayer.y;
      }

      return;
    }

    if (data.type === "playerJoined") {
      const player = copyPlayerState(data.player);
      state.players[player.id] = player;
      logRuntime(state, "PLAYER_JOINED", { id: player.id });

      if (!state.renderPlayers[player.id]) {
        state.renderPlayers[player.id] = { x: player.x, y: player.y };
      }

      return;
    }

    // movementPatch 只更新和移動預測相關的欄位。
    // 本地玩家收到後還要做 reconciliation，把尚未被 server ack 的輸入重放一次。
    if (data.type === "movementPatch") {
      for (const id in data.players) {
        const serverPlayer = mergeMovementState(state.players[id], data.players[id]);
        state.players[id] = serverPlayer;

        if (!state.renderPlayers[id]) {
          state.renderPlayers[id] = { x: serverPlayer.x, y: serverPlayer.y };
        }

        if (id !== state.myId) {
          continue;
        }

        const serverAck = serverPlayer.lastProcessedInput || 0;
        state.localPlayer.x = serverPlayer.x;
        state.localPlayer.y = serverPlayer.y;
        state.localPlayer.moveFacing = { ...serverPlayer.moveFacing };
        state.pendingInputs = state.pendingInputs.filter((entry) => entry.seq > serverAck);

        for (const pendingInput of state.pendingInputs) {
          applyInputToPositionWithPlayerCollision(
            state,
            state.localPlayer,
            pendingInput.inputState,
            TICK_DELTA * LOCAL_PREDICTION_SCALE,
            state.localPlayer.moveFacing,
            bounds
          );
        }
      }

      return;
    }

    // combatPatch 只更新血量與受擊狀態，避免污染高頻移動同步。
    if (data.type === "combatPatch") {
      for (const id in data.players) {
        const serverPlayer = mergeCombatState(state.players[id], data.players[id]);
        state.players[id] = serverPlayer;

        if (id !== state.myId) {
          continue;
        }

        const previousHp = state.localMeta.previousHp;
        state.localMeta.previousHp = serverPlayer.hp;

        const respawned =
          serverPlayer.hp === serverPlayer.maxHp && previousHp < serverPlayer.hp;

        if (respawned) {
          resetSpread(state);
          state.pendingInputs = [];
        }
      }

      return;
    }

    // aim 是獨立事件，不再夾在高頻 movement patch 裡。
    if (data.type === "aim") {
      if (state.players[data.playerId]) {
        state.players[data.playerId].aimFacing = {
          x: data.x,
          y: data.y,
        };
      }

      if (data.playerId === state.myId) {
        state.localPlayer.aimFacing = {
          x: data.x,
          y: data.y,
        };
      }

      return;
    }

    // 子彈位置不走每 tick 廣播，只處理生成與移除，飛行由 client 本地模擬。
    if (data.type === "bulletSpawn") {
      state.bullets[data.bullet.id] = copyBulletState(data.bullet);
      return;
    }

    if (data.type === "bulletRemove") {
      delete state.bullets[data.bulletId];
      return;
    }

    if (data.type === "remove") {
      delete state.players[data.id];
      delete state.renderPlayers[data.id];
      logRuntime(state, "PLAYER_REMOVE", { id: data.id });
      return;
    }

    if (data.type === "chat") {
      chatController.addChatLine(data.playerId, data.text);
      logRuntime(state, "CHAT_RECV", { playerId: data.playerId, text: data.text });
      return;
    }

    if (data.type === "hit") {
      state.hitEvents.push({
        ...data,
        expiresAt: performance.now() + 120,
      });
      logRuntime(state, "HIT", { attackerId: data.attackerId, targetId: data.targetId, damage: data.damage });
    }
  };

  window.setInterval(() => {
    sendPing();
  }, PING_INTERVAL_MS);

  return {
    sendAim,
    sendShoot,
    sendChat,
    sendCurrentInputState,
    ws,
  };
}
