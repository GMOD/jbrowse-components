// Where a comparative feature's CIGAR walk begins, and which way each axis
// steps — the four arguments `visitCigarRenderedSegments` cannot derive for
// itself, since it is handed bare coordinates. Named for the parameters they
// feed: `bp1`/`rev1` are the anchor axis, `bp2`/`rev2` the mate.
//
// Both comparative views project a feature into the same four cumBp lanes: p11
// -> p12 is the anchor's span in the DRAWN direction (their workers swap the
// two for a reverse-strand feature so a ribbon crosses and a dotplot line runs
// anti-diagonal), and p21 -> p22 is the mate's, always start -> end.
//
// That swap is exactly what makes the walk's start corner not the (p11, p21)
// one. PAF writes a '-' strand `cg` in ANCHOR-FORWARD order with the mate
// walking backward, so op 0 sits at (anchor start, mate end) — which after the
// swap is (p12, p22). Beginning at (p11, p21) and stepping backward instead
// traverses the same line and lands on the same endpoints, so the drawn shape's
// extent is right and only the interior is wrong: every indel comes out
// mirrored through the block's centre. `clipSyntenyFeature` documents the same
// failure from the other side ("a deletion lands at its mirror-image position"),
// and the dotplot shipped it for real.
//
// Region orientation is read off the endpoints rather than assumed — an axis
// showing a reversed displayed region (auto-diagonalize flips query regions)
// lays out with cumBp decreasing, and that is independent of strand. Strand
// decides only which END the walk starts from.
//
// FOUR SCALARS, not one object, and that is measured:
// `plugins/dotplot-view/benches/cigarWalkStart.bench.ts` A/Bs the two against
// the loop that calls them. Returning `{bp1, bp2, rev1, rev2}` costs 1.43-1.46x
// on the derivation in isolation — V8 does not scalar-replace it — and shows as
// ~1.07x against a 1.02 control on a realistic geometry pass. These come back at
// or below the control on the same rows. Same shape and same reason as
// `dotplotProject.ts`'s `cumBpToPxH`/`cumBpToPxV`, which sit in the loop next
// door. Recomputing the strand test in each is what buys that; it is two
// compares.
//
// **Call them behind the caller's own draw-detail gate**, not above it. A
// feature too narrow to walk is drawn as one flat line and never asks where its
// CIGAR would have started, and at whole-genome zoom that is nearly all of them
// — the worker ships CIGARs within 8x zoom headroom that the geometry builder is
// then too zoomed out to walk. Hoisting the derivation above the gate, which is
// how both call sites had it, cost the same bench 1.26x (0.794 the other way) at
// 98% flat.

export function cigarWalkBp1(p11: number, p12: number, strand: number) {
  return strand === -1 ? p12 : p11
}

export function cigarWalkBp2(p21: number, p22: number, strand: number) {
  return strand === -1 ? p22 : p21
}

export function cigarWalkRev1(p11: number, p12: number, strand: number) {
  return (strand === -1 ? p12 < p11 : p11 < p12) ? 1 : -1
}

export function cigarWalkRev2(p21: number, p22: number, strand: number) {
  return (p21 < p22 ? 1 : -1) * (strand === -1 ? -1 : 1)
}
