import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * The local correspondence between the two rows, cached from the last exact
 * resolve so the followed row can be placed WITHOUT one.
 *
 * Between resolves the correspondence is very nearly affine — synteny is
 * locally collinear, and one alignment block is exactly affine outside its
 * indels — so applying the last one per frame places the row well enough to
 * move continuously, and the next resolve corrects the accumulated error rather
 * than supplying all of the motion.
 */
export interface FollowTransform {
  // the anchor-axis window this was measured over
  refName: string
  a0: number
  a1: number
  // and the span it resolved to
  targetRefName: string
  b0: number
  b1: number
}

export function followTransform(
  window: FollowWindow,
  span: ResolvedSpan,
  // reverse-strand correspondences run the other way, and the resolved span is
  // always min..max, so the direction has to be carried in rather than inferred
  flipped: boolean,
): FollowTransform | undefined {
  return window.end > window.start && span.end > span.start
    ? {
        refName: window.refName,
        a0: window.start,
        a1: window.end,
        targetRefName: span.refName,
        b0: flipped ? span.end : span.start,
        b1: flipped ? span.start : span.end,
      }
    : undefined
}

/**
 * Where the followed row goes for an anchor window, under a cached transform.
 *
 * `undefined` when the anchor has moved onto a different contig, where the
 * transform says nothing and the next exact resolve has to answer instead.
 */
export function applyFollowTransform(
  t: FollowTransform,
  window: FollowWindow,
): ResolvedSpan | undefined {
  if (t.refName !== window.refName) {
    return undefined
  }
  const at = (x: number) => t.b0 + ((x - t.a0) / (t.a1 - t.a0)) * (t.b1 - t.b0)
  const p = at(window.start)
  const q = at(window.end)
  const lo = Math.min(p, q)
  const hi = Math.max(p, q)
  return hi > lo
    ? {
        refName: t.targetRefName,
        start: Math.max(0, lo),
        end: hi,
      }
    : undefined
}
