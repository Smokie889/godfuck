const CLIENT_MESSAGE_TYPES = {
  INPUT: "input",
  AIM: "aim",
  SHOOT: "shoot",
  CHAT: "chat",
};

const SERVER_MESSAGE_TYPES = {
  INIT: "init",
  STATE: "state",
  AIM: "aim",
  BULLET_SPAWN: "bulletSpawn",
  BULLET_REMOVE: "bulletRemove",
  CHAT: "chat",
  HIT: "hit",
  PLAYER_JOINED: "playerJoined",
  REMOVE: "remove",
};

module.exports = {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
};
