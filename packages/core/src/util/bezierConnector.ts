// One horizontal-tangent "oval" connector curve, shared by the alignments
// linked-read bezier overlay (PileupBezierOverlay) and BreakpointSplitView's
// AlignmentConnections so the two renderers draw a connection identically. Both
// describe the same thing — two read endpoints (from the shared
// connectionEndpoints rule), each segment's strand, and whether the second end
// is a split junction's 5' edge — and this owns the curve geometry, so the
// direction logic can't drift between them.

// Horizontal control-handle length, in px. Scales with the endpoints' horizontal
// separation so wider connections bulge more, with a floor so tightly-spaced
// endpoints still show a visible tangent. Use this for connections whose two
// ends sit in the same view (mates across a pileup / a single-view breakpoint
// connection); cross-view connections in a stacked breakpoint split view supply
// their own fixed length instead, since their ends are separated vertically.
const MIN_HANDLE_PX = 15
const HANDLE_FACTOR = 0.3

// Vertical bow applied to a connection whose two endpoints share (or nearly
// share) a row — e.g. a chain whose split segments are all laid out on one
// pileup row. Without it the horizontal-only handles collapse the cubic to a
// flat, invisible line lying on the row; the bow lifts the control points so
// the curve arcs into a visible hump. Fades to zero as the endpoints' rows
// separate, since a cross-row curve already has vertical extent.
const MAX_BOW_PX = 30

export function bezierConnectorHandlePx(x1: number, x2: number) {
  return Math.max(MIN_HANDLE_PX, Math.abs(x2 - x1) * HANDLE_FACTOR)
}

// Sign (+1/-1) of an endpoint's horizontal control handle. The handle leaves a
// trailing (3') endpoint along the read's reading direction (`strand`); at a
// split junction's leading (5') endpoint it flips, so the curve arrives flowing
// *into* the next segment (a fwd→rev inversion folds back instead of cutting
// straight across). `reversed` flips screen-x for a reverse-complemented region.
function tangentSign(strand: number, leading: boolean, reversed: boolean) {
  return strand * (leading ? -1 : 1) * (reversed ? -1 : 1)
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
  handlePx,
  // Control-point Y override (default: each endpoint's own Y) — the abnormal
  // same-level breakpoint case pulls both control points to a shared row.
  cy1 = y1,
  cy2 = y2,
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
  handlePx: number
  cy1?: number
  cy2?: number
}) {
  const dx1 = handlePx * tangentSign(s1, false, reversed1)
  const dx2 = handlePx * tangentSign(s2, leadingEnd2, reversed2)
  // A caller that overrides the control-point Y (the abnormal same-level dip)
  // owns its own shape, so only bow the default same-row case (see MAX_BOW_PX).
  const overridden = cy1 !== y1 || cy2 !== y2
  const bow = overridden ? 0 : Math.max(0, MAX_BOW_PX - Math.abs(y2 - y1))
  return `M ${x1} ${y1} C ${x1 + dx1} ${cy1 - bow} ${x2 + dx2} ${cy2 - bow} ${x2} ${y2}`
}
