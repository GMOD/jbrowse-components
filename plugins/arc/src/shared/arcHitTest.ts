import { ARC_HIT_SLOP_PX, bestArcMark } from '@jbrowse/sv-core'

import { arcOnScreen } from './arcLayout.ts'
import { arcDistancePx, segmentDistancePx } from './arcShape.ts'

import type { LaidOutArc } from './arcLayout.ts'

// What the cursor is on, now that the arcs are ink on a canvas rather than
// `<path>` elements with `pointer-events: stroke`.
//
// It takes its geometry from `LaidOutArc`, which is what the painter strokes, so
// it cannot resolve an arc to a curve the reader is not looking at. The ranking
// is `bestArcMark` — `@jbrowse/sv-core`'s, shared with the alignments arc band,
// because "several marks are within tolerance, which one wins" is one rule and
// the two bands' geometry is not.
//
// SVG answered this exactly and for free, and what replaced it is deliberately
// NOT exact: `ARC_HIT_SLOP_PX` widens every target by 3px either side of its own
// stroke, which is what `pointer-events: stroke` never gave a 1px arc.
//
// There is no Y gate here, unlike `hitTestArcBand`'s: the handlers are bound to
// the arc box itself, which is the display's whole height, so a pointer outside
// the band never reaches this at all and the DOM is the gate.

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
    // The SAME cull the painter applies, and it has to be: without it an arc
    // whose ink ends a pixel off the left edge still answers a hover 1px inside
    // it, through the slop. That is a hit on ink nobody can see, in the one
    // place the hit test is allowed no opinion of its own.
    //
    // Then the cheap column rejection, off the extent the cull already needed:
    // it skips the bezier flattening for every arc whose column the cursor is
    // nowhere near, which is nearly all of them on a track carrying thousands.
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

/**
 * Distance to this arc's nearest ink of any kind. The ticks are strokes the
 * reader can see and could hover under SVG, so they answer too — dropping them
 * would make the one mark that says which way a breakend faces the one mark you
 * cannot ask about.
 */
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
