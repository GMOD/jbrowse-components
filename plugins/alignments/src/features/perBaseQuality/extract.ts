import { forEachAlignedBaseInRegion } from '../alignedBaseWalk.ts'

import type { PerBaseQualityEntry } from './types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// Walk CIGAR + NUMERIC_QUAL, emit one entry per ref-aligned base inside the
// region. Mirrors origin/main's renderPerBaseQuality but produces position +
// score entries the main thread paints as overlay rects.
export function extractPerBaseQuality(
  feature: Feature,
  readIndex: number,
  region: Region,
  out: PerBaseQualityEntry[],
) {
  // CRAM yields number[] (record.qualityScores), BAM a Uint8Array — both index
  // genomic-forward, so ArrayLike covers them without a lossy cast.
  const scores = feature.get('NUMERIC_QUAL') as ArrayLike<number> | undefined
  const cigarOps = feature.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
  if (scores && scores.length > 0 && cigarOps && cigarOps.length > 0) {
    const start = feature.get('start')
    forEachAlignedBaseInRegion(cigarOps, start, region, (position, q) => {
      out.push({ readIndex, position, score: scores[q]! })
    })
  }
}
