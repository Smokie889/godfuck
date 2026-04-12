const { handleShoot } = require("../systems/bullet-system");
const { createChatMessage } = require("../systems/chat-system");
const { tryStartDash } = require("../systems/movement-system");
const { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } = require("./protocol");

function handleInputPacket(player, data) {
  player.inputState = {
    up: !!data.up,
    down: !!data.down,
    left: !!data.left,
    right: !!data.right,
  };

  player.lastProcessedInput = data.seq || 0;

  if (data.dash) {
    tryStartDash(player, player.inputState);
  }
}

function handleAimPacket(player, data) {
  const x = Number(data.x);
  const y = Number(data.y);
  const length = Math.hypot(x, y);

  if (!Number.isFinite(x) || !Number.isFinite(y) || length === 0) {
    return;
  }

  player.aimFacing.x = x / length;
  player.aimFacing.y = y / length;
}

function handleChatPacket({ player, data, wss, broadcast }) {
  const chatMessage = createChatMessage(player, data.text);
  if (!chatMessage) return;

  broadcast(wss, {
    type: SERVER_MESSAGE_TYPES.CHAT,
    ...chatMessage,
  });
}

function handlePacket({ message, playerId, players, bullets, ws, wss, broadcast }) {
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

    case CLIENT_MESSAGE_TYPES.DASH:
      tryStartDash(player, player.inputState);
      return;

    case CLIENT_MESSAGE_TYPES.AIM:
      handleAimPacket(player, data);
      broadcast(wss, {
        type: SERVER_MESSAGE_TYPES.AIM,
        playerId,
        x: player.aimFacing.x,
        y: player.aimFacing.y,
      });
      return;

    case CLIENT_MESSAGE_TYPES.SHOOT:
      handleShoot({ players, bullets, playerId, data, wss, broadcast });
      return;

    case CLIENT_MESSAGE_TYPES.CHAT:
      handleChatPacket({
        player,
        data,
        wss,
        broadcast,
      });
      return;

    case CLIENT_MESSAGE_TYPES.PING:
      ws.send(
        JSON.stringify({
          type: SERVER_MESSAGE_TYPES.PONG,
          id: data.id,
        })
      );
      return;

    default:
      return;
  }
}

module.exports = {
  handlePacket,
};
