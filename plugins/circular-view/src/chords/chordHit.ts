import { polarToCartesian } from '@jbrowse/core/util'

import { chordControlPoint } from './chordGeometry.ts'
import { chordEndsAt, ribbonAnglesAt } from './chordStage.ts'

import type {
  ChordEnds,
  ChordLanes,
  ChordStage,
  RibbonAngles,
  RibbonLanes,
} from './chordStage.ts'

/** How far from a chord's centre line a pointer still reaches it, CSS px. */
export const CHORD_HIT_PX = 3

const CHORD_HIT_SEGMENTS = 64

// A ray from the point toward +x crosses a y-monotone piece from y0 to y1 when
// exactly one end lies at or below the point's y: half-open, so a crossing at a
// joint between two pieces is counted once.
function crosses(y0: number, y1: number, py: number) {
  return y0 <= py !== y1 <= py
}

// The signed crossings of the ray with the arc at `radius` from `from` to `to`,
// split where the arc turns in y.
function arcWinding(
  px: number,
  py: number,
  from: number,
  to: number,
  radius: number,
) {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const cuts = [from]
  const first = Math.ceil((lo - Math.PI / 2) / Math.PI)
  for (let k = first; Math.PI / 2 + k * Math.PI < hi; k++) {
    cuts.push(Math.PI / 2 + k * Math.PI)
  }
  if (to < from) {
    cuts.splice(1, cuts.length - 1, ...cuts.slice(1).reverse())
  }
  cuts.push(to)
  const reach = Math.sqrt(Math.max(0, radius * radius - py * py))
  let winding = 0
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k]!
    const b = cuts[k + 1]!
    const ya = radius * Math.sin(a)
    const yb = radius * Math.sin(b)
    if (crosses(ya, yb, py)) {
      const x = Math.cos((a + b) / 2) < 0 ? -reach : reach
      if (x > px) {
        winding += yb > ya ? 1 : -1
      }
    }
  }
  return winding
}

function quadAt(p0: number, c: number, p1: number, t: number) {
  const s = 1 - t
  return s * s * p0 + 2 * s * t * c + t * t * p1
}

// The signed crossings of the ray with the quadratic from (x0, y0) through
// control (cx, cy) to (x1, y1), split at the parameter where it turns in y.
function quadWinding(
  px: number,
  py: number,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
) {
  const a = y0 - 2 * cy + y1
  const b = 2 * (cy - y0)
  const turn = Math.abs(a) > 1e-12 ? -b / (2 * a) : -1
  const cuts = turn > 0 && turn < 1 ? [0, turn, 1] : [0, 1]
  let winding = 0
  for (let k = 0; k + 1 < cuts.length; k++) {
    const ta = cuts[k]!
    const tb = cuts[k + 1]!
    const ya = quadAt(y0, cy, y1, ta)
    const yb = quadAt(y0, cy, y1, tb)
    if (!crosses(ya, yb, py)) {
      continue
    }
    let t: number
    if (Math.abs(a) <= 1e-12) {
      t = (py - y0) / b
    } else {
      const disc = Math.sqrt(Math.max(0, b * b - 4 * a * (y0 - py)))
      const r1 = (-b - disc) / (2 * a)
      t = r1 >= ta - 1e-9 && r1 <= tb + 1e-9 ? r1 : (-b + disc) / (2 * a)
    }
    t = Math.min(tb, Math.max(ta, t))
    if (quadAt(x0, cx, x1, t) > px) {
      winding += yb > ya ? 1 : -1
    }
  }
  return winding
}

/**
 * Whether a ribbon's fill covers a point, both in CSS px from the circle's
 * centre: the nonzero winding of its boundary, the rule the canvas fills it
 * by, so a twisted ribbon's two lobes both count.
 */
export function ribbonContains(
  px: number,
  py: number,
  { a1, a2, m1, m2 }: RibbonAngles,
  radius: number,
  bezierRadius: number,
) {
  if (px * px + py * py > radius * radius) {
    return false
  }
  const [x1, y1] = polarToCartesian(radius, a2)
  const [x2, y2] = polarToCartesian(radius, m1)
  const [x3, y3] = polarToCartesian(radius, m2)
  const [x4, y4] = polarToCartesian(radius, a1)
  const [c1x, c1y] = chordControlPoint({
    startRadians: a2,
    endRadians: m1,
    radius,
    bezierRadius,
  })
  const [c2x, c2y] = chordControlPoint({
    startRadians: m2,
    endRadians: a1,
    radius,
    bezierRadius,
  })
  const winding =
    arcWinding(px, py, a1, a2, radius) +
    quadWinding(px, py, x1, y1, c1x, c1y, x2, y2) +
    arcWinding(px, py, m1, m2, radius) +
    quadWinding(px, py, x3, y3, c2x, c2y, x4, y4)
  return winding !== 0
}

function segmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t =
    len > 0
      ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len))
      : 0
  const ex = ax + t * dx - px
  const ey = ay + t * dy - py
  return ex * ex + ey * ey
}

/**
 * The squared distance from a point to a chord's curve, both in CSS px from
 * the circle's centre, or Infinity when the curve's hull is farther than
 * `maxDist`.
 */
export function chordDistanceSq(
  px: number,
  py: number,
  { startRadians, endRadians }: ChordEnds,
  radius: number,
  bezierRadius: number,
  maxDist: number,
) {
  const [x0, y0] = polarToCartesian(radius, startRadians)
  const [x1, y1] = polarToCartesian(radius, endRadians)
  const [cx, cy] = chordControlPoint({
    startRadians,
    endRadians,
    radius,
    bezierRadius,
  })
  if (
    px < Math.min(x0, cx, x1) - maxDist ||
    px > Math.max(x0, cx, x1) + maxDist ||
    py < Math.min(y0, cy, y1) - maxDist ||
    py > Math.max(y0, cy, y1) + maxDist
  ) {
    return Infinity
  }
  let best = Infinity
  let ax = x0
  let ay = y0
  for (let k = 1; k <= CHORD_HIT_SEGMENTS; k++) {
    const t = k / CHORD_HIT_SEGMENTS
    const bx = quadAt(x0, cx, x1, t)
    const by = quadAt(y0, cy, y1, t)
    best = Math.min(best, segmentDistSq(px, py, ax, ay, bx, by))
    ax = bx
    ay = by
  }
  return best
}

/** The topmost ribbon covering the point, later instances painting over earlier. */
export function hitRibbon(
  lanes: RibbonLanes,
  stage: ChordStage,
  px: number,
  py: number,
) {
  for (let i = lanes.count - 1; i >= 0; i--) {
    const angles = ribbonAnglesAt(lanes, i, stage)
    if (ribbonContains(px, py, angles, stage.radiusPx, stage.bezierRadiusPx)) {
      return i
    }
  }
  return undefined
}

/** The chord nearest the point within `CHORD_HIT_PX`, the later one on a tie. */
export function hitChord(
  lanes: ChordLanes,
  stage: ChordStage,
  px: number,
  py: number,
) {
  let best: number | undefined
  let bestDistSq = CHORD_HIT_PX * CHORD_HIT_PX
  for (let i = lanes.count - 1; i >= 0; i--) {
    const ends = chordEndsAt(lanes, i, stage)
    if (ends) {
      const d = chordDistanceSq(
        px,
        py,
        ends,
        stage.radiusPx,
        stage.bezierRadiusPx,
        CHORD_HIT_PX,
      )
      if (d < bestDistSq || (best === undefined && d <= bestDistSq)) {
        best = i
        bestDistSq = d
      }
    }
  }
  return best
}
