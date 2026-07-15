import { forEachAlignedBaseInRegion } from '../alignedBaseWalk.ts'

import type { PerBaseLetterEntry } from './types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// Walk CIGAR + read SEQ, emit one entry per ref-aligned base inside the region
// carrying that base's ASCII code. SEQ is stored genomic-forward (same as
// NUMERIC_QUAL), so the query offset that the CIGAR walk tracks indexes it
// directly — mirrors extractPerBaseQuality, swapping the score for the base.
export function extractPerBaseLetter(
  feature: Feature,
  readIndex: number,
  region: Region,
  out: PerBaseLetterEntry[],
) {
  const seq = feature.get('seq') as string | undefined
  const cigarOps = feature.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
  if (seq && seq.length > 0 && cigarOps && cigarOps.length > 0) {
    const start = feature.get('start')
    forEachAlignedBaseInRegion(cigarOps, start, region, (position, q) => {
      out.push({
        readIndex,
        position,
        // Uppercase ASCII so lowercase soft-masked bases hit the same color
        // switch as the GPU/Canvas base palette (A/C/G/T, else N).
        base: seq.charCodeAt(q) & ~0x20,
      })
    })
  }
}
