import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  parseCigar2,
} from '@jbrowse/cigar-utils'

import { getStrand } from '../../shared/util.ts'

import type { StrandBaseCounts } from '../../shared/calculateModificationCounts.ts'
import type { Feature } from '@jbrowse/core/util'

// Per-strand read-base pileup at the given genomic positions, built from each
// read's own sequence — no reference needed. modCoverage uses it as the
// modifiable/detectable denominator: at a cytosine it counts the reads showing
// C or G per strand, exactly as IGV's DenseAlignmentCounts does
// (BaseModificationCoverageRenderer reads getCount(pos, base) + complement off
// this same read-base pileup). SEQ is stored forward-reference-oriented, so the
// base read here is already in the forward frame.
//
// Restricted to `positions` (the modified columns) so it costs one CIGAR walk
// per read with map work only where a modification exists, rather than a full
// region-wide pileup.
//
// Membership is a `Uint8Array` index rather than a `Set<number>` probe, because
// the walk performs one per base of every `M`/`=`/`X` operation of every read.
// Worth 2.4x here, and this function was 33% of the RPC worker's busy time on
// `200x.longread.mod.bam` — the largest single cost in the modification render
// path.
//
// Each `M`/`=`/`X` operation is clamped to its overlap with `[minPos, maxPos]`,
// which is worth keeping for a different reason than it looks. It is NOT
// skipping distant bases: measured that way it is 1.01x, because the span of
// modified columns is set by the reads carrying them, so it tracks the extent
// of the reads (145 kb here against a 49 kb mean read length) rather than the
// width of the view, and a read can hardly ever reach outside it. What the
// clamp buys is that every position the loop then visits is known to be in
// range, so the bounds test does not have to run per base — 2.5x against 2.2x
// for the same bitmap with an inline `pos >= minPos && pos <= maxPos`.
//
// The bitmap is skipped for a span too wide to allocate for, so a sparse modBAM
// at a wide zoom cannot turn one render into a hundred-megabyte allocation.
// Measured as free: the check is on a loop-invariant local.
const MAX_BITMAP_SPAN = 1 << 22

export function computeReadBaseCounts(
  features: Feature[],
  positions: Set<number>,
) {
  const counts = new Map<number, StrandBaseCounts>()
  if (positions.size === 0) {
    return counts
  }
  let minPos = Number.POSITIVE_INFINITY
  let maxPos = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (p < minPos) {
      minPos = p
    }
    if (p > maxPos) {
      maxPos = p
    }
  }
  const span = maxPos - minPos + 1
  const wanted = span <= MAX_BITMAP_SPAN ? new Uint8Array(span) : undefined
  if (wanted) {
    for (const p of positions) {
      wanted[p - minPos] = 1
    }
  }

  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const cigar = f.get('CIGAR') as string | undefined
    if (seq && cigar) {
      const start = f.get('start')
      const fwd = getStrand(f) !== -1
      const ops = parseCigar2(cigar)
      let readPos = 0
      let refPos = 0
      for (let i = 0, l = ops.length; i < l; i++) {
        const packed = ops[i]!
        const len = packed >> 4
        const op = packed & 0xf
        if (op === CIGAR_S || op === CIGAR_I) {
          readPos += len
        } else if (op === CIGAR_D || op === CIGAR_N) {
          refPos += len
        } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
          // clamp to the overlap with [minPos, maxPos], so every `pos` below is
          // in range and the bitmap can be indexed without a bounds test.
          // `readPos + j` stays aligned because M/=/X advance read and
          // reference together
          const opRef = start + refPos
          let j = minPos - opRef
          if (j < 0) {
            j = 0
          }
          let jEnd = maxPos - opRef + 1
          if (jEnd > len) {
            jEnd = len
          }
          for (; j < jEnd; j++) {
            const pos = opRef + j
            if (wanted ? wanted[pos - minPos] === 1 : positions.has(pos)) {
              const base = seq[readPos + j]?.toUpperCase()
              if (base) {
                let sc = counts.get(pos)
                if (!sc) {
                  sc = {}
                  counts.set(pos, sc)
                }
                const entry = (sc[base] ??= { fwd: 0, rev: 0 })
                if (fwd) {
                  entry.fwd++
                } else {
                  entry.rev++
                }
              }
            }
          }
          readPos += len
          refPos += len
        }
      }
    }
  }
  return counts
}
