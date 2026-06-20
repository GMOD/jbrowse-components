// Horizontal-tangent "oval" connector curve shared by the alignments linked-read
// bezier overlay (PileupBezierOverlay) and BreakpointSplitView's
// AlignmentConnections, so the two renderers draw the same idiom. The control
// points sit at each endpoint's own Y (cy1/cy2 default to y1/y2) and are offset
// horizontally by dx1/dx2, so the curve leaves and arrives horizontally.

// Horizontal control-handle length, in px. Scales with the endpoints' horizontal
// separation so wider connections bulge more, with a floor so tightly-spaced
// endpoints still show a visible tangent. Use this for connections whose two
// ends sit in the same view (mates across a pileup / a single-view breakpoint
// connection); cross-view connections in a stacked breakpoint split view supply
// their own fixed length instead, since their ends are separated vertically.
const MIN_HANDLE_PX = 15
const HANDLE_FACTOR = 0.3

export function bezierConnectorHandlePx(x1: number, x2: number) {
  return Math.max(MIN_HANDLE_PX, Math.abs(x2 - x1) * HANDLE_FACTOR)
}

export function bezierConnectorPath({
  x1,
  y1,
  x2,
  y2,
  dx1,
  dx2,
  cy1 = y1,
  cy2 = y2,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  dx1: number
  dx2: number
  cy1?: number
  cy2?: number
}) {
  return `M ${x1} ${y1} C ${x1 + dx1} ${cy1} ${x2 + dx2} ${cy2} ${x2} ${y2}`
}
