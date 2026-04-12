export function copyPlayerState(source) {
  const result = {
    id: source.id,
    x: source.x,
    y: source.y,
    hp: source.hp,
    maxHp: source.maxHp,
    lastProcessedInput: source.lastProcessedInput || 0,
    isHit: !!source.isHit,
    moveFacing: source.moveFacing
      ? { x: source.moveFacing.x, y: source.moveFacing.y }
      : { x: 0, y: -1 },
  };

  if (source.appearance) {
    result.appearance = {
      chatBubbleStyle: source.appearance.chatBubbleStyle,
    };
  }

  if (source.aimFacing) {
    result.aimFacing = {
      x: source.aimFacing.x,
      y: source.aimFacing.y,
    };
  }

  return result;
}

export function mergePlayerState(currentPlayer, nextState) {
  if (!currentPlayer) {
    return copyPlayerState(nextState);
  }

  const mergedPlayer = {
    ...currentPlayer,
    id: nextState.id || currentPlayer.id,
    x: nextState.x ?? currentPlayer.x,
    y: nextState.y ?? currentPlayer.y,
    hp: nextState.hp ?? currentPlayer.hp,
    maxHp: nextState.maxHp ?? currentPlayer.maxHp,
    lastProcessedInput: nextState.lastProcessedInput ?? currentPlayer.lastProcessedInput ?? 0,
    isHit: nextState.isHit ?? currentPlayer.isHit ?? false,
    moveFacing: nextState.moveFacing
      ? { x: nextState.moveFacing.x, y: nextState.moveFacing.y }
      : currentPlayer.moveFacing,
    appearance: nextState.appearance
      ? { chatBubbleStyle: nextState.appearance.chatBubbleStyle }
      : currentPlayer.appearance,
    aimFacing: nextState.aimFacing
      ? { x: nextState.aimFacing.x, y: nextState.aimFacing.y }
      : currentPlayer.aimFacing,
  };

  return mergedPlayer;
}

export function mergeMovementState(currentPlayer, nextState) {
  if (!currentPlayer) {
    return copyPlayerState(nextState);
  }

  return {
    ...currentPlayer,
    id: nextState.id || currentPlayer.id,
    x: nextState.x ?? currentPlayer.x,
    y: nextState.y ?? currentPlayer.y,
    lastProcessedInput: nextState.lastProcessedInput ?? currentPlayer.lastProcessedInput ?? 0,
    moveFacing: nextState.moveFacing
      ? { x: nextState.moveFacing.x, y: nextState.moveFacing.y }
      : currentPlayer.moveFacing,
  };
}

export function mergeCombatState(currentPlayer, nextState) {
  if (!currentPlayer) {
    return copyPlayerState(nextState);
  }

  return {
    ...currentPlayer,
    id: nextState.id || currentPlayer.id,
    hp: nextState.hp ?? currentPlayer.hp,
    maxHp: nextState.maxHp ?? currentPlayer.maxHp,
    isHit: nextState.isHit ?? currentPlayer.isHit ?? false,
  };
}
