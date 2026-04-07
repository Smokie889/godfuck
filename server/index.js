const { TICK_INTERVAL, SERVER_PORT } = require("./config");
const { players, bullets } = require("./world/state");
const { createPlayer } = require("./world/create-player");
const { updateMovement } = require("./systems/movement-system");
const { serializePlayer, serializePlayers } = require("./net/serialize-system");
const { serializeBullets, updateBullets } = require("./systems/bullet-system");
const { createSocketServer, broadcast } = require("./net/socket-server");
const { handlePacket } = require("./net/packet-handlers");
const { SERVER_MESSAGE_TYPES } = require("./net/protocol");

const wss = createSocketServer();

function sanitizePlayerId(rawId) {
  const trimmed = String(rawId || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 16);

  return trimmed || "player";
}

function makeUniquePlayerId(requestedId) {
  const baseId = sanitizePlayerId(requestedId);

  if (!players[baseId]) {
    return baseId;
  }

  let suffix = 2;
  while (players[`${baseId}-${suffix}`]) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

wss.on("connection", (ws, req) => {
  const requestUrl = new URL(req.url, `ws://${req.headers.host}`);
  const requestedId = requestUrl.searchParams.get("playerId");
  const id = makeUniquePlayerId(requestedId);
  ws.id = id;

  players[id] = createPlayer(id);

  console.log(`Player connected: ${id}`);

  ws.send(
    JSON.stringify({
      type: SERVER_MESSAGE_TYPES.INIT,
      id,
      players: serializePlayers(players, Date.now(), { includeAimFacing: true }),
      bullets: serializeBullets(bullets),
    })
  );

  broadcast(wss, {
    type: SERVER_MESSAGE_TYPES.PLAYER_JOINED,
    player: serializePlayer(players[id], Date.now(), { includeAimFacing: true }),
  });

  ws.on("message", (message) => {
    handlePacket({
      message,
      playerId: id,
      players,
      bullets,
      ws,
      wss,
      broadcast,
    });
  });

  ws.on("close", () => {
    console.log(`Player disconnected: ${id}`);
    delete players[id];

    broadcast(wss, {
      type: SERVER_MESSAGE_TYPES.REMOVE,
      id,
    });
  });
});

setInterval(() => {
  const deltaTime = TICK_INTERVAL / 1000;
  const now = Date.now();

  updateMovement(players, deltaTime);
  updateBullets({ bullets, players, deltaTime, wss, broadcast });

  broadcast(wss, {
    type: SERVER_MESSAGE_TYPES.STATE,
    players: serializePlayers(players, now),
    serverTime: now,
  });
}, TICK_INTERVAL);

console.log(`Server running on ws://localhost:${SERVER_PORT}`);
