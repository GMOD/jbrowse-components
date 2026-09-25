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

// A symmetric cubic's extreme sits 3/4 of the way from its baseline to its
// control points, so an arc asked to reach a given apex puts its controls 4/3
// past it. Exported because the sashimi overlay solves the same equation in the
// other direction, and the two spellings drifting apart would put the insert-
// size ruler's labels at heights nothing plots at.
export const CUBIC_APEX_RATIO = 0.75

// Vertical bow applied to a connection whose two endpoints share (or nearly
// share) a row — e.g. a chain whose split segments are all laid out on one
// pileup row. Without it the horizontal-only handles collapse the cubic to a
// flat, invisible line lying on the row; the bow lifts the control points so
// the curve arcs into a visible hump. This is the control-point lift, not the
// height the curve reaches.
const MAX_BOW_PX = 30

// A discordant connection bows *down* instead of up, so the two classes read
// apart at a glance. Both renderers follow this: BreakpointSplitView dips its
// same-level discordant links, and the pileup overlay dips every discordant
// curve it draws (a normal-orientation pair is a plain line, or bows up over its
// row where a hidden-segment one would lie on a chain's connecting line). Keep
// it that way — a renderer that opts out makes "below the reads" mean two
// different things in two views of the same data.
//
// HOW DEEP is the renderer's call, not this file's. Depth is the mark's one free
// channel, and only the renderer knows the band the ink has to survive in — the
// pileup clips each section at its band bottom, and the split view bleeds a
// too-deep dip into the panel below. So callers pass the depth they want and
// `discordantDipPx` (@jbrowse/sv-core) is the law the two of them share.

// How far a curve can stray outside the band between its two endpoints. The dip
// is the deeper of the two shaping terms, so this is a ceiling on it, applied
// here rather than trusted to a caller: a culler pads its viewport test by this,
// and the shaping is applied to the *control points*, so a curve whose two
// endpoints both sit just outside the viewport can still have a visible body.
export const BEZIER_CONNECTOR_MAX_REACH_PX = 110

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
  // Depth, in px, of the dip a discordant connection draws instead of the bow a
  // concordant one gets — aberrant pair orientation, or a split junction's
  // strand flip, so the two classes are tellable apart by shape alone. It is
  // the depth of the curve's APEX — what a caller can bound by the room it has —
  // and CUBIC_APEX_RATIO converts it to the control-point drop that puts the ink
  // there. Leave it out to bow up.
  dipPx,
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
  dipPx?: number
}) {
  const from = { x: x1, y: y1 }
  const to = { x: x2, y: y2 }
  const budget = shapingBudget(from, to)
  const handle = Math.min(maxHandlePx, budget)
  // The dip is deliberately not clamped to the budget, unlike the bow. The
  // budget stops the cubic folding back over itself, and only the horizontal
  // handles can do that — a vertical offset leaves x(t) monotonic however deep
  // it goes, so a big event squeezed into a few px draws a narrow trough rather
  // than a squiggle. Pinned by 'a dipped connection never overshoots its
  // endpoints in x'.
  const bow =
    dipPx === undefined
      ? bowHeight(from, to, budget)
      : -Math.min(dipPx, BEZIER_CONNECTOR_MAX_REACH_PX) / CUBIC_APEX_RATIO
  return cubicPath(
    from,
    { x: x1 + handle * tangentSign(s1, false, reversed1), y: y1 - bow },
    { x: x2 + handle * tangentSign(s2, leadingEnd2, reversed2), y: y2 - bow },
    to,
  )
}
