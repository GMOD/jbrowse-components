import { pairOrientationToNum } from './webglRpcUtils.ts'

import type { FeatureData } from './webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

export function buildBaseFeatureData(feature: Feature): FeatureData {
  const strand = feature.get('strand')
  const qualArray = feature.get('NUMERIC_QUAL') as
    | Uint8Array
    | number[]
    | undefined
  let avgBaseQuality = 30
  if (qualArray && qualArray.length > 0) {
    let sum = 0
    for (const q of qualArray) {
      sum += q
    }
    avgBaseQuality = Math.round(sum / qualArray.length)
  }
  return {
    id: feature.id(),
    name: feature.get('name') ?? '',
    start: feature.get('start'),
    end: feature.get('end'),
    flags: feature.get('flags') ?? 0,
    mapq: feature.get('score') ?? feature.get('qual') ?? 60,
    avgBaseQuality,
    insertSize: Math.abs(feature.get('template_length') ?? 400),
    pairOrientation: pairOrientationToNum(feature.get('pair_orientation')),
    strand: strand === -1 ? -1 : strand === 1 ? 1 : 0,
  }
}
