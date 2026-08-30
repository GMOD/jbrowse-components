import { arcApexY } from './arcShape.ts'

import type { ArcShape } from './arcShape.ts'
import type { Feature } from '@jbrowse/core/util'

// One arc, placed — screen px with `view.offsetPx` already subtracted. Both
// displays resolve their features into this and everything downstream of it is
// shared: the canvas stroke, the export's `<path>`, and the hit test.

/** A mate-direction tick: a short horizontal mark lying over one foot's arm. */
export interface ArcTick {
  x1: number
  x2: number
  y: number
}

export interface LaidOutArc {
  feature: Feature
  key: string
  shape: ArcShape
  /** The resting stroke; hover and selection are resolved by the painter. */
  color: string
  strokeWidth: number
  /**
   * The arc's whole horizontal ink extent, ticks and stroke width included —
   * both the off-screen cull and the hit test's column prefilter.
   */
  xMin: number
  xMax: number
  selected: boolean
  ticks?: readonly ArcTick[]
  label?: string
  caption?: string
}

/**
 * How far the ink reaches either side. Both shapes are contained between their
 * own two feet — the bezier's control points share its feet's x — so only the
 * stroke and the ticks reach past them.
 */
export function arcExtent(
  shape: ArcShape,
  strokeWidth: number,
  ticks?: readonly ArcTick[],
) {
  const half = strokeWidth / 2
  let xMin = Math.min(shape.left, shape.right) - half
  let xMax = Math.max(shape.left, shape.right) + half
  for (const t of ticks ?? []) {
    xMin = Math.min(xMin, t.x1 - half, t.x2 - half)
    xMax = Math.max(xMax, t.x1 + half, t.x2 + half)
  }
  return { xMin, xMax }
}

/**
 * Whether any of this arc's ink lands in the viewport. On the extent rather than
 * on `left`/`right` as given: a reversed region puts `left` past `right`, and
 * culling on the raw pair dropped arcs that were on screen.
 */
export function arcOnScreen(arc: LaidOutArc, viewWidth: number) {
  return arc.xMax >= 0 && arc.xMin <= viewWidth
}

const LABEL_BASELINE_OFFSET_PX = 3

/**
 * Baseline y for this arc's label. One number, because the canvas painter and
 * the export's `<text>` both place it and a nudge to one is invisible until
 * someone compares a figure against the screen.
 */
export function arcLabelBaselineY(arc: LaidOutArc) {
  return arcApexY(arc.shape) + LABEL_BASELINE_OFFSET_PX
}
