import type { MarkHit } from './types.ts'

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
 * The nearest of `candidates` by where each one's ink is, or undefined when
 * none beats `maxDistSq`.
 *
 * This is the whole of every shape's `hitNearest` but the geometry: `inkAt`
 * answers where instance `i` put ink and how far that is, and this keeps the
 * closest. Only a STRICTLY nearer candidate replaces the best, so on a tie the
 * first wins — which is what makes a caller that iterates back to front get the
 * mark on top, and it is a rule that used to be spelled out five times over.
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
