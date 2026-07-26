/**
 * The [start, end) reference span needed for mismatch rendering: the union of
 * every record lacking an MD tag, clamped to the queried viewport. null when
 * every record carries MD, so no reference fetch is needed at all. Clamping
 * here keeps a whole-chromosome contig alignment from fetching sequence outside
 * the visible slice (the mismatch walk is windowed to the same region).
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
    ? { start: Math.max(start, regionStart), end: Math.min(end, regionEnd) }
    : null
}
