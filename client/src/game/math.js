export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function normalize(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}
