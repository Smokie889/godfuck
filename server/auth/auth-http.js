const {
  getUserProfile,
  loginUser,
  registerUser,
  updateDisplayName,
} = require("./auth-service");
const {
  addMemberToRoom,
  createPublicRoom,
  getRoom,
  listRooms,
  removeMemberFromRoom,
  serializeRoomDetail,
  serializeRoomSummary,
  setRoomMemberReady,
  startRoomMatch,
} = require("../world/room-manager");
const {
  broadcastRoomList,
  subscribeRoomList,
  unsubscribeRoomList,
} = require("../world/room-events");

const LOBBY_ANNOUNCEMENTS = [
  "Welcome to godfuck. Prototype lobby is now online.",
  "Shotgun can be picked up from the arena floor. Use ` to drop it.",
  "Next step: fixed maps, ammo system, and full room flow.",
];

let realtimeBridge = {
  publishRoomListUpdate: () => {},
  publishRoomLobbyUpdate: () => {},
  publishRoomClosed: () => {},
};

function setJsonHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function sendJson(res, statusCode, payload) {
  setJsonHeaders(res);
  res.writeHead(statusCode);
  res.end(JSON.stringify(payload));
}

function setSseHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
}

function getSerializedRoomList() {
  return listRooms().map(serializeRoomSummary);
}

function publishRoomListUpdate() {
  broadcastRoomList({
    rooms: getSerializedRoomList(),
  });
  realtimeBridge.publishRoomListUpdate();
}

