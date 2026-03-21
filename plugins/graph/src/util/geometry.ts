export function projectLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  distance: number,
): [number, number] {
  const d = Math.hypot(y2 - y1, x2 - x1)
  if (d === 0) {
    return [x2, y2]
  }
  const vx = (x2 - x1) / d
  const vy = (y2 - y1) / d
  return [x2 + distance * vx, y2 + distance * vy]
}
