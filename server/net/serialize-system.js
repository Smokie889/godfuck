function serializePlayer(player, now, options = {}) {
  const payload = {
    id: player.id,
    x: player.x,
    y: player.y,
    lastProcessedInput: player.lastProcessedInput,
    moveFacing: {
      x: player.moveFacing.x,
      y: player.moveFacing.y,
    },
    appearance: {
      chatBubbleStyle: player.appearance?.chatBubbleStyle || "default",
    },
    hp: player.hp,
    maxHp: player.maxHp,
    isHit: now < player.hitFlashUntil,
  };

  if (options.includeAimFacing) {
    payload.aimFacing = {
      x: player.aimFacing.x,
      y: player.aimFacing.y,
    };
  }

  return payload;
}

function serializePlayers(players, now, options = {}) {
  const result = {};

  for (const id in players) {
    result[id] = serializePlayer(players[id], now, options);
  }

  return result;
}

module.exports = {
  serializePlayer,
  serializePlayers,
};
