import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import type { PerBaseLetterEntry } from './types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// Walk CIGAR + read SEQ, emit one entry per ref-aligned base inside the region
// carrying that base's ASCII code. SEQ is stored genomic-forward (same as
// NUMERIC_QUAL), so the query offset that the CIGAR walk tracks indexes it
// directly — mirrors extractPerBaseQuality, swapping the score for the base.
export function extractPerBaseLetter(
  feature: Feature,
  featureId: string,
  region: Region,
  out: PerBaseLetterEntry[],
) {
  const { start: regionStart, end: regionEnd } = region
  const seq = feature.get('seq') as string | undefined
  const cigarOps = feature.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
  if (seq && seq.length > 0 && cigarOps && cigarOps.length > 0) {
    const start = feature.get('start')
    let soffset = 0
    let roffset = 0
    for (let i = 0, l = cigarOps.length; i < l; i++) {
      const packed = cigarOps[i]!
      const len = packed >> 4
      const opIdx = packed & 0xf
      if (opIdx === CIGAR_S || opIdx === CIGAR_I) {
        soffset += len
      } else if (opIdx === CIGAR_D || opIdx === CIGAR_N) {
        roffset += len
      // eslint-disable-next-line unicorn/prefer-includes-over-repeated-comparisons
      } else if (opIdx === CIGAR_M || opIdx === CIGAR_X || opIdx === CIGAR_EQ) {
        const opStart = start + roffset
        if (opStart >= regionEnd) {
          break
        }
        const opEnd = opStart + len
        if (opEnd > regionStart) {
          const visStart = Math.max(0, regionStart - opStart)
          const visEnd = Math.min(len, regionEnd - opStart)
          for (let m = visStart; m < visEnd; m++) {
            // Uppercase ASCII so lowercase soft-masked bases hit the same color
            // switch as the GPU/Canvas base palette (A/C/G/T, else N).
            out.push({
              featureId,
              position: opStart + m,
              base: seq.charCodeAt(soffset + m) & ~0x20,
            })
          }
        }
        soffset += len
        roffset += len
      }
    }
  }
}
