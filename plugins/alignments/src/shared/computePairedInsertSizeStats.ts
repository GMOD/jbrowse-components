import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import { getInsertSizeStats } from './insertSizeStats.ts'

import type { FeatureData } from './webglRpcTypes.ts'

const PRIMARY_PROPER_PAIR_MASK = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY

function isPrimaryProperPair(flags: number) {
  return !!(flags & SAM_FLAG_PROPER_PAIR) && !(flags & PRIMARY_PROPER_PAIR_MASK)
}

/**
 * Insert-size stats (robust median ± 3·1.4826·MAD color thresholds; see
 * getInsertSizeStats) from primary proper-pair reads only. `insertSize` is
 * already `abs(template_length)`, so this is the
 * chain denominator (template length) too — pileup and chain share one scale.
 * The insert-size distribution is a property of the whole fetched read set, so
 * the caller pools every read of a region (across groups) and feeds one shared
 * scale to all stacked sections — not a per-group denominator that would color
 * the same insert size differently between sections.
 */
export function computePairedInsertSizeStats(features: FeatureData[]) {
  const pairedInsertSizes: number[] = []
  for (const f of features) {
    if (isPrimaryProperPair(f.flags) && f.insertSize > 0) {
      pairedInsertSizes.push(f.insertSize)
    }
  }
  return pairedInsertSizes.length > 0
    ? getInsertSizeStats(pairedInsertSizes)
    : undefined
}
