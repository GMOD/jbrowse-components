import { pairDirection } from '@jbrowse/alignments-core'

import { getFlags } from './util.ts'

import type { ChainFeatureData, FeatureData } from './webglRpcTypes.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

// GPU-uniform encoding of the shared PairDirection categories (0 = unknown).
const PAIR_DIRECTION_NUM: Record<PairDirection, number> = {
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
  const strand = feature.get('strand')
  return {
    id: feature.id(),
    name: feature.get('name') ?? '',
    start: feature.get('start'),
    end: feature.get('end'),
    flags: getFlags(feature),
    // SAM spec: MAPQ 255 indicates mapping quality is unavailable
    mapq: feature.get('score') ?? 255,
    // SAM spec: TLEN 0 means insert size is unset (e.g. unpaired reads)
    insertSize: Math.abs(
      (feature.get('template_length') as number | undefined) ?? 0,
    ),
    pairOrientation: pairOrientationToNum(
      feature.get('pair_orientation') as string | undefined,
    ),
    strand: strand === -1 ? -1 : strand === 1 ? 1 : 0,
  }
}

export function buildChainFeatureData(feature: Feature): ChainFeatureData {
  return {
    ...buildBaseFeatureData(feature),
    nextRef: feature.get('next_ref') as string | undefined,
  }
}
