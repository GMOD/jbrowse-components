import { getInsertSizeStats } from './insertSizeStats.ts'
import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from './samFlags.ts'

import type { FeatureData } from './webglRpcTypes.ts'

/**
 * Insert-size stats from primary proper-pair reads only. Pileup uses this to
 * gate the insert-size color scale. Chain mode uses chainStats from
 * buildChainMetadata instead — different denominator (template length per
 * chain vs primary read insert size).
 */
export function computePairedInsertSizeStats(features: FeatureData[]) {
  const PRIMARY_PROPER_PAIR_MASK = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY
  const pairedInsertSizes: number[] = []
  for (const f of features) {
    if (
      f.flags & SAM_FLAG_PROPER_PAIR &&
      !(f.flags & PRIMARY_PROPER_PAIR_MASK)
    ) {
      pairedInsertSizes.push(f.insertSize)
    }
  }
  return pairedInsertSizes.length > 0
    ? getInsertSizeStats(pairedInsertSizes)
    : undefined
}
