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
 * the same insert size differently between sections. Takes the per-group feature
 * arrays and iterates them in place, so pooling across groups costs no flattened
 * copy of every read.
 *
 * Returns undefined — no insert-size coloring at all, as for unpaired data —
 * when the sample yields a collapsed `upper === lower` band. One proper pair, or
 * a handful that happen to share a TLEN, drives both MAD and sd to 0 and pins
 * the band to a single value, which classifies every *other* read in the view as
 * a long or short outlier and floods the pileup red/pink. A band with no width
 * carries no information, so it is better to paint nothing than to paint that.
 */
export function computePairedInsertSizeStats(groups: FeatureData[][]) {
  const pairedInsertSizes: number[] = []
  for (const features of groups) {
    for (const f of features) {
      if (isPrimaryProperPair(f.flags) && f.insertSize > 0) {
        pairedInsertSizes.push(f.insertSize)
      }
    }
  }
  const band =
    pairedInsertSizes.length > 0
      ? getInsertSizeStats(pairedInsertSizes)
      : undefined
  return band && band.upper > band.lower ? band : undefined
}
