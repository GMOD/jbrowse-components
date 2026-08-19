import { cmpStr } from '@jbrowse/core/util'

// The draw-tier boundary, and the same 1px the pick engine splits on: a ribbon
// narrower than this perpendicular is drawn as a centerline rather than a solid
// fill and is never inserted into the pick index, so where it sorts is a
// compositing choice only.
export const MIN_PICKABLE_PX = 1

export function drawTier(px: number) {
  return px < MIN_PICKABLE_PX ? 0 : 1
}

// What the comparator reads. `px` is the feature's on-screen size, the max over
// the two axes; `tier` is `drawTier(px)`, stored rather than recomputed so the
// comparator stays plain arithmetic across an O(n log n) sort.
export interface DrawOrderKey {
  px: number
  tier: number
  refName: string
  start: number
  mateRefName: string
  mateStart: number
  id: string
}

// The synteny paint order, and therefore also the pick order: INSTANCE ORDER IS
// DRAW ORDER the whole way through (see buildSyntenyGeometry), and the pick
// engine walks it backwards so whatever paints last also answers the hover. One
// comparator decides both, and it has to, or "drawn" and "pickable" answer
// differently.
//
// TWO TIERS, both keyed on ON-SCREEN SIZE:
//
//   sub-pixel  small -> large, at the BOTTOM
//   the rest   large -> small, above them
//
// The bottom tier is the whole-genome hairball, and it stays underneath for the
// reason it always has: thousands of threads composited over the big blocks bury
// them. Nothing down there is pickable either way, so its internal order is
// purely about compositing.
//
// The top tier used to sort the same direction, and that is what made a small
// inversion inside a large match unreachable. The match paints last, so it takes
// every hover and click across its whole span — while at the view's default
// alpha of 0.2 it does not hide the inversion but merely tints it. Visible and
// unhoverable is what reads as a rendering glitch. Largest-first puts the smaller
// shape on top, which is both where a reader expects to pick it and the crisper
// composite.
//
// PIXELS, not query bp: the tier boundary is a pixel fact, and an inversion can
// be narrow on one axis and wide on the other. That makes the order
// zoom-dependent, which costs nothing — the sort runs per fetch, and setRpcData
// drops the hover/click indices along with the geometry they addressed.
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
