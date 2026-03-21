import type { NodeSegment } from '../types.ts'

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

export interface BezierCurve {
  x0: number
  y0: number
  cx0: number
  cy0: number
  cx1: number
  cy1: number
  x1: number
  y1: number
}

export function computeEdgeCurves(
  fromSegments: NodeSegment[],
  toSegments: NodeSegment[],
  isSelfLoop: boolean,
  scale: number,
  offsetX: number,
  offsetY: number,
): BezierCurve[] {
  const fromEnd = fromSegments[fromSegments.length - 1]!
  const toStart = toSegments[0]!

  const p1x = fromEnd.x + offsetX
  const p1y = fromEnd.y + offsetY
  const p2x = toStart.x + offsetX
  const p2y = toStart.y + offsetY

  if (isSelfLoop) {
    let segDirX = 1
    let segDirY = 0
    if (fromSegments.length >= 2) {
      const prev = fromSegments[fromSegments.length - 2]!
      const last = fromSegments[fromSegments.length - 1]!
      const dx = last.x - prev.x
      const dy = last.y - prev.y
      const len = Math.hypot(dx, dy)
      if (len > 0) {
        segDirX = dx / len
        segDirY = dy / len
      }
    }

    const ext = 50 / Math.pow(scale, 0.7)
    const perpX = -segDirY
    const perpY = segDirX
    const midX = (fromEnd.x + toStart.x) / 2 + offsetX + perpX * ext
    const midY = (fromEnd.y + toStart.y) / 2 + offsetY + perpY * ext
    const cp1x = p1x + segDirX * ext
    const cp1y = p1y + segDirY * ext
    const cp2x = p2x - segDirX * ext
    const cp2y = p2y - segDirY * ext

    return [
      {
        x0: p1x, y0: p1y,
        cx0: cp1x, cy0: cp1y,
        cx1: cp1x + perpX * ext, cy1: cp1y + perpY * ext,
        x1: midX, y1: midY,
      },
      {
        x0: midX, y0: midY,
        cx0: cp2x + perpX * ext, cy0: cp2y + perpY * ext,
        cx1: cp2x, cy1: cp2y,
        x1: p2x, y1: p2y,
      },
    ]
  } else {
    const fromPrev =
      fromSegments.length >= 2
        ? fromSegments[fromSegments.length - 2]!
        : { x: fromEnd.x - (toStart.x - fromEnd.x), y: fromEnd.y - (toStart.y - fromEnd.y) }
    const toNext =
      toSegments.length >= 2
        ? toSegments[1]!
        : { x: toStart.x - (fromEnd.x - toStart.x), y: toStart.y - (fromEnd.y - toStart.y) }

    const dist = Math.hypot(p2x - p1x, p2y - p1y)
    const projDist = Math.min(dist * 0.5, 80 / scale)
    const [cx1, cy1] = projectLine(fromPrev.x, fromPrev.y, fromEnd.x, fromEnd.y, projDist)
    const [cx2, cy2] = projectLine(toNext.x, toNext.y, toStart.x, toStart.y, projDist)

    return [
      {
        x0: p1x, y0: p1y,
        cx0: cx1 + offsetX, cy0: cy1 + offsetY,
        cx1: cx2 + offsetX, cy1: cy2 + offsetY,
        x1: p2x, y1: p2y,
      },
    ]
  }
}
