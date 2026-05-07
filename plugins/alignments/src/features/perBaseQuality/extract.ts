import { parseCigar2 } from '../../MismatchParser/index.ts'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '../../shared/cigarUtil.ts'

import type { PerBaseQualityEntry } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

// Walk CIGAR + NUMERIC_QUAL, emit one entry per ref-aligned base inside the
// region. Mirrors origin/main's renderPerBaseQuality but produces position +
// score entries the main thread paints as overlay rects.
export function extractPerBaseQuality(
  feature: Feature,
  featureId: string,
  regionStart: number,
  regionEnd: number,
  out: PerBaseQualityEntry[],
) {
  const scores = feature.get('NUMERIC_QUAL') as Uint8Array | undefined
  const cigarString = feature.get('CIGAR') as string | undefined
  if (scores && scores.length > 0 && cigarString) {
    const start = feature.get('start')
    const cigarOps = parseCigar2(cigarString)
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
            out.push({
              featureId,
              position: opStart + m,
              score: scores[soffset + m]!,
            })
          }
        }
        soffset += len
        roffset += len
      }
    }
  }
}
