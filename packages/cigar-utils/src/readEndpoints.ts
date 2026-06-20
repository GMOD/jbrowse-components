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
