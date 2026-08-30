// What one arc DRAWS, in screen px. THE derivation: the on-screen Canvas2D
// stroke, the SVG export's `d`, the label's apex and the hit test all take their
// geometry from here, so none of the four can place an arc where another one
// did not.
//
// Two shapes, because the two displays offer two and they are not the same
// curve. A semicircle is a true half circle — its radius IS half the span, so
// its height cannot be set independently — and a bezier is a symmetric cubic
// whose control points sit at `height`, which puts its apex at 0.75 of that. An
// earlier reader who assumed the second was an ellipse would measure a hover
// against a curve the renderer does not draw.
//
// `left` may be past `right`: a reversed displayed region maps the two ends onto
// opposite sides of the block. Everything here is written so that both
// orientations describe the same ink — see `arcPathD`'s sweep flag, which is the
// one place the direction of travel matters.

export interface ArcShapeBase {
  /** Screen x of each end, in the order the feature resolved them. */
  left: number
  right: number
}

/** A half circle dipping below the baseline, radius `|right - left| / 2`. */
export interface ArcSemicircle extends ArcShapeBase {
  kind: 'semicircle'
}

/**
 * A symmetric cubic with both control points at `height`, so the apex lands at
 * `0.75 * height` and the curve leaves each foot vertically.
 */
export interface ArcBezier extends ArcShapeBase {
  kind: 'bezier'
  height: number
}

export type ArcShape = ArcSemicircle | ArcBezier

const semicircleRadius = (s: ArcShapeBase) => Math.abs(s.right - s.left) / 2

/** Midpoint of the two feet — the axis both shapes are symmetric about. */
export function arcMidX(s: ArcShapeBase) {
  return (s.left + s.right) / 2
}

/**
 * Where the curve tops out, measured down from the baseline — the y a label
 * sits at, and the deepest point the ink reaches.
 */
export function arcApexY(s: ArcShape) {
  return s.kind === 'semicircle' ? semicircleRadius(s) : 0.75 * s.height
}

/**
 * The SVG `d`, for the export path.
 *
 * The sweep flag is the other half of the reversed-region mirror: the radius is
 * an absolute value, so a fixed `0` swept a reversed arc the wrong way round and
 * put its apex ABOVE the baseline, outside the container and clipped to two dots
 * on the axis. `arcStroke` needs no such flag because `ctx.arc` takes a centre
 * and two angles rather than a direction of travel.
 */
export function arcPathD(s: ArcShape) {
  const { left, right } = s
  if (s.kind === 'bezier') {
    const { height } = s
    return `M ${left} 0 C ${left} ${height}, ${right} ${height}, ${right} 0`
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
    // Angle 0 is +x and angle π/2 is +y, which is DOWN, so this sweep dips below
    // the baseline whichever side of the midpoint each foot is on. That is why
    // the reversed case needs nothing here and needs a flag in `arcPathD`.
    ctx.arc(arcMidX(s), 0, semicircleRadius(s), 0, Math.PI)
  }
  ctx.stroke()
}

// How finely a bezier is flattened for the hit test, in px of hull perimeter per
// segment. Sampling is uniform in `t`, which concentrates the samples exactly
// where the curve turns — `x(t)` has a zero derivative at both feet — so the
// coarsest chord is at the apex, where the curve is flattest. At the cap below
// that is a ~23px chord on a 2000px-wide arc, whose sagitta is 0.002px.
const FLATTEN_PX = 4
const FLATTEN_MIN = 16
const FLATTEN_MAX = 128

/**
 * Distance from a point to one arc's own ink, in px.
 *
 * Exact for a semicircle, which is a circle and has a closed form. A cubic
 * bezier's nearest point is a quintic, so that branch measures against the
 * flattened polyline instead — the same approximation the rasterizer makes, at a
 * tolerance (above) two orders of magnitude under the hover slop the caller adds.
 */
export function arcDistancePx(s: ArcShape, x: number, y: number) {
  if (s.kind === 'semicircle') {
    const r = semicircleRadius(s)
    // Only the lower half is drawn, so above the baseline the nearest ink is a
    // foot rather than the circle. Reachable: a foot is at y = 0 and the slop
    // extends the target above it.
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

/** Distance from `(x, y)` to the segment `(ax, ay) → (bx, by)`. */
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
