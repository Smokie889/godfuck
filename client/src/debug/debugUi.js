const MAX_DEBUG_LINES = 18;

function formatValue(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === "object" && value) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function formatEntry(entry) {
  if (typeof entry === "string") {
    return entry;
  }

  const details = entry.data
    ? Object.entries(entry.data)
        .map(([key, value]) => `${key}=${formatValue(value)}`)
        .join(" ")
    : "";

  return details ? `[${entry.tag}] ${details}` : `[${entry.tag}]`;
}

function upsertFixedEntry(list, tag, data) {
  const text = formatEntry({ tag, data });
  const existing = list.find((entry) => entry.fixedTag === tag);

  if (existing) {
    existing.text = text;
    return;
  }

  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    fixedTag: tag,
  });
}

function pushDebugEntry(list, entry) {
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: formatEntry(entry),
  });

  if (list.length > MAX_DEBUG_LINES) {
    list.length = MAX_DEBUG_LINES;
  }
}

export function logOutgoing(state, tag, data) {
  if (tag === "PING" || tag === "AIM") {
    return;
  }

  if (tag === "INPUT") {
    upsertFixedEntry(state.debug.outgoing, tag, data);
    return;
  }

  pushDebugEntry(state.debug.outgoing, { tag, data });
}

export function logRuntime(state, tag, data) {
  if (
    tag === "PONG" ||
    tag === "BULLET_SPAWN" ||
    tag === "BULLET_REMOVE"
  ) {
    return;
  }

  pushDebugEntry(state.debug.runtime, { tag, data });
}

function renderDebugList(container, entries) {
  container.innerHTML = "";

  for (const entry of entries) {
    const line = document.createElement("div");
    line.className = "debug-line";
    line.textContent = entry.text;
    container.appendChild(line);
  }
}

export function createDebugUi(state, elements) {
  function splitFixedEntries(entries) {
    const fixedEntries = [];
    const eventEntries = [];

    for (const entry of entries) {
      if (entry.fixedTag) {
        fixedEntries.push(entry);
        continue;
      }

      eventEntries.push(entry);
    }

    return { fixedEntries, eventEntries };
  }

  function getRuntimeSummary() {
    const localServerPlayer = state.myId ? state.players[state.myId] : null;

    return [
      {
        id: "summary-ws",
        text: `[STATUS] myId=${state.myId || "null"} readyState=${
          state.network.wsReadyState
        } ping=${state.network.pingMs > 0 ? Math.round(state.network.pingMs) : "--"}ms`,
      },
      {
        id: "summary-input",
        text: `[INPUT] U${+state.inputState.up} D${+state.inputState.down} L${+state.inputState.left} R${+state.inputState.right} sent=${state.lastSentInputSeq}`,
      },
      {
        id: "summary-server",
        text: localServerPlayer
          ? `[SERVER] x=${localServerPlayer.x.toFixed(1)} y=${localServerPlayer.y.toFixed(
              1
            )} ack=${localServerPlayer.lastProcessedInput || 0}`
          : "[SERVER] waiting for init",
      },
      {
        id: "summary-logic",
        text: `[LOGIC] x=${state.localPlayer.x.toFixed(1)} y=${state.localPlayer.y.toFixed(
          1
        )} bullets=${Object.keys(state.bullets).length}`,
      },
      {
        id: "summary-render",
        text: `[RENDER] x=${state.localRenderPlayer.x.toFixed(1)} y=${state.localRenderPlayer.y.toFixed(
          1
        )} chat=${state.isChatting ? "typing" : "game"}`,
      },
      {
        id: "summary-state",
        text: `[STATE] players=${Object.keys(state.players).length} bullets=${Object.keys(
          state.bullets
        ).length} events=${state.debug.runtime.length}`,
      },
    ];
  }

  function updateHud() {
    const currentPlayer = state.myId ? state.players[state.myId] : null;
    const hp = currentPlayer ? `${currentPlayer.hp} / ${currentPlayer.maxHp}` : "0 / 0";
    const pingText =
      state.network.pingMs > 0 ? `${Math.round(state.network.pingMs)} ms` : "-- ms";

    elements.hudHealth.textContent = hp;
    elements.hudStamina.textContent = `${state.hud.stamina} / ${state.hud.maxStamina}`;
    elements.hudPing.textContent = pingText;
  }

  function render() {
    const outgoingEntries = splitFixedEntries(state.debug.outgoing);
    const runtimeEntries = splitFixedEntries(state.debug.runtime);

    updateHud();
    renderDebugList(elements.outgoingFixedDebug, outgoingEntries.fixedEntries);
    renderDebugList(elements.outgoingDebug, outgoingEntries.eventEntries);
    renderDebugList(elements.runtimeFixedDebug, [
      ...getRuntimeSummary(),
      ...runtimeEntries.fixedEntries,
    ]);
    renderDebugList(elements.runtimeDebug, runtimeEntries.eventEntries);
  }

  return { render };
}

