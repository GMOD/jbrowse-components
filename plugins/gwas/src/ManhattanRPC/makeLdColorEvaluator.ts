import { posKey } from './ldToIndex.ts'
import { ldBinColor, ldIndexColor } from '../LinearManhattanDisplay/ldBins.ts'

import type { LdToIndex } from './ldToIndex.ts'
import type { Feature } from '@jbrowse/core/util'

// Per-feature ABGR color for LD mode: the index SNP is purple, every other
// point is binned by its r² to the index (grey when absent from the LD data).
// Same `(feature) => number` shape as makeColorEvaluator so buildManhattanResult
// is reused unchanged.
export function makeLdColorEvaluator(
  ld: LdToIndex,
  indexSnp: string,
  refName: string,
): (feature: Feature) => number {
  return feature => {
    const name = feature.get('name')
    const key = posKey(refName, feature.get('start'))
    if (name === indexSnp || key === indexSnp) {
      return ldIndexColor
    }
    const r2 =
      (name !== undefined ? ld.r2ByKey.get(name) : undefined) ??
      ld.r2ByKey.get(key)
    return ldBinColor(r2)
  }
}
