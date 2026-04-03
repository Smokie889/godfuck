const { TICK_INTERVAL, SERVER_PORT } = require("./config");
const { players } = require("./world/state");
const { createPlayer } = require("./world/create-player");
const { updateMovement } = require("./systems/movement-system");
const { serializePlayer, serializePlayers } = require("./net/serialize-system");
const { createSocketServer, broadcast } = require("./net/socket-server");
const { handlePacket } = require("./net/packet-handlers");
const { SERVER_MESSAGE_TYPES } = require("./net/protocol");

const wss = createSocketServer();

function makePlayerId() {
  return Math.random().toString(36).slice(2, 7);
}

wss.on("connection", (ws) => {
  const id = makePlayerId();
  ws.id = id;

  players[id] = createPlayer(id);

  console.log(`Player connected: ${id}`);

  ws.send(
    JSON.stringify({
      type: SERVER_MESSAGE_TYPES.INIT,
      id,
      players: serializePlayers(players, Date.now()),
    })
  );

  broadcast(wss, {
    type: SERVER_MESSAGE_TYPES.PLAYER_JOINED,
    player: serializePlayer(players[id], Date.now()),
  });

  ws.on("message", (message) => {
    handlePacket({
      message,
      playerId: id,
      players,
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

  broadcast(wss, {
    type: SERVER_MESSAGE_TYPES.STATE,
    players: serializePlayers(players, now),
    serverTime: now,
  });
}, TICK_INTERVAL);

console.log(`Server running on ws://localhost:${SERVER_PORT}`);