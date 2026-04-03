const { handleAttack } = require("../systems/combat-system");
const { createChatMessage } = require("../systems/chat-system");
const { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } = require("./protocol");

function handleInputPacket(player, data) {
  player.inputState = {
    up: !!data.up,
    down: !!data.down,
    left: !!data.left,
    right: !!data.right,
  };

  player.lastProcessedInput = data.seq || 0;
}

function handleAttackPacket(players, playerId) {
  handleAttack(players, playerId);
}

function handleChatPacket({ player, data, wss, broadcast }) {
  const chatMessage = createChatMessage(player, data.text);
  if (!chatMessage) return;

  broadcast(wss, {
    type: SERVER_MESSAGE_TYPES.CHAT,
    ...chatMessage,
  });
}

function handlePacket({ message, playerId, players, ws, wss, broadcast }) {
  let data;

  try {
    data = JSON.parse(message);
  } catch {
    return;
  }

  const player = players[playerId];
  if (!player) return;

  switch (data.type) {
    case CLIENT_MESSAGE_TYPES.INPUT:
      handleInputPacket(player, data);
      return;

    case CLIENT_MESSAGE_TYPES.ATTACK:
      handleAttackPacket(players, playerId);
      return;

    case CLIENT_MESSAGE_TYPES.CHAT:
      handleChatPacket({
        player,
        data,
        wss,
        broadcast,
      });
      return;

    default:
      return;
  }
}

module.exports = {
  handlePacket,
};