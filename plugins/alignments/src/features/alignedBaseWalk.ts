import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import type { Region } from '@jbrowse/core/util'

// Walk NUMERIC_CIGAR firing `cb` once per ref-aligned base inside the region.
// `queryOffset` indexes genomic-forward per-base arrays (NUMERIC_QUAL, SEQ)
// directly. Shared by the perBaseQuality and perBaseLetter extractors, which
// differ only in the payload they read at each base.
export function forEachAlignedBaseInRegion(
  cigarOps: ArrayLike<number>,
  start: number,
  region: Region,
  cb: (refPos: number, queryOffset: number) => void,
) {
  const { start: regionStart, end: regionEnd } = region
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
          cb(opStart + m, soffset + m)
        }
      }
      soffset += len
      roffset += len
    }
  }
}
