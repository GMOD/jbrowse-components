import { cmpStr } from '@jbrowse/core/util'

// The same 1px the pick engine splits on: a ribbon narrower than this
// perpendicular draws as a centerline rather than a solid fill and never enters
// the pick index, so where it sorts is a compositing choice only.
const MIN_PICKABLE_PX = 1

export function drawTier(px: number) {
  return px < MIN_PICKABLE_PX ? 0 : 1
}

// `px` is the feature's on-screen size, the max over the two axes; `tier` is
// `drawTier(px)`, stored rather than recomputed so the comparator stays plain
// arithmetic across an O(n log n) sort.
export interface DrawOrderKey {
  px: number
  tier: number
  refName: string
  start: number
  mateRefName: string
  mateStart: number
  id: string
}

// The synteny paint order and, because the pick engine walks instance order
// backwards, the pick order too. Two tiers, both keyed on on-screen size:
//
//   sub-pixel  small -> large, at the BOTTOM
//   the rest   large -> small, above them
//
// The bottom tier is the whole-genome hairball: thousands of threads composited
// over the big blocks bury them, and nothing down there is pickable anyway.
//
// Largest-first above it is what keeps a small inversion inside a large match
// reachable. At the view's default alpha of 0.2 the match only tints the
// inversion rather than hiding it, so sorting the match on top left a shape that
// was visible but answered no hover across its whole span.
//
// PIXELS, not query bp: an inversion can be narrow on one axis and wide on the
// other. That makes the order zoom-dependent, which costs nothing — the sort
// runs per fetch, and setRpcData drops the hover/click indices along with the
// geometry they addressed.
//
// Ties break on position/mate/id rather than on the adapter's block-arrival
// order, which varies run-to-run as concurrent region fetches resolve. That
// stabilizes alpha compositing of equal-size overlapping ribbons, the
// feature-index→featureId mapping (click/hover identity), and downstream
// diagonalize.
export function compareDrawOrder(a: DrawOrderKey, b: DrawOrderKey) {
  return (
    a.tier - b.tier ||
    (a.tier === 0 ? a.px - b.px : b.px - a.px) ||
    cmpStr(a.refName, b.refName) ||
    a.start - b.start ||
    cmpStr(a.mateRefName, b.mateRefName) ||
    a.mateStart - b.mateStart ||
    cmpStr(a.id, b.id)
  )
}
