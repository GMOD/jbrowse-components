// A split-read connector joining two segments of a read across segments of it
// the view never fetched: the connector is not a junction of the read, while
// the relation of its two ends is still measured. Worded once for the
// alignments display and the breakpoint split view, so the reader who met this
// finding in one does not have to learn a second phrasing in the other.

export const THROUGH_HIDDEN_LABEL = 'Split read (segment not in view)'

const MAX_KEY_REF_NAMES = 3

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

/**
 * The refNames the hidden segments of every connector given sit on, each
 * once, in first-seen order: connectors in the order given, each one's
 * segments in read order. A refName also in view counts, since its segment
 * is not.
 */
export function throughHiddenRefNames(
  segmentLists: Iterable<readonly { refName: string }[] | undefined>,
) {
  const refNames = new Set<string>()
  for (const segments of segmentLists) {
    for (const { refName } of segments ?? []) {
      refNames.add(refName)
    }
  }
  return refNames
}

/**
 * The key row naming where the reads went, counted past three refNames. The
 * names sort naturally (chr3 before chr10): reads on either strand visit them
 * in opposite orders, so no read order speaks for the row.
 */
export function throughHiddenKeyLabel(refNames: ReadonlySet<string>) {
  const via =
    refNames.size > MAX_KEY_REF_NAMES
      ? `${refNames.size} reference sequences`
      : [...refNames]
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .join(', ')
  return `Split read via ${via} (not in view)`
}
