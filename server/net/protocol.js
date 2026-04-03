const CLIENT_MESSAGE_TYPES = {
  INPUT: "input",
  ATTACK: "attack",
  CHAT: "chat",
};

const SERVER_MESSAGE_TYPES = {
  INIT: "init",
  STATE: "state",
  PLAYER_JOINED: "playerJoined",
  REMOVE: "remove",
  CHAT: "chat",
};

module.exports = {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
};