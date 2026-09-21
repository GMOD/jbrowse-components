import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * The anchor-axis window a0..a1 an exact resolve was measured over and the span
 * b0..b1 it answered, applied per frame so the row moves between resolves.
 */
export interface FollowTransform {
  refName: string
  a0: number
  a1: number
  targetRefName: string
  b0: number
  b1: number
}

export function followTransform(
  window: FollowWindow,
  span: ResolvedSpan,
  // a resolved span is always min..max, so the direction cannot be read off it
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
  // clamped before the ordering test, so a wholly negative extrapolation is no
  // answer rather than an inverted span
  const lo = Math.max(0, Math.min(p, q))
  const hi = Math.max(p, q)
  return hi > lo
    ? {
        refName: t.targetRefName,
        start: lo,
        end: hi,
      }
    : undefined
}
