import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { getInsertSizeStats, widenBandToEventScale } from './insertSizeStats.ts'
import { getFlags } from './util.ts'

import type { Feature } from '@jbrowse/core/util'

const PRIMARY_PROPER_PAIR_MASK = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY

function isPrimaryProperPair(flags: number) {
  return !!(flags & SAM_FLAG_PROPER_PAIR) && !(flags & PRIMARY_PROPER_PAIR_MASK)
}

/**
 * Insert-size stats (robust median ± 3·1.4826·MAD, widened to the event scale
 * — see getInsertSizeStats and widenBandToEventScale) from primary proper-pair
 * reads only. This is the band anything COLORS from, which is why the floor is
 * applied here and not in the statistics. |TLEN| is the chain denominator
 * (template length) too, so pileup and chain share one scale.
 *
 * The caller passes the region's sample (`sampleFeatures`: deduped, MAPQ
 * passed), ahead of the category filters and facet sections. The band
 * describes the library: a filter that keeps only the discordant pairs still
 * colors them against the concordant ones it hid, and every stacked section
 * colors on one scale.
 *
 * Returns undefined — no insert-size coloring at all, as for unpaired data —
 * when the sample yields a collapsed `upper === lower` band. One proper pair, or
 * a handful that happen to share a TLEN, drives both MAD and sd to 0 and pins
 * the band to a single value, which classifies every *other* read in the view as
 * a long or short outlier and floods the pileup red/pink. A band with no width
 * carries no information, so it is better to paint nothing than to paint that.
 */
export function computePairedInsertSizeStats(features: readonly Feature[]) {
  // An Int32Array because |TLEN| is int32, and an integer typed array is what
  // buys getInsertSizeStats its comparator-free sort (see sortedCopy).
  const sample = new Int32Array(features.length)
  let count = 0
  for (const f of features) {
    if (isPrimaryProperPair(getFlags(f))) {
      const insertSize = Math.abs(
        (f.get('template_length') as number | undefined) ?? 0,
      )
      if (insertSize > 0) {
        sample[count++] = insertSize
      }
    }
  }
  const band =
    count > 0 ? getInsertSizeStats(sample.subarray(0, count)) : undefined
  // Widened AFTER the degenerate check, not before: the check's whole signal is
  // `upper === lower`, and a floor is a widening, so applying it first would
  // turn every collapsed band into a plausible-looking wide one built on a
  // single distinct value.
  return band && band.upper > band.lower
    ? widenBandToEventScale(band)
    : undefined
}
