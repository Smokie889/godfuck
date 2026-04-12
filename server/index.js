const { TICK_INTERVAL, SERVER_PORT } = require("./config");
const { players, bullets } = require("./world/state");
const { createPlayer } = require("./world/create-player");
const { resolvePlayerCollisions } = require("./systems/player-collision-system");
const { tickPlayerDashState } = require("./systems/movement-system");
const {
  serializePlayerPatches,
  serializePlayer,
  serializePlayers,
} = require("./net/serialize-system");
const { serializeBullets, updateBullets } = require("./systems/bullet-system");
const { createSocketServer, broadcast } = require("./net/socket-server");
const { handlePacket } = require("./net/packet-handlers");
const { SERVER_MESSAGE_TYPES } = require("./net/protocol");

const wss = createSocketServer();
// 用來記住上一個 tick 已經送出去的完整玩家快照。
// 之後 server 會拿目前狀態和它比較，只廣播有變動的欄位。
const previousStateSnapshots = {};

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
      // 初次連線仍然要送完整狀態，讓 client 能立刻建立本地世界。
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
    delete previousStateSnapshots[id];

    broadcast(wss, {
      type: SERVER_MESSAGE_TYPES.REMOVE,
      id,
    });
  });
});

setInterval(() => {
  const deltaTime = TICK_INTERVAL / 1000;
  const now = Date.now();

  // 先解玩家移動與玩家間碰撞，再更新子彈與命中結果。
  resolvePlayerCollisions(players, deltaTime);
  updateBullets({ bullets, players, deltaTime, wss, broadcast });
  for (const id in players) {
    tickPlayerDashState(players[id], deltaTime);
  }

  // 把同步拆成移動 patch 和戰鬥 patch：
  // 高頻的位移/ack 走 movement，血量/受擊走 combat。
  const { movementPlayers, combatPlayers } = serializePlayerPatches(
    players,
    now,
    previousStateSnapshots
  );

  if (Object.keys(movementPlayers).length > 0) {
    broadcast(wss, {
      type: SERVER_MESSAGE_TYPES.MOVEMENT_PATCH,
      players: movementPlayers,
      serverTime: now,
    });
  }

  if (Object.keys(combatPlayers).length > 0) {
    broadcast(wss, {
      type: SERVER_MESSAGE_TYPES.COMBAT_PATCH,
      players: combatPlayers,
      serverTime: now,
    });
  }
}, TICK_INTERVAL);

console.log(`Server running on ws://localhost:${SERVER_PORT}`);
