import {
  forEachAlignedBaseInRegion,
  packedCigarOps,
} from '../alignedBaseWalk.ts'

import type { PerBaseQualityEntry } from './types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// Walk CIGAR + NUMERIC_QUAL, emit one entry per sampled ref-aligned base inside
// the region. Mirrors origin/main's renderPerBaseQuality but produces position +
// score entries the main thread paints as overlay rects.
export function extractPerBaseQuality(
  feature: Feature,
  readIndex: number,
  region: Region,
  binBp: number,
  out: PerBaseQualityEntry[],
) {
  // Both adapters store scores as a genomic-forward Uint8Array (BAM: qual
  // subarray, CRAM: record.qualityScores), null when quality is absent.
  const scores = feature.get('NUMERIC_QUAL') as Uint8Array | null | undefined
  const cigarOps = packedCigarOps(feature)
  if (scores && scores.length > 0 && cigarOps && cigarOps.length > 0) {
    const start = feature.get('start')
    forEachAlignedBaseInRegion(
      cigarOps,
      start,
      region,
      binBp,
      (position, q) => {
        out.push({ readIndex, position, score: scores[q]! })
      },
    )
  }
}
