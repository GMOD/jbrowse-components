import { arcApexY } from './arcShape.ts'

import type { ArcShape } from './arcShape.ts'
import type { Feature } from '@jbrowse/core/util'

// One arc, placed. Both displays resolve their own features into this — the
// single-feature one spans a feature's own start↔end and carries a label, the
// paired one joins two independent breakends and carries their direction ticks —
// and everything downstream of it is shared: the Canvas2D stroke, the SVG
// export's `<path>`, and the hit test.
//
// Screen px, viewport-relative, with `view.offsetPx` already subtracted. That is
// the whole reason this type exists: projecting an arc reads `bpToPx` and
// `offsetPx`, and doing it per arc inside a React component meant a MobX
// reaction per arc per frame of every zoom and pan. The projection is one model
// computed now, and the components read a plain array.

/** A mate-direction tick: a short horizontal mark lying over one foot's arm. */
export interface ArcTick {
  x1: number
  x2: number
  y: number
}

export interface LaidOutArc {
  feature: Feature
  /** Stable per arc, so the export's element list keys off it. */
  key: string
  shape: ArcShape
  /** The resting stroke; hover and selection are resolved by the painter. */
  color: string
  strokeWidth: number
  /**
   * The arc's whole horizontal ink extent, ticks and stroke width included —
   * both the off-screen cull and the hit test's column prefilter, which are the
   * same question asked at two tolerances.
   */
  xMin: number
  xMax: number
  selected: boolean
  ticks?: readonly ArcTick[]
  label?: string
  /** Hover text, resolved with the styles rather than per frame. */
  caption?: string
}

/**
 * How far the ink reaches either side. A semicircle and a bezier are both
 * contained between their own two feet — the bezier's control points share its
 * feet's x — so only the stroke and the ticks reach past them.
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
 * Whether any of this arc's ink lands in the viewport.
 *
 * Compared on the extent rather than on `left`/`right` as given: a reversed
 * displayed region puts `left` past `right`, and culling on the raw pair dropped
 * arcs that were on screen.
 */
export function arcOnScreen(arc: LaidOutArc, viewWidth: number) {
  return arc.xMax >= 0 && arc.xMin <= viewWidth
}

/** The deepest y this arc's ink reaches — what a label sits on. */
export function arcLabelY(arc: LaidOutArc) {
  return arcApexY(arc.shape)
}
