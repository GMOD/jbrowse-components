import { SAM_FLAG_UNMAPPED } from '@jbrowse/cigar-utils'

/**
 * The [start, end) reference span needed for mismatch rendering: the union of
 * every aligned record lacking an MD tag, clamped to the queried viewport. null
 * when every one carries MD, so no reference fetch is needed at all. Clamping
 * here keeps a whole-chromosome contig alignment from fetching sequence outside
 * the visible slice (the mismatch walk is windowed to the same region).
 *
 * An unmapped read has nothing to compare, and aligners place one without
 * writing it an MD, so counting it opened BAM's sticky `needsReference` on
 * files whose every aligned read carries MD.
 *
 * Clamping loses nothing: `extractFeatureArrays` walks a base past each region
 * edge, but the walk compares a base only where this slice holds one.
 */
export function seqFetchSpan(
  records: readonly {
    NUMERIC_MD: unknown
    flags: number
    start: number
    end: number
  }[],
  regionStart: number,
  regionEnd: number,
) {
  let start = Infinity
  let end = 0
  for (const record of records) {
    if (!record.NUMERIC_MD && !(record.flags & SAM_FLAG_UNMAPPED)) {
      start = Math.min(start, record.start)
      end = Math.max(end, record.end)
    }
  }
  return start !== Infinity
    ? { start: Math.max(start, regionStart), end: Math.min(end, regionEnd) }
    : null
}
