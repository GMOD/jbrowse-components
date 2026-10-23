import { featurizeSA } from '@jbrowse/cigar-utils'

import type { FeatureData } from '../../shared/webglRpcTypes.ts'

const SUPPLEMENTARY = 0x800
const SECONDARY = 0x100
const MAX_BACK_SPLICE_SPAN = 200_000

interface Segment {
  refName: string
  strand: number
  start: number
  end: number
  clipAtStart: number
}

/**
 * Back-splice junctions from split reads: two consecutive segments of one read,
 * same chromosome and strand, where the later one in the read starts no further
 * downstream in transcript order than the earlier one. A circRNA read crosses
 * its circle's joint that way, so the junction runs from the earlier segment's
 * end back to the later one's start; a rolling-circle read crosses it once per
 * pass and counts once. Counted off each primary record, so a read's
 * supplementary twin adds nothing.
 */
export function computeBackSpliceJunctions(
  refName: string,
  features: readonly FeatureData[],
  suppAlignments: readonly string[] | undefined,
  clipAtStart: readonly number[],
) {
  const counts = new Map<string, { start: number; end: number; n: number }>()
  if (!suppAlignments) {
    return counts
  }
  for (const [i, f] of features.entries()) {
    const sa = suppAlignments[i]
    if (!sa || f.flags & (SUPPLEMENTARY | SECONDARY)) {
      continue
    }
    const segments: Segment[] = [
      {
        refName,
        strand: f.strand,
        start: f.start,
        end: f.end,
        clipAtStart: clipAtStart[i]!,
      },
      ...featurizeSA(sa, '', f.strand, undefined).map(s => ({
        refName: s.refName,
        strand: s.strand,
        start: s.start,
        end: s.end,
        clipAtStart: s.clipLengthAtStartOfRead,
      })),
    ].sort((a, b) => a.clipAtStart - b.clipAtStart)
    const seen = new Set<string>()
    for (let k = 1; k < segments.length; k++) {
      const a = segments[k - 1]!
      const b = segments[k]!
      if (
        a.refName !== refName ||
        b.refName !== refName ||
        a.strand !== b.strand
      ) {
        continue
      }
      const reverse = a.strand === -1
      const backward = reverse ? b.end >= a.end : b.start <= a.start
      const start = reverse ? a.start : b.start
      const end = reverse ? b.end : a.end
      const key = `${start}:${end}`
      if (
        backward &&
        end > start &&
        end - start <= MAX_BACK_SPLICE_SPAN &&
        !seen.has(key)
      ) {
        seen.add(key)
        const j = counts.get(key)
        if (j) {
          j.n++
        } else {
          counts.set(key, { start, end, n: 1 })
        }
      }
    }
  }
  return counts
}
