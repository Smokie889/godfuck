const { serializeCombatState } = require("../systems/combat-system");

function serializePlayer(player, now) {
  return {
    id: player.id,
    x: player.x,
    y: player.y,
    lastProcessedInput: player.lastProcessedInput,
    facing: {
      x: player.facing.x,
      y: player.facing.y,
    },
    appearance: {
      chatBubbleStyle: player.appearance?.chatBubbleStyle || "default",
    },
    ...serializeCombatState(player, now),
  };
}

function serializePlayers(players, now) {
  const result = {};

  for (const id in players) {
    result[id] = serializePlayer(players[id], now);
  }

  return result;
}

module.exports = {
  serializePlayer,
  serializePlayers,
};