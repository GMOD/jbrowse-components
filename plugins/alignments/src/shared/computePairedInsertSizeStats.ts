import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import { getInsertSizeStats } from './insertSizeStats.ts'

import type { ChainFeatureData, FeatureData } from './webglRpcTypes.ts'

const PRIMARY_PROPER_PAIR_MASK = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY

function isPrimaryProperPair(flags: number) {
  return !!(flags & SAM_FLAG_PROPER_PAIR) && !(flags & PRIMARY_PROPER_PAIR_MASK)
}

/**
 * Insert-size stats (mean ± 3 SD color thresholds) from primary proper-pair
 * reads only. The insert-size distribution is a property of the whole fetched
 * read set, so the caller pools every read of a region (across groups) and feeds
 * one shared scale to all stacked sections — not a per-group denominator that
 * would color the same insert size differently between sections.
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

/**
 * Chain-mode counterpart to computePairedInsertSizeStats: same primary
 * proper-pair filter, but keyed on template length (the chain denominator)
 * rather than the per-read insert-size field. Pooled across the region's chains
 * by the caller for the same shared-scale reason.
 */
export function computeChainInsertSizeStats(features: ChainFeatureData[]) {
  const tlens: number[] = []
  for (const f of features) {
    const tlen = f.templateLength
    if (isPrimaryProperPair(f.flags) && tlen !== 0 && !Number.isNaN(tlen)) {
      tlens.push(Math.abs(tlen))
    }
  }
  return tlens.length > 0 ? getInsertSizeStats(tlens) : undefined
}
