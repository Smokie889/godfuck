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

function hasSameFacing(a, b) {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.x === b.x && a.y === b.y;
}

function buildMovementPatch(previousState, nextState) {
  if (!previousState) {
    return {
      x: nextState.x,
      y: nextState.y,
      lastProcessedInput: nextState.lastProcessedInput,
      moveFacing: nextState.moveFacing,
    };
  }

  const patch = {};

  if (previousState.x !== nextState.x) patch.x = nextState.x;
  if (previousState.y !== nextState.y) patch.y = nextState.y;
  if (previousState.lastProcessedInput !== nextState.lastProcessedInput) {
    patch.lastProcessedInput = nextState.lastProcessedInput;
  }
  if (!hasSameFacing(previousState.moveFacing, nextState.moveFacing)) {
    patch.moveFacing = nextState.moveFacing;
  }

  return patch;
}

function buildCombatPatch(previousState, nextState) {
  if (!previousState) {
    return {
      hp: nextState.hp,
      maxHp: nextState.maxHp,
      isHit: nextState.isHit,
    };
  }

  const patch = {};

  if (previousState.hp !== nextState.hp) patch.hp = nextState.hp;
  if (previousState.maxHp !== nextState.maxHp) patch.maxHp = nextState.maxHp;
  if (previousState.isHit !== nextState.isHit) patch.isHit = nextState.isHit;

  return patch;
}

function serializePlayerPatches(players, now, previousStateSnapshots) {
  const movementPlayers = {};
  const combatPlayers = {};

  for (const id in players) {
    const serializedPlayer = serializePlayer(players[id], now);
    const movementPatch = buildMovementPatch(previousStateSnapshots[id], serializedPlayer);
    const combatPatch = buildCombatPatch(previousStateSnapshots[id], serializedPlayer);

    if (Object.keys(movementPatch).length > 0) {
      movementPlayers[id] = movementPatch;
    }

    if (Object.keys(combatPatch).length > 0) {
      combatPlayers[id] = combatPatch;
    }

    previousStateSnapshots[id] = serializedPlayer;
  }

  for (const id in previousStateSnapshots) {
    if (!players[id]) {
      delete previousStateSnapshots[id];
    }
  }

  return {
    movementPlayers,
    combatPlayers,
  };
}

module.exports = {
  serializePlayer,
  serializePlayers,
  serializePlayerPatches,
};
