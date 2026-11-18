import type { InkRect, MarkHit, MarkShape } from './types.ts'

/** One instance's ink measured against a cursor — a `MarkHit` before it is one. */
export type InkHit = Omit<MarkHit, 'index'>

/**
 * Where a rect's ink sits nearest `(xPx, yPx)`, and how far: the point itself
 * where the cursor is inside, else the nearest point on the edge.
 */
export function inkOnRect(
  xPx: number,
  yPx: number,
  left: number,
  top: number,
  width: number,
  height: number,
): InkHit {
  const x = Math.min(Math.max(xPx, left), left + width)
  const y = Math.min(Math.max(yPx, top), top + height)
  const dx = xPx - x
  const dy = yPx - y
  return { x, y, distSq: dx * dx + dy * dy }
}

/** The same for a mark with no extent to clamp into. */
export function inkAtPoint(
  xPx: number,
  yPx: number,
  x: number,
  y: number,
): InkHit {
  const dx = xPx - x
  const dy = yPx - y
  return { x, y, distSq: dx * dx + dy * dy }
}

/**
 * The nearest point to `(px, py)` on the segment from `(ax, ay)` to `(bx, by)`,
 * written into `best` where it is nearer than what `best` holds.
 */
export function nearSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
  best: InkHit,
) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const t =
    lenSq > 0
      ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lenSq))
      : 0
  const x = ax + t * dx
  const y = ay + t * dy
  const distSq = (px - x) ** 2 + (py - y) ** 2
  if (distSq < best.distSq) {
    best.x = x
    best.y = y
    best.distSq = distSq
  }
}

/** Whether `(xPx, yPx)` lies within `reach` of `box`, its edges included. */
export function reachesBox(
  box: InkRect,
  xPx: number,
  yPx: number,
  reach: number,
) {
  return (
    xPx >= box.left - reach &&
    xPx <= box.left + box.width + reach &&
    yPx >= box.top - reach &&
    yPx <= box.top + box.height + reach
  )
}

/**
 * The ink of a stroke `widthPx` wide nearest `(xPx, yPx)`, given the point
 * `(x, y)` of its centreline nearest the cursor, `dist` away: the cursor
 * itself inside the stroke, else that point moved half the width toward it.
 */
export function inkOnStroke(
  xPx: number,
  yPx: number,
  x: number,
  y: number,
  dist: number,
  widthPx: number,
): InkHit {
  const half = widthPx / 2
  if (dist <= half) {
    return { x: xPx, y: yPx, distSq: 0 }
  } else {
    const t = half / dist
    const edgeX = x + (xPx - x) * t
    const edgeY = y + (yPx - y) * t
    return {
      x: edgeX,
      y: edgeY,
      distSq: (xPx - edgeX) ** 2 + (yPx - edgeY) ** 2,
    }
  }
}

/**
 * The nearest of `candidates` by where each one's ink is, or undefined when
 * none beats `maxDistSq`.
 *
 * This is the whole of every shape's `hitNearest` but the geometry: `inkAt`
 * answers where instance `i` put ink and how far that is, and this keeps the
 * closest. Only a STRICTLY nearer candidate replaces the best, so on a tie the
 * first wins, so a caller that iterates back to front gets the mark on top.
 * Five shapes used to spell that rule out separately.
 *
 * `inkAt` may answer `undefined` for an instance that drew nothing at all, as
 * against one that drew somewhere far away: a bar clipped out of its band has
 * no ink to be near.
 */
export function nearestInk(
  candidates: Iterable<number>,
  maxDistSq: number,
  inkAt: (index: number) => InkHit | undefined,
): MarkHit | undefined {
  let best: MarkHit | undefined
  let bestDistSq = maxDistSq
  for (const index of candidates) {
    const ink = inkAt(index)
    if (ink && ink.distSq < bestDistSq) {
      bestDistSq = ink.distSq
      // Field by field, not `{ index, ...ink }`, which is both slower and one
      // shape away from minting a hidden class per ink source and making every
      // downstream `hit.x` read polymorphic.
      best = { index, x: ink.x, y: ink.y, distSq: ink.distSq }
    }
  }
  return best
}

/**
 * The hit test a shape's `ink` implies: the nearest of its boxes, edges
 * included, so a point inside one answers it at distance 0.
 */
export function inkHitNearest<C, P>(
  ink: NonNullable<MarkShape<C, P>['ink']>,
): NonNullable<MarkShape<C, P>['hitNearest']> {
  return (channels, block, frame, params, xPx, yPx, candidates, maxDistSq) =>
    nearestInk(candidates, maxDistSq, i => {
      const r = ink(channels, block, frame, params, i)
      return r && inkOnRect(xPx, yPx, r.left, r.top, r.width, r.height)
    })
}

/** A shape's own `hitNearest`, else the one its `ink` implies, else none. */
export function shapeHitNearest<C, P>(
  shape: MarkShape<C, P>,
): MarkShape<C, P>['hitNearest'] {
  return (
    shape.hitNearest ??
    (shape.ink ? inkHitNearest<C, P>(shape.ink.bind(shape)) : undefined)
  )
}
