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
// split where the arc turns in y: `reach` is where the ray's row meets the
// circle, and `yFrom` and `yTo` are the arc's ends' heights.
function arcWinding(
  px: number,
  py: number,
  from: number,
  to: number,
  radius: number,
  reach: number,
  yFrom: number,
  yTo: number,
) {
  const first = Math.ceil((Math.min(from, to) - Math.PI / 2) / Math.PI)
  let turns = 0
  while (Math.PI / 2 + (first + turns) * Math.PI < Math.max(from, to)) {
    turns++
  }
  let winding = 0
  let a = from
  let ya = yFrom
  for (let n = 0; n <= turns; n++) {
    const last = n === turns
    const b = last
      ? to
      : Math.PI / 2 + (to < from ? first + turns - 1 - n : first + n) * Math.PI
    const yb = last ? yTo : radius * Math.sin(b)
    if (crosses(ya, yb, py)) {
      const x = Math.cos((a + b) / 2) < 0 ? -reach : reach
      if (x > px) {
        winding += yb > ya ? 1 : -1
      }
    }
    a = b
    ya = yb
  }
  return winding
}

function quadAt(p0: number, c: number, p1: number, t: number) {
  const s = 1 - t
  return s * s * p0 + 2 * s * t * c + t * t * p1
}

