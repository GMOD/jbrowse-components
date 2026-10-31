import {
  forEachAlignedBaseInRegion,
  packedCigarOps,
} from '../alignedBaseWalk.ts'
import { BASE_QUALITY_UNAVAILABLE } from './colors.ts'

import type { PerBaseColumns } from '../alignedBaseWalk.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// Walk CIGAR + NUMERIC_QUAL, emit one entry per sampled ref-aligned base inside
// the region, which the main thread paints as overlay rects. A read with no
// scores (QUAL `*`) emits BASE_QUALITY_UNAVAILABLE at each base, so its bases
// paint the plain read fill and the key names why.
export function extractPerBaseQuality(
  feature: Feature,
  readIndex: number,
  region: Region,
  binBp: number,
  out: PerBaseColumns,
) {
  const scores = feature.get('NUMERIC_QUAL') as Uint8Array | null | undefined
  const cigarOps = packedCigarOps(feature)
  if (cigarOps && cigarOps.length > 0) {
    const start = feature.get('start')
    forEachAlignedBaseInRegion(
      cigarOps,
      start,
      region,
      binBp,
      scores && scores.length > 0
        ? (position, q) => {
            out.push(readIndex, position, scores[q]!)
          }
        : position => {
            out.push(readIndex, position, BASE_QUALITY_UNAVAILABLE)
          },
    )
  }
}
