const CLIENT_MESSAGE_TYPES = {
  INPUT: "input",
  DASH: "dash",
  AIM: "aim",
  SHOOT: "shoot",
  PICKUP_WEAPON: "pickupWeapon",
  DROP_WEAPON: "dropWeapon",
  CHAT: "chat",
  PING: "ping",
};

const SERVER_MESSAGE_TYPES = {
  INIT: "init",
  ROOM_LOBBY_SYNC: "roomLobbySync",
  ROOM_CLOSED: "roomClosed",
  MOVEMENT_PATCH: "movementPatch",
  COMBAT_PATCH: "combatPatch",
  AIM: "aim",
  BULLET_SPAWN: "bulletSpawn",
  BULLET_REMOVE: "bulletRemove",
  WEAPON_DROP_SPAWN: "weaponDropSpawn",
  WEAPON_DROP_REMOVE: "weaponDropRemove",
  CHAT: "chat",
  HIT: "hit",
  PLAYER_JOINED: "playerJoined",
  REMOVE: "remove",
  PONG: "pong",
  MATCH_OVER: "matchOver",
};

module.exports = {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
};
