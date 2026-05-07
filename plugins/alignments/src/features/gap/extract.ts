import type { Mismatch } from '../../shared/types.ts'
import type { GapData } from '../../shared/webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

function getEffectiveStrand(feature: Feature) {
  const tags = feature.get('tags') as Record<string, string> | undefined
  const fstrand = feature.get('strand') ?? 0
  const xs = tags?.XS || tags?.TS
  const ts = tags?.ts
  if (xs === '+') {
    return 1
  } else if (xs === '-') {
    return -1
  }
  return (ts === '+' ? 1 : ts === '-' ? -1 : 0) * fstrand
}

export function emitGap(
  mm: Extract<Mismatch, { type: 'deletion' | 'skip' }>,
  featureId: string,
  featureStart: number,
  strand: number,
  feature: Feature,
  gapsData: GapData[],
) {
  if (mm.type === 'deletion') {
    gapsData.push({
      featureId,
      start: featureStart + mm.start,
      end: featureStart + mm.start + mm.length,
      type: mm.type,
      strand,
      featureStrand: strand,
    })
  } else {
    gapsData.push({
      featureId,
      start: featureStart + mm.start,
      end: featureStart + mm.start + mm.length,
      type: mm.type,
      strand: getEffectiveStrand(feature),
      featureStrand: strand,
    })
  }
}