function setRealtimeBridge(nextBridge) {
  realtimeBridge = {
    ...realtimeBridge,
    ...nextBridge,
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 10_000) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function handleAuthRequest(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  const pathParts = requestUrl.pathname.split("/").filter(Boolean);

  if (req.method === "OPTIONS") {
    setJsonHeaders(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/lobby") {
    const userId = requestUrl.searchParams.get("userId");
    const profile = getUserProfile(userId);
    sendJson(res, 200, {
      ok: true,
      profile,
      rooms: getSerializedRoomList(),
      announcements: LOBBY_ANNOUNCEMENTS,
    });
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/lobby/stream") {
    setSseHeaders(res);
    res.writeHead(200);
    subscribeRoomList(res);
    res.write(`event: roomList\ndata: ${JSON.stringify({ rooms: getSerializedRoomList() })}\n\n`);
    req.on("close", () => {
      unsubscribeRoomList(res);
    });
    return true;
  }

  if (req.method === "GET" && pathParts[0] === "api" && pathParts[1] === "rooms" && pathParts[2]) {
    const userId = requestUrl.searchParams.get("userId");
    const room = getRoom(pathParts[2]);

    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    sendJson(res, 200, {
      ok: true,
      room: serializeRoomDetail(room, userId),
    });
    return true;
  }

  if (req.method !== "POST") {
    return false;
  }

  if (requestUrl.pathname === "/api/register") {
    const body = await readJsonBody(req);
    const result = await registerUser(body.userId, body.password, body.displayName);
    sendJson(res, 201, {
      ok: true,
      user: result,
    });
    return true;
  }

  if (requestUrl.pathname === "/api/login") {
    const body = await readJsonBody(req);
    const result = await loginUser(body.userId, body.password);
    sendJson(res, 200, {
      ok: true,
      user: result,
    });
    return true;
  }

  if (requestUrl.pathname === "/api/profile/display-name") {
    const body = await readJsonBody(req);
    const profile = await updateDisplayName(body.userId, body.displayName);
    sendJson(res, 200, {
      ok: true,
      profile,
    });
    return true;
  }

  if (requestUrl.pathname === "/api/rooms") {
    const body = await readJsonBody(req);
    const ownerProfile = getUserProfile(body.userId);
    const room = createPublicRoom(body.roomName, ownerProfile);
    publishRoomListUpdate();
    realtimeBridge.publishRoomLobbyUpdate(room, ownerProfile.userId);
    sendJson(res, 201, {
      ok: true,
      room: serializeRoomDetail(room, ownerProfile.userId),
    });
    return true;
  }

  if (pathParts[0] === "api" && pathParts[1] === "rooms" && pathParts[2] && pathParts[3] === "join") {
    const body = await readJsonBody(req);
    const profile = getUserProfile(body.userId);
    const room = addMemberToRoom(pathParts[2], profile);
    publishRoomListUpdate();
    realtimeBridge.publishRoomLobbyUpdate(room, profile.userId);
    sendJson(res, 200, {
      ok: true,
      room: serializeRoomDetail(room, profile.userId),
    });
    return true;
  }

  if (pathParts[0] === "api" && pathParts[1] === "rooms" && pathParts[2] && pathParts[3] === "leave") {
    const body = await readJsonBody(req);
    const result = removeMemberFromRoom(pathParts[2], body.userId);
    publishRoomListUpdate();

    if (result.wasDeleted) {
      realtimeBridge.publishRoomClosed(pathParts[2]);
    } else if (result.room) {
      realtimeBridge.publishRoomLobbyUpdate(result.room, body.userId);
    }

    sendJson(res, 200, {
      ok: true,
      roomDeleted: result.wasDeleted,
      room: result.room ? serializeRoomSummary(result.room) : null,
    });
    return true;
  }

  if (pathParts[0] === "api" && pathParts[1] === "rooms" && pathParts[2] && pathParts[3] === "ready") {
    const body = await readJsonBody(req);
    const room = setRoomMemberReady(pathParts[2], body.userId, body.isReady);
    realtimeBridge.publishRoomLobbyUpdate(room, body.userId);
    sendJson(res, 200, {
      ok: true,
      room: serializeRoomDetail(room, body.userId),
    });
    return true;
  }

  if (pathParts[0] === "api" && pathParts[1] === "rooms" && pathParts[2] && pathParts[3] === "start") {
    const body = await readJsonBody(req);
    const room = startRoomMatch(pathParts[2], body.userId);
    publishRoomListUpdate();
    realtimeBridge.publishRoomLobbyUpdate(room, body.userId);
    sendJson(res, 200, {
      ok: true,
      room: serializeRoomDetail(room, body.userId),
    });
    return true;
  }

  return false;
}

function handleAuthError(res, error) {
  const message = error?.message || "UNKNOWN_ERROR";

  if (
    message === "MISSING_CREDENTIALS" ||
    message === "INVALID_USER_ID" ||
    message === "INVALID_DISPLAY_NAME" ||
    message === "INVALID_PASSWORD" ||
    message === "INVALID_JSON"
  ) {
    sendJson(res, 400, { ok: false, error: message });
    return;
  }

  if (message === "USER_EXISTS") {
    sendJson(res, 409, { ok: false, error: message });
    return;
  }

  if (message === "INVALID_CREDENTIALS") {
    sendJson(res, 401, { ok: false, error: message });
    return;
  }

  if (message === "USER_NOT_FOUND") {
    sendJson(res, 404, { ok: false, error: message });
    return;
  }

  if (message === "ROOM_NOT_FOUND") {
    sendJson(res, 404, { ok: false, error: message });
    return;
  }

  if (
    message === "ROOM_FULL" ||
    message === "ROOM_NOT_JOINABLE" ||
    message === "ROOM_MEMBER_NOT_FOUND" ||
    message === "ROOM_NOT_READY" ||
    message === "ROOM_HOST_ONLY" ||
    message === "ROOM_ALREADY_STARTED"
  ) {
    sendJson(res, 400, { ok: false, error: message });
    return;
  }

  if (message === "PAYLOAD_TOO_LARGE") {
    sendJson(res, 413, { ok: false, error: message });
    return;
  }

  sendJson(res, 500, { ok: false, error: "INTERNAL_ERROR" });
}

module.exports = {
  handleAuthError,
  handleAuthRequest,
  publishRoomListUpdate,
  setRealtimeBridge,
};
