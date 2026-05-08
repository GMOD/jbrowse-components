import type { ChainFeatureData, FeatureData } from './webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

function pairOrientationToNum(pairOrientation: string | undefined) {
  switch (pairOrientation) {
    case 'F1R2':
    case 'F2R1':
      return 1
    case 'R1F2':
    case 'R2F1':
      return 2
    case 'F1F2':
    case 'F2F1':
      return 4
    case 'R1R2':
    case 'R2R1':
      return 3
    default:
      return 0
  }
}

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
    // SAM spec: MAPQ 255 indicates mapping quality is unavailable
    mapq: feature.get('score') ?? 255,
    avgBaseQuality,
    insertSize: Math.abs(feature.get('template_length') ?? 400),
    pairOrientation: pairOrientationToNum(feature.get('pair_orientation')),
    strand: strand === -1 ? -1 : strand === 1 ? 1 : 0,
  }
}

export function buildChainFeatureData(feature: Feature): ChainFeatureData {
  return {
    ...buildBaseFeatureData(feature),
    refName: feature.get('refName'),
    nextRef: feature.get('next_ref') as string | undefined,
    pairOrientationStr: feature.get('pair_orientation') as string | undefined,
    templateLength: (feature.get('template_length') as number | undefined) ?? 0,
  }
}
