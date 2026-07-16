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

// A discordant connection bows *down* instead of up, so the two classes read
// apart at a glance. Both renderers follow this: BreakpointSplitView dips its
// same-level discordant links, and the pileup overlay dips every curve it draws
// (its normal-orientation pairs are plain lines, so a curve there is always
// discordant). Keep it that way — a renderer that opts out makes "below the
// reads" mean two different things in two views of the same data.
//
// Depth comes from the connection's own horizontal span
// rather than reaching for some fixed row: with "view as pairs" / "link
// supplementary alignments" every qname lands on one row, so dipping to a
// shared row bottoms every curve out at the same depth and they collapse into
// spaghetti. Keying on span makes the depth mean something — wide events dive
// deeper than narrow ones — and lets the curves nest.
//
// Depth saturates toward MAX_DIP_PX rather than clamping at it. A hard cap
// reintroduces exactly the problem being fixed: every connection wider than the
// cap point bottoms out at an identical depth, and at any plausible cap a
// typical view is mostly wider. This form stays strictly increasing in span at
// every width while staying bounded. DIP_HALF_SPAN_PX is the span at which the
// dip reaches half its maximum.
const MAX_DIP_PX = 110
const DIP_HALF_SPAN_PX = 500

// How far a curve can stray outside the band between its two endpoints. A cubic
// with both control points offset by `d` apexes at 0.75 * d, and the dip — the
// deeper of the two shaping terms — saturates toward MAX_DIP_PX, so this bounds
// both. A caller that culls off-screen curves has to pad its viewport test by
// this: the shaping is applied to the *control points*, so a curve whose two
// endpoints both sit just outside the viewport can still have a visible body.
export const BEZIER_CONNECTOR_MAX_REACH_PX = 0.75 * MAX_DIP_PX

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
// of the distance it has to cover.
function shapingBudget(p1: Pt, p2: Pt) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y) * SPAN_FACTOR
}

// Fades to zero as the endpoints' rows separate, since a cross-row curve
// already has vertical extent — and via the budget as they close in
// horizontally, since a short connector is legible without a hump.
function bowHeight(p1: Pt, p2: Pt, budget: number) {
  return Math.min(budget, Math.max(0, MAX_BOW_PX - Math.abs(p2.y - p1.y)))
}

// Negative = the control points drop below the reads (see MAX_DIP_PX). Keyed on
// horizontal span alone: two reads a few px apart describe a small event and get
// a small dip, however tall their track happens to be.
//
// Budget-clamped like the bow. At the current tuning the saturating curve
// already resolves under the budget at every span (worst ratio ~0.73, as span
// → 0), so this is inert — it's here so retuning MAX_DIP_PX / DIP_HALF_SPAN_PX
// can't silently reintroduce the fold-back squiggle SPAN_FACTOR exists to
// prevent. Pinned by 'the dip never outgrows its shaping budget'.
function dipHeight(p1: Pt, p2: Pt, budget: number) {
  const span = Math.abs(p2.x - p1.x)
  return -Math.min(budget, MAX_DIP_PX * (span / (span + DIP_HALF_SPAN_PX)))
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
  // This connection is discordant (aberrant pair orientation, or a split
  // junction's strand flip): it dips below the reads instead of arcing over
  // them, so the two classes are tellable apart by shape alone.
  dip = false,
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
  dip?: boolean
}) {
  const from = { x: x1, y: y1 }
  const to = { x: x2, y: y2 }
  const budget = shapingBudget(from, to)
  const handle = Math.min(maxHandlePx, budget)
  const bow = dip ? dipHeight(from, to, budget) : bowHeight(from, to, budget)
  return cubicPath(
    from,
    { x: x1 + handle * tangentSign(s1, false, reversed1), y: y1 - bow },
    { x: x2 + handle * tangentSign(s2, leadingEnd2, reversed2), y: y2 - bow },
    to,
  )
}