// The signed crossing of the ray with the y-monotone piece `ta`..`tb` of the
// quadratic, whose y is `a t^2 + b t + y0`.
function quadPieceWinding(
  px: number,
  py: number,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  a: number,
  b: number,
  ta: number,
  tb: number,
) {
  const ya = quadAt(y0, cy, y1, ta)
  const yb = quadAt(y0, cy, y1, tb)
  if (!crosses(ya, yb, py)) {
    return 0
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
  return quadAt(x0, cx, x1, t) > px ? (yb > ya ? 1 : -1) : 0
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
  return turn > 0 && turn < 1
    ? quadPieceWinding(px, py, x0, y0, cx, cy, x1, y1, a, b, 0, turn) +
        quadPieceWinding(px, py, x0, y0, cx, cy, x1, y1, a, b, turn, 1)
    : quadPieceWinding(px, py, x0, y0, cx, cy, x1, y1, a, b, 0, 1)
}

const OUTLINE = 12

function writeRim(out: Float64Array, j: number, radius: number, a: number) {
  out[j] = radius * Math.cos(a)
  out[j + 1] = radius * Math.sin(a)
}

function writeControl(
  out: Float64Array,
  j: number,
  startRadians: number,
  endRadians: number,
  radius: number,
  bezierRadius: number,
) {
  const [x, y] = chordControlPoint({
    startRadians,
    endRadians,
    radius,
    bezierRadius,
  })
  out[j] = x
  out[j + 1] = y
}

// The points a ribbon's outline passes after leaving `a1` along its arc: `a2`,
// the curve's control, `m1`, `m2`, the other curve's control, and `a1`.
function writeOutline(
  out: Float64Array,
  j: number,
  { a1, a2, m1, m2 }: RibbonAngles,
  radius: number,
  bezierRadius: number,
) {
  writeRim(out, j, radius, a2)
  writeControl(out, j + 2, a2, m1, radius, bezierRadius)
  writeRim(out, j + 4, radius, m1)
  writeRim(out, j + 6, radius, m2)
  writeControl(out, j + 8, m2, a1, radius, bezierRadius)
  writeRim(out, j + 10, radius, a1)
}

function outlineWinding(
  px: number,
  py: number,
  { a1, a2, m1, m2 }: RibbonAngles,
  radius: number,
  o: Float64Array,
  j: number,
) {
  const reach = Math.sqrt(Math.max(0, radius * radius - py * py))
  return (
    arcWinding(px, py, a1, a2, radius, reach, o[j + 11]!, o[j + 1]!) +
    quadWinding(
      px,
      py,
      o[j]!,
      o[j + 1]!,
      o[j + 2]!,
      o[j + 3]!,
      o[j + 4]!,
      o[j + 5]!,
    ) +
    arcWinding(px, py, m1, m2, radius, reach, o[j + 5]!, o[j + 7]!) +
    quadWinding(
      px,
      py,
      o[j + 6]!,
      o[j + 7]!,
      o[j + 8]!,
      o[j + 9]!,
      o[j + 10]!,
      o[j + 11]!,
    )
  )
}

/**
 * Whether a ribbon's fill covers a point, both in CSS px from the circle's
 * centre: the nonzero winding of its boundary, the rule the canvas fills it
 * by, so a twisted ribbon's two lobes both count.
 */
export function ribbonContains(
  px: number,
  py: number,
  angles: RibbonAngles,
  radius: number,
  bezierRadius: number,
) {
  if (px * px + py * py > radius * radius) {
    return false
  }
  const outline = new Float64Array(OUTLINE)
  writeOutline(outline, 0, angles, radius, bezierRadius)
  return outlineWinding(px, py, angles, radius, outline, 0) !== 0
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

// Rounding can put a crossing the winding test computes just off its piece's
// hull; this fraction of the radius is far past that.
const BOX_PAD = 1e-6

function growBox(boxes: Float64Array, b: number, x: number, y: number) {
  boxes[b] = Math.min(boxes[b]!, x)
  boxes[b + 1] = Math.min(boxes[b + 1]!, y)
  boxes[b + 2] = Math.max(boxes[b + 2]!, x)
  boxes[b + 3] = Math.max(boxes[b + 3]!, y)
}

function padBox(boxes: Float64Array, b: number, pad: number) {
  boxes[b] = boxes[b]! - pad
  boxes[b + 1] = boxes[b + 1]! - pad
  boxes[b + 2] = boxes[b + 2]! + pad
  boxes[b + 3] = boxes[b + 3]! + pad
}

function growByArc(
  boxes: Float64Array,
  b: number,
  from: number,
  to: number,
  radius: number,
) {
  const quarter = Math.PI / 2
  for (
    let k = Math.ceil(Math.min(from, to) / quarter);
    k * quarter <= Math.max(from, to);
    k++
  ) {
    growBox(
      boxes,
      b,
      radius * Math.cos(k * quarter),
      radius * Math.sin(k * quarter),
    )
  }
}

/**
 * What `hitRibbon` reads of every lane on one stage: each ribbon's outline, and
 * its bounding box as `minX, minY, maxX, maxY`, which holds its arcs and each
 * curve's control triangle. A point outside the box winds zero times round the
 * ribbon.
 */
export interface RibbonHitGeometry {
  boxes: Float64Array
  outlines: Float64Array
}

export function ribbonHitGeometry(
  lanes: RibbonLanes,
  stage: ChordStage,
): RibbonHitGeometry {
  const { radiusPx: radius, bezierRadiusPx: bezierRadius } = stage
  const pad = BOX_PAD * radius
  const boxes = new Float64Array(4 * lanes.count)
  const outlines = new Float64Array(OUTLINE * lanes.count)
  for (let i = 0; i < lanes.count; i++) {
    const angles = ribbonAnglesAt(lanes, i, stage)
    const b = 4 * i
    const j = OUTLINE * i
    writeOutline(outlines, j, angles, radius, bezierRadius)
    boxes[b] = boxes[b + 2] = outlines[j]!
    boxes[b + 1] = boxes[b + 3] = outlines[j + 1]!
    for (let k = j + 2; k < j + OUTLINE; k += 2) {
      growBox(boxes, b, outlines[k]!, outlines[k + 1]!)
    }
    growByArc(boxes, b, angles.a1, angles.a2, radius)
    growByArc(boxes, b, angles.m1, angles.m2, radius)
    padBox(boxes, b, pad)
  }
  return { boxes, outlines }
}

/**
 * The topmost ribbon covering the point, later instances painting over
 * earlier: `geometry` is `ribbonHitGeometry` of the same lanes on the same
 * stage.
 */
export function hitRibbon(
  lanes: RibbonLanes,
  stage: ChordStage,
  { boxes, outlines }: RibbonHitGeometry,
  px: number,
  py: number,
) {
  const radius = stage.radiusPx
  if (px * px + py * py > radius * radius) {
    return undefined
  }
  for (let i = lanes.count - 1; i >= 0; i--) {
    const b = 4 * i
    if (
      px >= boxes[b]! &&
      py >= boxes[b + 1]! &&
      px <= boxes[b + 2]! &&
      py <= boxes[b + 3]! &&
      outlineWinding(
        px,
        py,
        ribbonAnglesAt(lanes, i, stage),
        radius,
        outlines,
        OUTLINE * i,
      ) !== 0
    ) {
      return i
    }
  }
  return undefined
}

function sameStage(a: ChordStage, b: ChordStage) {
  return (
    a.radiansPerBp === b.radiansPerBp &&
    a.gapRadians === b.gapRadians &&
    a.offsetRadians === b.offsetRadians &&
    a.radiusPx === b.radiusPx &&
    a.bezierRadiusPx === b.bezierRadiusPx
  )
}

/**
 * `hitRibbon` holding the geometry it last measured, so a pointer moving over
 * one figure measures it once rather than on every move.
 */
export function ribbonHitTest() {
  let held:
    | { lanes: RibbonLanes; stage: ChordStage; geometry: RibbonHitGeometry }
    | undefined
  return (lanes: RibbonLanes, stage: ChordStage, px: number, py: number) => {
    if (held?.lanes !== lanes || !sameStage(held.stage, stage)) {
      held = { lanes, stage, geometry: ribbonHitGeometry(lanes, stage) }
    }
    return hitRibbon(lanes, stage, held.geometry, px, py)
  }
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
