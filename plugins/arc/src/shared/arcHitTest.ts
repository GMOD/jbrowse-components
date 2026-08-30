import { ARC_HIT_SLOP_PX, bestArcMark } from '@jbrowse/sv-core'

import { arcOnScreen } from './arcLayout.ts'
import { arcDistancePx, segmentDistancePx } from './arcShape.ts'

import type { LaidOutArc } from './arcLayout.ts'

// What the cursor is on, standing in for the `pointer-events: stroke` the arcs
// had as `<path>` elements. There is no Y gate, unlike `hitTestArcBand`'s: the
// handlers bind to the arc box itself, so the DOM is the gate.

/**
 * The arc under `(x, y)`, in the container's own coordinates, or nothing.
 *
 * `arcs` arrives in paint order and the scan runs ascending, so an on-ink tie
 * goes to the arc painted on top — see `bestArcMark`.
 */
export function hitTestArcs(
  x: number,
  y: number,
  arcs: readonly LaidOutArc[],
  viewWidth: number,
): LaidOutArc | undefined {
  const picker = bestArcMark()
  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i]!
    // The painter's own cull, then a column reject. Without the cull an arc
    // whose ink ends off the left edge still answers a hover just inside it
    // through the slop — a tooltip for ink nobody can see. The column reject
    // skips the bezier flattening for arcs the cursor is nowhere near.
    if (
      !arcOnScreen(arc, viewWidth) ||
      x < arc.xMin - ARC_HIT_SLOP_PX ||
      x > arc.xMax + ARC_HIT_SLOP_PX
    ) {
      continue
    }
    picker.consider(i, arcInkDistancePx(arc, x, y) - arc.strokeWidth / 2)
  }
  return picker.best(i => arcs[i]!)?.hit
}

// The ticks answer too: they are strokes the reader can see, and a breakend's
// direction mark is the one thing on screen whose meaning is least guessable.
function arcInkDistancePx(arc: LaidOutArc, x: number, y: number) {
  let best = arcDistancePx(arc.shape, x, y)
  for (const t of arc.ticks ?? []) {
    const d = segmentDistancePx(t.x1, t.y, t.x2, t.y, x, y)
    if (d < best) {
      best = d
    }
  }
  return best
}
