import { lookupR2, matchesIndexSnp, posKey } from './ldToIndex.ts'

import type { LdToIndex } from './ldToIndex.ts'
import type { Feature } from '@jbrowse/core/util'

// Per-feature r² to the index SNP: 1 for the index SNP itself, the looked-up
// r² for partners, NaN when the SNP has no LD record (so the tooltip can omit
// it rather than show a fake 0).
export function makeLdR2Evaluator(
  ld: LdToIndex,
  indexSnp: string,
  refName: string,
): (feature: Feature) => number {
  return feature => {
    const name = feature.get('name')
    const key = posKey(refName, feature.get('start'))
    return matchesIndexSnp(name, key, indexSnp)
      ? 1
      : (lookupR2(ld, name, key) ?? NaN)
  }
}
