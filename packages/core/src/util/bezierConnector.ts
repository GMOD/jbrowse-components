// One horizontal-tangent "oval" connector curve, shared by the alignments
// linked-read bezier overlay (PileupBezierOverlay) and BreakpointSplitView's
// AlignmentConnections so the two renderers draw a connection identically. Both
// describe the same thing — two read endpoints (from the shared
// connectionEndpoints rule), each segment's strand, and whether the second end
// is a split junction's 5' edge — and this owns the curve geometry, so the
// direction logic can't drift between them.

// A handle or bow larger than the endpoints' own separation folds the cubic
// back over itself: the curve leaves along its tangent, overshoots the far
// endpoint, and has to curl back to arrive — the "loop-de-loop"/squiggle seen
// on tightly-spaced reads. So every shaping term stays under this fraction of
// the span the curve actually has to cover. Endpoints that nearly touch
// therefore get no shaping at all and draw as the straight line they should be.
const SPAN_FACTOR = 0.3

// Ceiling on the control-handle length. The span budget is what actually scales
// the handle — it resolves below this for any connection whose endpoints are
// closer than ~667px apart, which is nearly all of them — so this only bites on
// very wide arcs. There it bounds the fold-back hook that an inversion draws at
// its leading end: unbounded, that hook grows with the arc, and a full-width
// inversion flings a ~500px curl back across unrelated reads.
const MAX_HANDLE_PX = 200

// Vertical bow applied to a connection whose two endpoints share (or nearly
// share) a row — e.g. a chain whose split segments are all laid out on one
// pileup row. Without it the horizontal-only handles collapse the cubic to a
// flat, invisible line lying on the row; the bow lifts the control points so
// the curve arcs into a visible hump. This is the control-point lift, not the
// height the curve reaches: a cubic with both control points lifted by `bow`
// apexes at 0.75 * bow.
const MAX_BOW_PX = 30

interface Pt {
  x: number
  y: number
}

// Sign (+1/-1) of an endpoint's horizontal control handle. The handle leaves a
// trailing (3') endpoint along the read's reading direction (`strand`); at a
// split junction's leading (5') endpoint it flips, so the curve arrives flowing
// *into* the next segment (a fwd→rev inversion folds back instead of cutting
// straight across). `reversed` flips screen-x for a reverse-complemented region.
function tangentSign(strand: number, leading: boolean, reversed: boolean) {
  return strand * (leading ? -1 : 1) * (reversed ? -1 : 1)
}

// How much shaping (handle length, bow height) this curve may spend: a fraction
// of the distance it has to cover. Vertical reach counts the control rows too,
// so the abnormal dip's deliberate stretch down to the track edge still earns a
// full-length handle even though its endpoints sit on one row.
function shapingBudget(p1: Pt, p2: Pt, cy1: number, cy2: number) {
  const ys = [p1.y, p2.y, cy1, cy2]
  const spanY = Math.max(...ys) - Math.min(...ys)
  return Math.hypot(p2.x - p1.x, spanY) * SPAN_FACTOR
}

// Fades to zero as the endpoints' rows separate, since a cross-row curve
// already has vertical extent — and via the budget as they close in
// horizontally, since a short connector is legible without a hump.
function bowHeight(p1: Pt, p2: Pt, budget: number) {
  return Math.min(budget, Math.max(0, MAX_BOW_PX - Math.abs(p2.y - p1.y)))
}

function cubicPath(from: Pt, ctrl1: Pt, ctrl2: Pt, to: Pt) {
  return `M ${from.x} ${from.y} C ${ctrl1.x} ${ctrl1.y} ${ctrl2.x} ${ctrl2.y} ${to.x} ${to.y}`
}

export function bezierConnectorPath({
  x1,
  y1,
  x2,
  y2,
  s1,
  s2,
  // The second endpoint is a split junction's 5' leading edge (its handle flips
  // to fold the curve into the next segment); false for a paired mate's 3' edge.
  leadingEnd2 = false,
  reversed1 = false,
  reversed2 = false,
  maxHandlePx = MAX_HANDLE_PX,
  // Pull both control points down to this row instead of each endpoint's own Y
  // — the abnormal same-level breakpoint connection's deliberate dip to the
  // track's bottom edge. Such a caller owns its own shape, so the bow is off.
  dipToY,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  s1: number
  s2: number
  leadingEnd2?: boolean
  reversed1?: boolean
  reversed2?: boolean
  maxHandlePx?: number
  dipToY?: number
}) {
  const from = { x: x1, y: y1 }
  const to = { x: x2, y: y2 }
  const cy1 = dipToY ?? y1
  const cy2 = dipToY ?? y2
  const budget = shapingBudget(from, to, cy1, cy2)
  const handle = Math.min(maxHandlePx, budget)
  const bow = dipToY === undefined ? bowHeight(from, to, budget) : 0
  return cubicPath(
    from,
    { x: x1 + handle * tangentSign(s1, false, reversed1), y: cy1 - bow },
    { x: x2 + handle * tangentSign(s2, leadingEnd2, reversed2), y: cy2 - bow },
    to,
  )
}
