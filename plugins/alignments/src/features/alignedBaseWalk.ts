import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  parseCigar2Typed,
} from '@jbrowse/cigar-utils'

import type { Feature, Region } from '@jbrowse/core/util'

// A read's CIGAR in the packed `(len << 4) | opIndex` form the walk below
// decodes.
//
// `NUMERIC_CIGAR` is an OPTIONAL optimization, not part of the feature contract:
// BAM/CRAM get it for free out of the binary record, so they hand it over and
// save this a parse. Every other source carries only the text `CIGAR`, and
// parsing that here is what keeps the packed form optional — an adapter that
// omits it renders per-base overlays identically, just a parse slower.
//
// Reading only `NUMERIC_CIGAR` used to make it load-bearing, and silently so:
// the extractors' `cigarOps &&` guard turned a text-only feature into zero
// entries, so per-base-quality / per-base-letter coloring simply didn't paint,
// with no error to explain it.
export function packedCigarOps(
  feature: Feature,
): ArrayLike<number> | undefined {
  const numeric = feature.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
  if (numeric !== undefined) {
    return numeric
  }
  const cigar = feature.get('CIGAR') as string | undefined
  return cigar ? parseCigar2Typed(cigar) : undefined
}

// Walk the packed CIGAR firing `cb` once per ref-aligned base inside the region.
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
