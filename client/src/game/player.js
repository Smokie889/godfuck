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

  if (source.aimFacing) {
    result.aimFacing = {
      x: source.aimFacing.x,
      y: source.aimFacing.y,
    };
  }

  return result;
}
