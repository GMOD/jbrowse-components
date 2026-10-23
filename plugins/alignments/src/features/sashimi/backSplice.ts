import { featurizeSA } from '@jbrowse/cigar-utils'

import type { FeatureData } from '../../shared/webglRpcTypes.ts'

const SUPPLEMENTARY = 0x800
const SECONDARY = 0x100
const MAX_BACK_SPLICE_SPAN = 200_000

interface Segment {
  start: number
  end: number
  clipAtStart: number
}

/**
 * Back-splice junctions from split reads: two consecutive segments of one read,
 * same chromosome and strand, where the later one in the read lies upstream in
 * transcript order. A circRNA read crosses its circle's joint that way, so the
 * junction spans from the upstream segment's start to the downstream one's end.
 * Counted off each primary record, so a read's supplementary twin adds nothing.
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
      { start: f.start, end: f.end, clipAtStart: clipAtStart[i]! },
      ...featurizeSA(sa, '', f.strand, undefined)
        .filter(s => s.refName === refName && s.strand === f.strand)
        .map(s => ({
          start: s.start,
          end: s.end,
          clipAtStart: s.clipLengthAtStartOfRead,
        })),
    ].sort((a, b) => a.clipAtStart - b.clipAtStart)
    for (let k = 1; k < segments.length; k++) {
      const a = segments[k - 1]!
      const b = segments[k]!
      const upstream = f.strand === -1 ? b.start > a.start : b.start < a.start
      const start = Math.min(a.start, b.start)
      const end = Math.max(a.end, b.end)
      if (upstream && end - start <= MAX_BACK_SPLICE_SPAN) {
        const key = `${start}:${end}`
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
