const { TICK_INTERVAL, SERVER_PORT } = require("./config");
const http = require("http");
const { createPlayer } = require("./world/create-player");
const {
  handleAuthError,
  handleAuthRequest,
  publishRoomListUpdate,
  setRealtimeBridge,
} = require("./auth/auth-http");
const {
  ackRoomMemberSync,
  deleteRoomIfEmpty,
  getRoom,
  listRooms,
  serializeRoomDetail,
  updateRoomLifecycle,
} = require("./world/room-manager");
const { resolvePlayerCollisions } = require("./systems/player-collision-system");
const { tickPlayerDashState } = require("./systems/movement-system");
const {
  serializePlayerPatches,
  serializePlayer,
  serializePlayers,
} = require("./net/serialize-system");
const { serializeBullets, updateBullets } = require("./systems/bullet-system");
const { ensureWeaponDrops, serializeWeaponDrops } = require("./systems/weapon-drop-system");
const {
  createSocketServer,
  broadcastToRoom,
  broadcastToRoomLobby,
  broadcastToRoomLobbyEach,
} = require("./net/socket-server");
const { handlePacket } = require("./net/packet-handlers");
const { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } = require("./net/protocol");

const { initDatabase } = require("./db");
initDatabase();

const httpServer = http.createServer(async (req, res) => {
  try {
    const handled = await handleAuthRequest(req, res);

    if (handled) {
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "NOT_FOUND" }));
  } catch (error) {
    handleAuthError(res, error);
  }
});

const wss = createSocketServer(httpServer);

function publishRoomLobbyUpdate(room, currentUserId = null) {
  if (!room) {
    return;
  }

  broadcastToRoomLobbyEach(wss, room.id, (client) => ({
    type: SERVER_MESSAGE_TYPES.ROOM_LOBBY_SYNC,
    room: serializeRoomDetail(room, client.id || currentUserId),
  }));
}

function publishRoomClosed(roomId) {
  broadcastToRoomLobby(wss, roomId, {
    type: SERVER_MESSAGE_TYPES.ROOM_CLOSED,
    roomId,
  });
}

setRealtimeBridge({
  publishRoomLobbyUpdate,
  publishRoomClosed,
});

function sanitizePlayerId(rawId) {
  const trimmed = String(rawId || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 16);

  return trimmed || "player";
}

function makeUniquePlayerId(room, requestedId) {
  const baseId = sanitizePlayerId(requestedId);

  if (!room.players[baseId]) {
    return baseId;
  }

  let suffix = 2;
  while (room.players[`${baseId}-${suffix}`]) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

wss.on("connection", (ws, req) => {
  const requestUrl = new URL(req.url, `ws://${req.headers.host}`);
  const mode = requestUrl.searchParams.get("mode") || "game";
  const requestedId = requestUrl.searchParams.get("playerId");
  const requestedUserId = requestUrl.searchParams.get("userId");
  const requestedDisplayName = requestUrl.searchParams.get("displayName");
  const requestedRoomId = requestUrl.searchParams.get("roomId");

  const room = getRoom(requestedRoomId);

  if (mode === "roomLobby") {
    if (!room || !requestedUserId || !room.members[requestedUserId]) {
      ws.close(1008, "ROOM_LOBBY_UNAVAILABLE");
      return;
    }

    ws.id = requestedUserId;
    ws.roomId = room.id;
    ws.channel = "roomLobby";

    ws.send(
      JSON.stringify({
        type: SERVER_MESSAGE_TYPES.ROOM_LOBBY_SYNC,
        room: serializeRoomDetail(room, requestedUserId),
      })
    );

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type !== CLIENT_MESSAGE_TYPES.ROOM_LOBBY_ACK) {
          return;
        }

        const roomAfterAck = ackRoomMemberSync(room.id, requestedUserId, data.syncNonce);
        publishRoomLobbyUpdate(roomAfterAck);
        publishRoomListUpdate();
      } catch (error) {
        console.error("Room lobby socket error:", error);
      }
    });

    ws.on("close", () => {});
    return;
  }

  if (!room || (room.status !== "starting" && room.status !== "in-game")) {
    ws.close(1008, "ROOM_NOT_ACTIVE");
    return;
  }

  if (!requestedUserId || !room.members[requestedUserId]) {
    ws.close(1008, "ROOM_MEMBER_REQUIRED");
    return;
  }

  ensureWeaponDrops(room.weaponDrops);

  const id = requestedUserId || makeUniquePlayerId(room, requestedId);
  ws.id = id;
  ws.roomId = room.id;
  ws.channel = "game";

  room.players[id] = createPlayer(id, requestedUserId, requestedDisplayName || requestedId || requestedUserId);

  console.log(`Player connected: ${id} @ ${room.id}`);

  ws.send(
    JSON.stringify({
      type: SERVER_MESSAGE_TYPES.INIT,
      id,
      roomId: room.id,
      mapId: room.mapId,
      players: serializePlayers(room.players, Date.now(), { includeAimFacing: true }),
      bullets: serializeBullets(room.bullets),
      weaponDrops: serializeWeaponDrops(room.weaponDrops),
    })
  );

  broadcastToRoom(wss, room.id, {
    type: SERVER_MESSAGE_TYPES.PLAYER_JOINED,
    player: serializePlayer(room.players[id], Date.now(), { includeAimFacing: true }),
  });

  ws.on("message", (message) => {
    handlePacket({
      message,
      playerId: id,
      room,
      ws,
      wss,
      broadcast: broadcastToRoom,
    });
  });

  ws.on("close", () => {
    console.log(`Player disconnected: ${id} @ ${room.id}`);
    delete room.players[id];
    delete room.previousStateSnapshots[id];

    broadcastToRoom(wss, room.id, {
      type: SERVER_MESSAGE_TYPES.REMOVE,
      id,
    });

    deleteRoomIfEmpty(room);
  });
});

setInterval(() => {
  const deltaTime = TICK_INTERVAL / 1000;
  const now = Date.now();

  for (const room of listRooms()) {
    const previousStatus = room.status;
    updateRoomLifecycle(room, now);

    if (room.status !== "in-game") {
      if (previousStatus !== room.status) {
        publishRoomListUpdate();
        publishRoomLobbyUpdate(room);
      }
      continue;
    }

    resolvePlayerCollisions(room.players, deltaTime);
    updateBullets({
      bullets: room.bullets,
      players: room.players,
      room,
      deltaTime,
      roomId: room.id,
      wss,
      broadcast: broadcastToRoom,
    });

    for (const id in room.players) {
      tickPlayerDashState(room.players[id], deltaTime);
    }

    const { movementPlayers, combatPlayers } = serializePlayerPatches(
      room.players,
      now,
      room.previousStateSnapshots
    );

    if (Object.keys(movementPlayers).length > 0) {
      broadcastToRoom(wss, room.id, {
        type: SERVER_MESSAGE_TYPES.MOVEMENT_PATCH,
        players: movementPlayers,
        serverTime: now,
      });
    }

    if (Object.keys(combatPlayers).length > 0) {
      broadcastToRoom(wss, room.id, {
        type: SERVER_MESSAGE_TYPES.COMBAT_PATCH,
        players: combatPlayers,
        serverTime: now,
      });
    }

    if (previousStatus !== room.status) {
      publishRoomListUpdate();
      publishRoomLobbyUpdate(room);
    }
  }
}, TICK_INTERVAL);

httpServer.listen(SERVER_PORT, () => {
  console.log(`Server running on http://localhost:${SERVER_PORT}`);
  console.log(`WebSocket endpoint ready on ws://localhost:${SERVER_PORT}`);
});
