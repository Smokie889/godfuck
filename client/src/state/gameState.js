export function createGameState() {
  return {
    myId: null,
    requestedPlayerId: null,
    players: {},
    renderPlayers: {},
    bullets: {},
    hitEvents: [],
    playerChatBubbles: {},
    localPlayer: {
      x: 0,
      y: 0,
      moveFacing: { x: 0, y: -1 },
      aimFacing: { x: 0, y: -1 },
    },
    localRenderPlayer: {
      x: 0,
      y: 0,
    },
    inputState: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    pendingInputs: [],
    nextInputSeq: 1,
    lastSentInputSeq: 0,
    isChatting: false,
    chatMessages: [],
    mouse: {
      x: 0,
      y: 0,
      insideCanvas: false,
      leftDown: false,
    },
    spread: {
      movement: 0,
      shot: 0,
      lastShotTime: 0,
    },
    localMeta: {
      previousHp: 100,
      lastSentInputSignature: "0,0,0,0",
    },
    aimSync: {
      lastSentAt: 0,
      lastX: 0,
      lastY: -1,
    },
    network: {
      pingMs: 0,
      pingSamples: [],
      nextPingId: 1,
      pendingPings: {},
      lastPingSentAt: 0,
      wsReadyState: 0,
    },
    hud: {
      stamina: 100,
      maxStamina: 100,
    },
    frameAnalysis: {
      frame: 0,
      lastTickMs: 0,
      lastInputSeq: 0,
      lastServerAck: 0,
      pendingCount: 0,
      correctionDistance: 0,
    },
    debug: {
      outgoing: [],
      runtime: [],
    },
  };
}
