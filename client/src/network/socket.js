import { LOCAL_PREDICTION_SCALE, TICK_DELTA, WS_URL } from "../config.js";
import { copyBulletState } from "../game/bullets.js";
import { applyInputToPosition } from "../game/movement.js";
import { copyPlayerState } from "../game/player.js";
import { resetSpread } from "../game/shooting.js";

export function createSocketClient(state, bounds, chatController, playerId) {
  const connectUrl = new URL(WS_URL);
  connectUrl.searchParams.set("playerId", playerId);

  const ws = new WebSocket(connectUrl.toString());

  function canSend() {
    return ws.readyState === WebSocket.OPEN && !!state.myId;
  }

  function sendCurrentInputState(inputSnapshot = state.inputState) {
    console.log("[SEND INPUT] try", {
      readyState: ws.readyState,
      myId: state.myId,
      inputState: { ...inputSnapshot },
    });

    if (!canSend()) {
      console.log("[SEND INPUT] blocked");
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

    console.log("[SEND INPUT] send", packet);
    ws.send(JSON.stringify(packet));
    return state.lastSentInputSeq;
  }

  function sendShoot(aimX, aimY) {
    console.log("[SEND SHOOT] try", {
      readyState: ws.readyState,
      myId: state.myId,
    });

    if (!canSend()) {
      console.log("[SEND SHOOT] blocked");
      return;
    }

    const packet = {
      type: "shoot",
      aimX,
      aimY,
    };
    console.log("[SEND SHOOT] send", packet);
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
    console.log("[SEND CHAT] try", {
      readyState: ws.readyState,
      myId: state.myId,
      text,
    });

    if (!canSend()) {
      console.log("[SEND CHAT] blocked");
      return;
    }

    const packet = {
      type: "chat",
      text,
    };

    console.log("[SEND CHAT] send", packet);
    ws.send(JSON.stringify(packet));
  }

  ws.onopen = () => {
    console.log("[WS] open");
  };

  ws.onerror = (err) => {
    console.log("[WS] error", err);
  };

  ws.onclose = (event) => {
    console.log("[WS] close", event.code, event.reason);
  };

  ws.onmessage = (event) => {
    console.log("[WS] raw message", event.data);

    const data = JSON.parse(event.data);
    console.log("[WS] parsed type =", data.type, "full =", data);

    if (data.type === "init") {
      state.myId = data.id;

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

      if (!state.renderPlayers[player.id]) {
        state.renderPlayers[player.id] = { x: player.x, y: player.y };
      }

      return;
    }

    if (data.type === "state") {
      for (const id in data.players) {
        const serverPlayer = copyPlayerState(data.players[id]);
        const previousAimFacing = state.players[id]?.aimFacing;
        if (previousAimFacing && !serverPlayer.aimFacing) {
          serverPlayer.aimFacing = { ...previousAimFacing };
        }
        state.players[id] = serverPlayer;

        if (!state.renderPlayers[id]) {
          state.renderPlayers[id] = { x: serverPlayer.x, y: serverPlayer.y };
        }

        if (id !== state.myId) {
          continue;
        }

        const previousHp = state.localMeta.previousHp;
        const serverAck = serverPlayer.lastProcessedInput || 0;
        state.localPlayer.x = serverPlayer.x;
        state.localPlayer.y = serverPlayer.y;
        state.localPlayer.moveFacing = { ...serverPlayer.moveFacing };
        state.localMeta.previousHp = serverPlayer.hp;
        state.pendingInputs = state.pendingInputs.filter((entry) => entry.seq > serverAck);

        const respawned =
          serverPlayer.hp === serverPlayer.maxHp && previousHp < serverPlayer.hp;

        if (respawned) {
          resetSpread(state);
          state.pendingInputs = [];
        }

        for (const pendingInput of state.pendingInputs) {
          applyInputToPosition(
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
      return;
    }

    if (data.type === "chat") {
      chatController.addChatLine(data.playerId, data.text);
      return;
    }

    if (data.type === "hit") {
      state.hitEvents.push({
        ...data,
        expiresAt: performance.now() + 120,
      });
    }
  };

  return {
    sendAim,
    sendShoot,
    sendChat,
    sendCurrentInputState,
    ws,
  };
}
