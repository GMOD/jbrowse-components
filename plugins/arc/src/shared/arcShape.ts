// What one arc DRAWS, in screen px. The canvas stroke, the export's `d`, the
// label apex and the hit test all take their curve from here.
//
// `left` may be past `right` — a reversed displayed region maps the two ends
// onto opposite sides of the block — and both orientations describe the same
// ink.

export interface ArcShapeBase {
  left: number
  right: number
}

/** A half circle dipping below the baseline, radius `|right - left| / 2`. */
export interface ArcSemicircle extends ArcShapeBase {
  kind: 'semicircle'
}

/** A symmetric cubic with both control points at `height`, apexing at 0.75 of it. */
export interface ArcBezier extends ArcShapeBase {
  kind: 'bezier'
  height: number
}

export type ArcShape = ArcSemicircle | ArcBezier

const semicircleRadius = (s: ArcShapeBase) => Math.abs(s.right - s.left) / 2

export function arcMidX(s: ArcShapeBase) {
  return (s.left + s.right) / 2
}

/** Where the curve tops out, measured down from the baseline. */
export function arcApexY(s: ArcShape) {
  return s.kind === 'semicircle' ? semicircleRadius(s) : 0.75 * s.height
}

/**
 * The SVG `d`, for the export path.
 *
 * The sweep flag is the other half of the reversed-region mirror: the radius is
 * an absolute value, so a fixed `0` swept a reversed arc the wrong way round and
 * put its apex ABOVE the baseline, clipped away to two dots on the axis.
 */
export function arcPathD(s: ArcShape) {
  const { left, right } = s
  if (s.kind === 'bezier') {
    return `M ${left} 0 C ${left} ${s.height}, ${right} ${s.height}, ${right} 0`
  }
  const r = semicircleRadius(s)
  return `M ${left} 0 A ${r} ${r} 0 0 ${left <= right ? 0 : 1} ${right} 0`
}

/** Strokes one arc. The caller sets `strokeStyle` and `lineWidth`. */
export function arcStroke(ctx: CanvasRenderingContext2D, s: ArcShape) {
  ctx.beginPath()
  if (s.kind === 'bezier') {
    ctx.moveTo(s.left, 0)
    ctx.bezierCurveTo(s.left, s.height, s.right, s.height, s.right, 0)
  } else {
    // A centre and two angles rather than a direction of travel, so this needs
    // no counterpart to `arcPathD`'s sweep flag.
    ctx.arc(arcMidX(s), 0, semicircleRadius(s), 0, Math.PI)
  }
  ctx.stroke()
}

// Bezier flattening, in px of hull perimeter per segment. Sampling is uniform in
// `t`, which concentrates samples where the curve turns (`x(t)` has a zero
// derivative at both feet), so the coarsest chord is at the apex where the curve
// is flattest — a ~23px chord on a 2000px arc, whose sagitta is 0.002px.
const FLATTEN_PX = 4
const FLATTEN_MIN = 16
const FLATTEN_MAX = 128

/**
 * Distance from a point to one arc's own ink, in px. Exact for a semicircle; a
 * cubic's nearest point is a quintic, so that branch measures against the
 * flattened polyline at the tolerance above.
 */
export function arcDistancePx(s: ArcShape, x: number, y: number) {
  if (s.kind === 'semicircle') {
    const r = semicircleRadius(s)
    // Only the lower half is drawn, so above the baseline the nearest ink is a
    // foot rather than the circle.
    return y >= 0
      ? Math.abs(Math.hypot(x - arcMidX(s), y) - r)
      : Math.min(Math.hypot(x - s.left, y), Math.hypot(x - s.right, y))
  }
  const { left, right, height } = s
  const n = Math.min(
    FLATTEN_MAX,
    Math.max(
      FLATTEN_MIN,
      Math.ceil((Math.abs(right - left) + 2 * Math.abs(height)) / FLATTEN_PX),
    ),
  )
  let best = Number.POSITIVE_INFINITY
  let px = left
  let py = 0
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    const qx = mt * mt * (1 + 2 * t) * left + t * t * (3 - 2 * t) * right
    const qy = 3 * height * t * mt
    const d = segmentDistancePx(px, py, qx, qy, x, y)
    if (d < best) {
      best = d
    }
    px = qx
    py = qy
  }
  return best
}

export function segmentDistancePx(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  y: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp01(((x - ax) * dx + (y - ay) * dy) / len2)
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
