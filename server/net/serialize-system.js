// 把 server 內部玩家狀態轉成可傳輸的純資料物件。
// 這裡會決定 client 能看見哪些欄位。
function serializePlayer(player, now, options = {}) {
  const payload = {
    id: player.id,
    userId: player.userId || player.id,
    displayName: player.displayName || player.id,
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
    livesRemaining: player.livesRemaining,
    maxLives: player.maxLives,
    isEliminated: !!player.isEliminated,
    currentWeaponId: player.currentWeaponId,
    isHit: now < player.hitFlashUntil,
    dashTimeRemaining: player.dashTimeRemaining,
    dashCooldownRemaining: player.dashCooldownRemaining,
    dashFacing: {
      x: player.dashFacing.x,
      y: player.dashFacing.y,
    },
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

// 用來比較方向向量是否真的改變，避免不必要地重送 moveFacing。
function hasSameFacing(a, b) {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.x === b.x && a.y === b.y;
}

// movement patch 只承擔高頻且和移動預測相關的欄位。
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
  if (previousState.dashTimeRemaining !== nextState.dashTimeRemaining) {
    patch.dashTimeRemaining = nextState.dashTimeRemaining;
  }
  if (previousState.dashCooldownRemaining !== nextState.dashCooldownRemaining) {
    patch.dashCooldownRemaining = nextState.dashCooldownRemaining;
  }
  if (!hasSameFacing(previousState.dashFacing, nextState.dashFacing)) {
    patch.dashFacing = nextState.dashFacing;
  }

  return patch;
}

// combat patch 只承擔戰鬥結果，避免血量等欄位混進高頻移動同步。
function buildCombatPatch(previousState, nextState) {
  if (!previousState) {
    return {
      hp: nextState.hp,
      maxHp: nextState.maxHp,
      livesRemaining: nextState.livesRemaining,
      maxLives: nextState.maxLives,
      isEliminated: nextState.isEliminated,
      isHit: nextState.isHit,
    };
  }

  const patch = {};

  if (previousState.hp !== nextState.hp) patch.hp = nextState.hp;
  if (previousState.maxHp !== nextState.maxHp) patch.maxHp = nextState.maxHp;
  if (previousState.livesRemaining !== nextState.livesRemaining) {
    patch.livesRemaining = nextState.livesRemaining;
  }
  if (previousState.maxLives !== nextState.maxLives) patch.maxLives = nextState.maxLives;
  if (previousState.isEliminated !== nextState.isEliminated) {
    patch.isEliminated = nextState.isEliminated;
  }
  if (previousState.currentWeaponId !== nextState.currentWeaponId) {
    patch.currentWeaponId = nextState.currentWeaponId;
  }
  if (previousState.isHit !== nextState.isHit) patch.isHit = nextState.isHit;

  return patch;
}

// 依據上一個快照，為每個玩家產生欄位級 delta patch。
// 最終會拆成兩條訊息：movementPlayers / combatPlayers。
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
