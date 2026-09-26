// What an arc DRAWS AS, as an enum, and the predicates over it. Its own
// module because the band's feed and the display's tooltip read it, and each
// would otherwise pull in `compute.ts`, the read grouping, clustering and
// colour classification. No shader reads these values: the feed picks a mark
// per shape on the CPU.

// The single curved paired-read shape. Its on-screen form is chosen by the
// *renderer* from how wide the pair is, not by a bp threshold here: a rounded
// dome while both mates fit on screen, collapsing to near-vertical lines rising
// from each real endpoint once the pair spans wider than the screen (the circle
// gets so big the band clips its apex). The endpoints always sit at the true
// genomic coordinates. See `linkRadiiPx` in render-core's linkMark.slang.
export const ARC_SHAPE_ARC = 0
// read-cloud flat line at Y=|tlen|; the split variant is drawn dashed
// (matching samplot.py's plot_split_plan dotted-line style).
export const ARC_SHAPE_FLAT = 1
export const ARC_SHAPE_FLAT_SPLIT = 2
// A connection the view can place only ONE end of: the partner read — a mate,
// or another segment of the same read — is outside every loaded region, so
// there is no second pixel to draw to. Both feet are collapsed onto the end
// that IS on screen and `yBp` is 0, so it draws as one square on the band's
// zero anchor: a degenerate case of the flat mark rather than a fourth
// geometry. `computeArcShape` has why, `resolveArcs` the collapse.
export const ARC_SHAPE_FLAT_UNPLACED = 3

// Every flat variant plots as a horizontal line with endpoint-square markers,
// unlike the curved ARC shape.
//
// It answers "does this draw as a bar" and NEVER either of the two questions
// below, which is why all three are named. `formatArcTooltip` is where that
// bites and says so, and the display's CLAUDE.md states the rule; it belongs on
// the predicates too, now that they have a home.
export function isFlatArcShape(shape: number) {
  return (
    shape === ARC_SHAPE_FLAT ||
    shape === ARC_SHAPE_FLAT_SPLIT ||
    shape === ARC_SHAPE_FLAT_UNPLACED
  )
}

// "Is the far end of this connection off screen", which the hover asks. An
// unplaced mark's two endpoints are ONE coordinate — the collapse is what lets
// every renderer draw it with no geometry of its own — so a tooltip reading
// them as a range prints a zero-width location and a distance of 0 over a
// partner megabases away. `spanBp` is where the real distance went.
export function isUnplacedArcShape(shape: number) {
  return shape === ARC_SHAPE_FLAT_UNPLACED
}

// "Does this SIZE the read cloud's Y axis", which `maxFlatArcSpanBp` asks and
// which is not the same set again. An unplaced mark is drawn at the anchor and
// not on the axis, so letting its span size that axis is precisely the failure
// parking it exists to fix.
export function plotsOnInsertSizeAxis(shape: number) {
  return shape === ARC_SHAPE_FLAT || shape === ARC_SHAPE_FLAT_SPLIT
}
