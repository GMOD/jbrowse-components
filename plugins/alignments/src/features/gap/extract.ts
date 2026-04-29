import { getEffectiveStrand } from '../../shared/webglRpcUtils.ts'

import type { Mismatch } from '../../shared/types.ts'
import type { GapData } from '../../shared/webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

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
