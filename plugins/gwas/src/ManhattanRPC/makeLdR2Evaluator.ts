import { posKey } from './ldToIndex.ts'

import type { LdToIndex } from './ldToIndex.ts'
import type { Feature } from '@jbrowse/core/util'

// Per-feature r² to the index SNP, parallel to makeLdColorEvaluator's lookup:
// 1 for the index SNP itself, the looked-up r² for partners, NaN when the SNP
// has no LD record (so the tooltip can omit it rather than show a fake 0).
export function makeLdR2Evaluator(
  ld: LdToIndex,
  indexSnp: string,
  refName: string,
): (feature: Feature) => number {
  return feature => {
    const name = feature.get('name')
    const key = posKey(refName, feature.get('start'))
    if (name === indexSnp || key === indexSnp) {
      return 1
    }
    const r2 =
      (name !== undefined ? ld.r2ByKey.get(name) : undefined) ??
      ld.r2ByKey.get(key)
    return r2 ?? NaN
  }
}
