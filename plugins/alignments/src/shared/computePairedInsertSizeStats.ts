import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { getInsertSizeStats, widenBandToEventScale } from './insertSizeStats.ts'

import type { FeatureData } from './webglRpcTypes.ts'

const PRIMARY_PROPER_PAIR_MASK = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY

function isPrimaryProperPair(flags: number) {
  return !!(flags & SAM_FLAG_PROPER_PAIR) && !(flags & PRIMARY_PROPER_PAIR_MASK)
}

/**
 * Insert-size stats (robust median ± 3·1.4826·MAD, widened to the event scale
 * — see getInsertSizeStats and widenBandToEventScale) from primary proper-pair
 * reads only. This is the band anything COLOURS from, which is why the floor is
 * applied here and not in the statistics. `insertSize` is
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
  let count = 0
  for (const features of groups) {
    for (const f of features) {
      if (isPrimaryProperPair(f.flags) && f.insertSize > 0) {
        count++
      }
    }
  }
  // Counted first so the sample lands in one exact-size Int32Array rather than a
  // growing number[]: |TLEN| is int32, and an integer typed array is what buys
  // getInsertSizeStats its comparator-free sort (see sortedCopy).
  const pairedInsertSizes = new Int32Array(count)
  let i = 0
  for (const features of groups) {
    for (const f of features) {
      if (isPrimaryProperPair(f.flags) && f.insertSize > 0) {
        pairedInsertSizes[i++] = f.insertSize
      }
    }
  }
  const band = count > 0 ? getInsertSizeStats(pairedInsertSizes) : undefined
  // Widened AFTER the degenerate check, not before: the check's whole signal is
  // `upper === lower`, and a floor is a widening, so applying it first would
  // turn every collapsed band into a plausible-looking wide one built on a
  // single distinct value.
  return band && band.upper > band.lower
    ? widenBandToEventScale(band)
    : undefined
}
