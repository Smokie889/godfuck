// 把 server 傳來的玩家資料轉成 client 端慣用的物件格式。
// 這裡會順手補上預設值，讓後續渲染與同步 merge 比較安全。
export function copyPlayerState(source) {
  const result = {
    id: source.id,
    userId: source.userId || source.id,
    displayName: source.displayName || source.id,
    x: source.x,
    y: source.y,
    hp: source.hp,
    maxHp: source.maxHp,
    livesRemaining: source.livesRemaining ?? 3,
    maxLives: source.maxLives ?? 3,
    isEliminated: !!source.isEliminated,
    currentWeaponId: source.currentWeaponId || "pistol",
    lastProcessedInput: source.lastProcessedInput || 0,
    isHit: !!source.isHit,
    dashTimeRemaining: source.dashTimeRemaining ?? 0,
    dashCooldownRemaining: source.dashCooldownRemaining ?? 0,
    moveFacing: source.moveFacing
      ? { x: source.moveFacing.x, y: source.moveFacing.y }
      : { x: 0, y: -1 },
    dashFacing: source.dashFacing
      ? { x: source.dashFacing.x, y: source.dashFacing.y }
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

// 通用 merge：如果未來有完整 player patch，可以用這個把局部欄位補回現有狀態。
export function mergePlayerState(currentPlayer, nextState) {
  if (!currentPlayer) {
    return copyPlayerState(nextState);
  }

  const mergedPlayer = {
    ...currentPlayer,
    id: nextState.id || currentPlayer.id,
    userId: nextState.userId ?? currentPlayer.userId ?? currentPlayer.id,
    displayName: nextState.displayName ?? currentPlayer.displayName ?? currentPlayer.id,
    x: nextState.x ?? currentPlayer.x,
    y: nextState.y ?? currentPlayer.y,
    hp: nextState.hp ?? currentPlayer.hp,
    maxHp: nextState.maxHp ?? currentPlayer.maxHp,
    livesRemaining: nextState.livesRemaining ?? currentPlayer.livesRemaining ?? 3,
    maxLives: nextState.maxLives ?? currentPlayer.maxLives ?? 3,
    isEliminated: nextState.isEliminated ?? currentPlayer.isEliminated ?? false,
    currentWeaponId: nextState.currentWeaponId ?? currentPlayer.currentWeaponId ?? "pistol",
    lastProcessedInput: nextState.lastProcessedInput ?? currentPlayer.lastProcessedInput ?? 0,
    isHit: nextState.isHit ?? currentPlayer.isHit ?? false,
    dashTimeRemaining: nextState.dashTimeRemaining ?? currentPlayer.dashTimeRemaining ?? 0,
    dashCooldownRemaining:
      nextState.dashCooldownRemaining ?? currentPlayer.dashCooldownRemaining ?? 0,
    moveFacing: nextState.moveFacing
      ? { x: nextState.moveFacing.x, y: nextState.moveFacing.y }
      : currentPlayer.moveFacing,
    dashFacing: nextState.dashFacing
      ? { x: nextState.dashFacing.x, y: nextState.dashFacing.y }
      : currentPlayer.dashFacing,
    appearance: nextState.appearance
      ? { chatBubbleStyle: nextState.appearance.chatBubbleStyle }
      : currentPlayer.appearance,
    aimFacing: nextState.aimFacing
      ? { x: nextState.aimFacing.x, y: nextState.aimFacing.y }
      : currentPlayer.aimFacing,
  };

  return mergedPlayer;
}

// 專門處理移動同步的 merge，只更新位置、ack 與移動方向。
export function mergeMovementState(currentPlayer, nextState) {
  if (!currentPlayer) {
    return copyPlayerState(nextState);
  }

  return {
    ...currentPlayer,
    id: nextState.id || currentPlayer.id,
    userId: nextState.userId ?? currentPlayer.userId ?? currentPlayer.id,
    displayName: nextState.displayName ?? currentPlayer.displayName ?? currentPlayer.id,
    currentWeaponId: nextState.currentWeaponId ?? currentPlayer.currentWeaponId ?? "pistol",
    x: nextState.x ?? currentPlayer.x,
    y: nextState.y ?? currentPlayer.y,
    lastProcessedInput: nextState.lastProcessedInput ?? currentPlayer.lastProcessedInput ?? 0,
    dashTimeRemaining: nextState.dashTimeRemaining ?? currentPlayer.dashTimeRemaining ?? 0,
    dashCooldownRemaining:
      nextState.dashCooldownRemaining ?? currentPlayer.dashCooldownRemaining ?? 0,
    moveFacing: nextState.moveFacing
      ? { x: nextState.moveFacing.x, y: nextState.moveFacing.y }
      : currentPlayer.moveFacing,
    dashFacing: nextState.dashFacing
      ? { x: nextState.dashFacing.x, y: nextState.dashFacing.y }
      : currentPlayer.dashFacing,
  };
}

// 專門處理戰鬥同步的 merge，只更新血量與受擊狀態。
export function mergeCombatState(currentPlayer, nextState) {
  if (!currentPlayer) {
    return copyPlayerState(nextState);
  }

  return {
    ...currentPlayer,
    id: nextState.id || currentPlayer.id,
    userId: nextState.userId ?? currentPlayer.userId ?? currentPlayer.id,
    displayName: nextState.displayName ?? currentPlayer.displayName ?? currentPlayer.id,
    currentWeaponId: nextState.currentWeaponId ?? currentPlayer.currentWeaponId ?? "pistol",
    hp: nextState.hp ?? currentPlayer.hp,
    maxHp: nextState.maxHp ?? currentPlayer.maxHp,
    livesRemaining: nextState.livesRemaining ?? currentPlayer.livesRemaining ?? 3,
    maxLives: nextState.maxLives ?? currentPlayer.maxLives ?? 3,
    isEliminated: nextState.isEliminated ?? currentPlayer.isEliminated ?? false,
    isHit: nextState.isHit ?? currentPlayer.isHit ?? false,
  };
}
