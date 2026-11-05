import { pairOrientationToNum, readKeyOf } from '@jbrowse/alignments-core'

import { getFlags, getMappingQuality, getStrand } from './util.ts'

import type { FeatureData } from './webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * `numericKeys` is `recordIdsAreIds` over the fetch, and decides which form
 * `id` takes, so a numeric key exists only where it spells the read's id.
 */
export function buildBaseFeatureData(
  feature: Feature,
  numericKeys: boolean,
): FeatureData {
  return {
    id: numericKeys ? readKeyOf(feature) : feature.id(),
    start: feature.get('start'),
    end: feature.get('end'),
    flags: getFlags(feature),
    mapq: getMappingQuality(feature),
    // SAM spec: TLEN 0 means insert size is unset (e.g. unpaired reads)
    insertSize: Math.abs(
      (feature.get('template_length') as number | undefined) ?? 0,
    ),
    pairOrientation: pairOrientationToNum(
      feature.get('pair_orientation') as string | undefined,
    ),
    // The normalization lives in getStrand, so `readStrands` and every
    // feature-side strand read resolve it identically.
    strand: getStrand(feature),
  }
}
