// Split-read junction endpoints, in read (5'→3') coordinates. A read traversing
// segments in read order joins at the trailing (3') edge of one segment and the
// leading (5') edge of the next; on the reference, which genomic coordinate that
// maps to flips with strand. Shared by the alignments arc/linked-read renderers
// and breakpoint-split-view's AlignmentConnections, so the rule lives in one
// place.

// Trailing (3') edge of a segment in read coordinates. Also the mate 3' end for
// a paired read's endpoint.
export function readTrailingBp(strand: number, start: number, end: number) {
  return strand === -1 ? start : end
}

// Leading (5') edge of the next segment in read coordinates — the far side of a
// split junction from the previous segment's trailing edge.
export function readLeadingBp(strand: number, start: number, end: number) {
  return strand === -1 ? end : start
}

// Which way the segment's own aligned body lies from the edge above, as a
// genomic direction: +1 toward higher coordinates, -1 toward lower. This is the
// breakend orientation — "which side of this junction is kept" — and it is
// exactly the choice of edge said the other way round, which is why each of
// these mirrors its `…Bp` partner's ternary line for line rather than being
// written as `-strand` / `strand`. A strand of 0 (a feature with no strand at
// all) reads as forward in both, so the pair cannot disagree about it.
//
// The direction is a property of the JUNCTION, not of the read that crossed it:
// sequencing the same molecule from the other end swaps which segment is
// trailing and flips both strands, and the two flips cancel. That is what makes
// it safe for a mark drawn from arcs several reads were coalesced into.
export function readTrailingBodyDir(strand: number) {
  return strand === -1 ? 1 : -1
}

export function readLeadingBodyDir(strand: number) {
  return strand === -1 ? -1 : 1
}

// The two absolute-bp endpoints of a resolved connection, given each segment's
// strand and genomic [start, end]. Endpoint 1 is always its segment's read-
// trailing (3') edge. Endpoint 2 is the next segment's read-leading (5') edge
// for a split junction (so a fwd→rev inversion lands on the breakpoint, not the
// far edge of the reverse segment), or the mate's read-trailing (3') edge for a
// pair. This is the single endpoint rule shared by every connector renderer —
// the alignments linked-read overlay + coverage arcs and breakpoint-split-view's
// AlignmentConnections — so it can't drift between them.
//
// It returns the two BODY DIRECTIONS with the two bps, and the name is older
// than that half. They ship together because they are one decision: `dir1` is
// trailing iff `bp1` is, so a second function asking `isSplit` again is the
// drift this file exists to prevent. A caller wanting only the coordinates
// ignores them.
export function connectionEndpointBps({
  s1,
  start1,
  end1,
  s2,
  start2,
  end2,
  isSplit,
}: {
  s1: number
  start1: number
  end1: number
  s2: number
  start2: number
  end2: number
  isSplit: boolean
}) {
  return {
    bp1: readTrailingBp(s1, start1, end1),
    bp2: isSplit
      ? readLeadingBp(s2, start2, end2)
      : readTrailingBp(s2, start2, end2),
    dir1: readTrailingBodyDir(s1),
    dir2: isSplit ? readLeadingBodyDir(s2) : readTrailingBodyDir(s2),
  }
}
