/**
 * The [start, end) reference span needed for mismatch rendering: the union of
 * every record lacking an MD tag, clamped to the queried viewport. null when
 * every record carries MD, so no reference fetch is needed at all. Clamping
 * here keeps a whole-chromosome contig alignment from fetching sequence outside
 * the visible slice (the mismatch walk is windowed to the same region).
 *
 * One base of slack on the right. A soft/hard clip sits AT its read's end
 * position and consumes no reference, but the unwindowed mismatch walk bounds
 * itself by what the fetched reference covers (`ref.length - refOffset`) with an
 * exclusive right edge — so without the slack the last read to end inside the
 * span loses its trailing clip. Applied here rather than at one call site so
 * BAM and SAM can't disagree about it; still clamped to `regionEnd`, since a
 * read reaching the region edge has nothing to the right worth fetching.
 */
export function seqFetchSpan(
  records: readonly { NUMERIC_MD: unknown; start: number; end: number }[],
  regionStart: number,
  regionEnd: number,
) {
  let start = Infinity
  let end = 0
  for (const record of records) {
    if (!record.NUMERIC_MD) {
      start = Math.min(start, record.start)
      end = Math.max(end, record.end)
    }
  }
  return start !== Infinity
    ? { start: Math.max(start, regionStart), end: Math.min(end + 1, regionEnd) }
    : null
}
