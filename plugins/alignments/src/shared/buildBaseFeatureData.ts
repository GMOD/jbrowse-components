import { pairOrientationToNum, readKeyOf } from '@jbrowse/alignments-core'

import { getFlags, getMappingQuality, getStrand } from './util.ts'

import type { ChainFeatureData, FeatureData } from './webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * `readIdPrefix` is the fetch's verified `${adapter.id}-` (see
 * `readIdPrefixOf`), or undefined when these features have no numeric record id
 * — and it is what decides which form `id` takes. Undefined means read the
 * string, so a numeric key can never exist without a prefix to rebuild its
 * string from.
 */
export function buildBaseFeatureData(
  feature: Feature,
  readIdPrefix: string | undefined,
): FeatureData {
  return {
    id: readIdPrefix === undefined ? feature.id() : readKeyOf(feature),
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

export function buildChainFeatureData(
  feature: Feature,
  readIdPrefix: string | undefined,
): ChainFeatureData {
  return {
    ...buildBaseFeatureData(feature, readIdPrefix),
    name: feature.get('name') ?? '',
    nextRef: feature.get('next_ref') as string | undefined,
  }
}
