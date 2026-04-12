const { rooms } = require("./state");
const { createRoom } = require("./create-room");

const DEFAULT_ROOM_ID = "lobby-01";
const ROOM_MAX_PLAYERS = 4;
const ROOM_START_TRANSITION_MS = 3000;

function sanitizeRoomId(rawRoomId) {
  const trimmed = String(rawRoomId || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 24);

  return trimmed || DEFAULT_ROOM_ID;
}

function getOrCreateRoom(rawRoomId) {
  const roomId = sanitizeRoomId(rawRoomId);

  if (!rooms[roomId]) {
    rooms[roomId] = createRoom(roomId);
  }

  return rooms[roomId];
}

function getRoom(rawRoomId) {
  const roomId = sanitizeRoomId(rawRoomId);
  return rooms[roomId] || null;
}

function createPublicRoom(rawLabel, ownerProfile) {
  if (!ownerProfile?.userId) {
    throw new Error("USER_NOT_FOUND");
  }

  const normalizedLabel = String(rawLabel || "").trim().slice(0, 32);
  const baseLabel = normalizedLabel || "New Room";
  const baseRoomId = sanitizeRoomId(baseLabel);

  let suffix = 1;
  let nextRoomId = baseRoomId;

  while (rooms[nextRoomId]) {
    suffix += 1;
    nextRoomId = sanitizeRoomId(`${baseRoomId}-${suffix}`);
  }

  const room = createRoom(nextRoomId, {
    label: baseLabel,
    status: "waiting",
    hostUserId: ownerProfile.userId,
    maxPlayers: ROOM_MAX_PLAYERS,
  });

  room.members[ownerProfile.userId] = {
    userId: ownerProfile.userId,
    displayName: ownerProfile.displayName,
    isReady: false,
    joinedAt: Date.now(),
    squadId: null,
  };

  rooms[nextRoomId] = room;
  return room;
}

function getRoomOrThrow(rawRoomId) {
  const room = getRoom(rawRoomId);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  return room;
}

function addMemberToRoom(rawRoomId, profile) {
  const room = getRoomOrThrow(rawRoomId);

  if (room.status !== "waiting") {
    throw new Error("ROOM_NOT_JOINABLE");
  }

  if (room.members[profile.userId]) {
    room.members[profile.userId].displayName = profile.displayName;
    return room;
  }

  if (Object.keys(room.members).length >= room.maxPlayers) {
    throw new Error("ROOM_FULL");
  }

  room.members[profile.userId] = {
    userId: profile.userId,
    displayName: profile.displayName,
    isReady: false,
    joinedAt: Date.now(),
    squadId: null,
  };

  return room;
}

function removeMemberFromRoom(rawRoomId, userId) {
  const room = getRoomOrThrow(rawRoomId);

  if (!room.members[userId]) {
    return { room, wasDeleted: false };
  }

  const isHostLeaving = room.hostUserId === userId;
  delete room.members[userId];

  if (isHostLeaving || Object.keys(room.members).length === 0) {
    delete rooms[room.id];
    return { room: null, wasDeleted: true };
  }

  return { room, wasDeleted: false };
}

function setRoomMemberReady(rawRoomId, userId, isReady) {
  const room = getRoomOrThrow(rawRoomId);
  const member = room.members[userId];

  if (!member) {
    throw new Error("ROOM_MEMBER_NOT_FOUND");
  }

  if (room.status !== "waiting") {
    throw new Error("ROOM_NOT_JOINABLE");
  }

  member.isReady = !!isReady;
  return room;
}

function canStartRoom(room) {
  const members = Object.values(room.members);

  if (!members.length) {
    return false;
  }

  return members.every((member) => member.isReady);
}

function startRoomMatch(rawRoomId, userId) {
  const room = getRoomOrThrow(rawRoomId);

  if (room.hostUserId !== userId) {
    throw new Error("ROOM_HOST_ONLY");
  }

  if (room.status !== "waiting") {
    throw new Error("ROOM_ALREADY_STARTED");
  }

  if (!canStartRoom(room)) {
    throw new Error("ROOM_NOT_READY");
  }

  room.status = "starting";
  room.gameStartAt = Date.now() + ROOM_START_TRANSITION_MS;
  return room;
}

function updateRoomLifecycle(room, now = Date.now()) {
  if (room.status === "starting" && room.gameStartAt && now >= room.gameStartAt) {
    room.status = "in-game";
  }
}

function deleteRoomIfEmpty(room) {
  if (!room) {
    return;
  }

  if (Object.keys(room.players).length === 0 && Object.keys(room.members).length === 0) {
    delete rooms[room.id];
  }
}

function listRooms() {
  return Object.values(rooms);
}

function serializeRoomSummary(room) {
  return {
    id: room.id,
    label: room.label,
    mapId: room.mapId,
    status: room.status,
    playerCount: Object.keys(room.members).length,
    hostUserId: room.hostUserId,
    maxPlayers: room.maxPlayers,
  };
}

function serializeRoomDetail(room, currentUserId) {
  const members = Object.values(room.members)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      isReady: member.isReady,
      squadId: member.squadId,
      isHost: member.userId === room.hostUserId,
    }));

  return {
    ...serializeRoomSummary(room),
    gameStartAt: room.gameStartAt,
    currentUserId,
    isCurrentUserHost: room.hostUserId === currentUserId,
    canStart: canStartRoom(room),
    members,
  };
}

module.exports = {
  addMemberToRoom,
  ROOM_MAX_PLAYERS,
  ROOM_START_TRANSITION_MS,
  canStartRoom,
  createPublicRoom,
  DEFAULT_ROOM_ID,
  deleteRoomIfEmpty,
  getRoom,
  getOrCreateRoom,
  listRooms,
  removeMemberFromRoom,
  serializeRoomDetail,
  serializeRoomSummary,
  setRoomMemberReady,
  startRoomMatch,
  sanitizeRoomId,
  updateRoomLifecycle,
};