export function buildDebugSnapshot(state) {
  return {
    outgoing: state.debug.outgoing,
    runtime: state.debug.runtime,
    network: {
      wsReadyState: state.network.wsReadyState,
      pingMs: state.network.pingMs,
    },
    myId: state.myId,
    inputState: state.inputState,
    lastSentInputSeq: state.lastSentInputSeq,
    localPlayer: state.localPlayer,
    localRenderPlayer: state.localRenderPlayer,
    localServerPlayer: state.myId ? state.players[state.myId] : null,
    bulletsCount: Object.keys(state.bullets).length,
    playersCount: Object.keys(state.players).length,
    isChatting: state.isChatting,
  };
}

export function createRemoteDebugUi(elements) {
  function splitFixedEntries(entries) {
    const fixedEntries = [];
    const eventEntries = [];

    for (const entry of entries || []) {
      if (entry.fixedTag) {
        fixedEntries.push(entry);
        continue;
      }

      eventEntries.push(entry);
    }

    return { fixedEntries, eventEntries };
  }

  function getRuntimeSummary(snapshot) {
    const localServerPlayer = snapshot.localServerPlayer;

    return [
      {
        id: "summary-ws",
        text: `[STATUS] myId=${snapshot.myId || "null"} readyState=${
          snapshot.network.wsReadyState
        } ping=${snapshot.network.pingMs > 0 ? Math.round(snapshot.network.pingMs) : "--"}ms`,
      },
      {
        id: "summary-input",
        text: `[INPUT] U${+snapshot.inputState.up} D${+snapshot.inputState.down} L${+snapshot.inputState.left} R${+snapshot.inputState.right} sent=${snapshot.lastSentInputSeq}`,
      },
      {
        id: "summary-server",
        text: localServerPlayer
          ? `[SERVER] x=${localServerPlayer.x.toFixed(1)} y=${localServerPlayer.y.toFixed(
              1
            )} ack=${localServerPlayer.lastProcessedInput || 0}`
          : "[SERVER] waiting for init",
      },
      {
        id: "summary-logic",
        text: `[LOGIC] x=${snapshot.localPlayer.x.toFixed(1)} y=${snapshot.localPlayer.y.toFixed(
          1
        )} bullets=${snapshot.bulletsCount}`,
      },
      {
        id: "summary-render",
        text: `[RENDER] x=${snapshot.localRenderPlayer.x.toFixed(
          1
        )} y=${snapshot.localRenderPlayer.y.toFixed(1)} chat=${
          snapshot.isChatting ? "typing" : "game"
        }`,
      },
      {
        id: "summary-state",
        text: `[STATE] players=${snapshot.playersCount} bullets=${snapshot.bulletsCount} events=${
          (snapshot.runtime || []).length
        }`,
      },
    ];
  }

  function render(snapshot) {
    const outgoingEntries = splitFixedEntries(snapshot.outgoing);
    const runtimeEntries = splitFixedEntries(snapshot.runtime);

    renderDebugList(elements.outgoingFixedDebug, outgoingEntries.fixedEntries);
    renderDebugList(elements.outgoingDebug, outgoingEntries.eventEntries);
    renderDebugList(elements.runtimeFixedDebug, [
      ...getRuntimeSummary(snapshot),
      ...runtimeEntries.fixedEntries,
    ]);
    renderDebugList(elements.runtimeDebug, runtimeEntries.eventEntries);
  }

  return { render };
}
