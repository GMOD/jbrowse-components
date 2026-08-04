import { pairDirection } from '@jbrowse/alignments-core'

import { getFlags, getMappingQuality, getStrand } from './util.ts'

import type { ChainFeatureData, FeatureData } from './webglRpcTypes.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

// GPU-uniform encoding of the shared PairDirection categories (0 = unknown).
// Also the linked-read connector's color index: `pairedColorType` passes an
// orientNum straight through as a palette slot, so features/linkedReads
// derives its LINKED_READ_COLOR_PAIR_* from this rather than restating it.
export const PAIR_DIRECTION_NUM: Record<PairDirection, number> = {
  LR: 1,
  RL: 2,
  RR: 3,
  LL: 4,
}

function pairOrientationToNum(pairOrientation: string | undefined) {
  const dir = pairDirection(pairOrientation)
  return dir ? PAIR_DIRECTION_NUM[dir] : 0
}

export function buildBaseFeatureData(feature: Feature): FeatureData {
  return {
    id: feature.id(),
    name: feature.get('name') ?? '',
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

export function buildChainFeatureData(feature: Feature): ChainFeatureData {
  return {
    ...buildBaseFeatureData(feature),
    nextRef: feature.get('next_ref') as string | undefined,
  }
}
