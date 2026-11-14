// A split-read connector joining two segments of a read across segments of it
// the view never fetched: the connector is not a junction of the read, while
// the relation of its two ends is still measured. Worded once for the
// alignments display and the breakpoint split view, so the reader who met this
// finding in one does not have to learn a second phrasing in the other.

export const THROUGH_HIDDEN_LABEL = 'Split read (via a region not shown)'

export function hiddenSegmentsNote(segments: readonly { loc: string }[]) {
  return `passes through ${segments.map(s => s.loc).join(', ')}`
}

/**
 * The hover lines under such a connector's first: the loci it passes through,
 * then how its two ends relate (`relation`, a split class as a noun phrase),
 * left out where that says nothing, as for an inter-chromosomal pair.
 */
export function throughHiddenLines(
  segments: readonly { loc: string }[],
  relation: string | undefined,
) {
  return [
    hiddenSegmentsNote(segments),
    ...(relation === undefined ? [] : [`ends relate as: ${relation}`]),
  ]
}
