import { SAM_FLAG_REVERSE } from '@jbrowse/alignments-core'
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
export function computeReadBaseCounts(
  features: Feature[],
  positions: Set<number>,
) {
  const counts = new Map<number, StrandBaseCounts>()
  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const cigar = f.get('CIGAR') as string | undefined
    if (seq && cigar) {
      const start = f.get('start')
      const fwd =
        (((f.get('flags') as number | undefined) ?? 0) & SAM_FLAG_REVERSE) === 0
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
          for (let j = 0; j < len; j++) {
            const pos = start + refPos + j
            if (positions.has(pos)) {
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
