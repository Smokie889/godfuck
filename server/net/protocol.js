const CLIENT_MESSAGE_TYPES = {
  INPUT: "input",
  ATTACK: "attack",
  CHAT: "chat",
};

const SERVER_MESSAGE_TYPES = {
  WELCOME: "welcome",
  STATE: "state",
  CHAT: "chat",
  PLAYER_JOINED: "player_joined",
  PLAYER_LEFT: "player_left",
};

module.exports = {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
};