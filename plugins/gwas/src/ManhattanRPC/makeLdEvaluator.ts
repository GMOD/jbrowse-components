import { lookupR2, matchesIndexSnp, posKey } from './ldToIndex.ts'
import { GLYPH_INDEX, GLYPH_INSERTION, GLYPH_POINT } from './rpcTypes.ts'
import { ldBinColor, ldIndexColor } from '../LinearManhattanDisplay/ldBins.ts'

import type { LdToIndex } from './ldToIndex.ts'
import type { Feature } from '@jbrowse/core/util'

// Per-feature LD color + r² to the index SNP from one shared lookup:
//   - color: index SNP is purple (ldIndexColor), partners bin by r², absent → grey
//   - r²:    1 for the index, the looked-up r² for partners, NaN when absent (so
//            the tooltip omits it rather than showing a fake 0)
// color derives entirely from the r² state, so both come from a single
// name/posKey/Map derivation. buildManhattanResult calls evalColor(f) then
// evalR2(f) back-to-back for the same feature, so memoizing on the last feature
// runs that derivation once per point instead of twice, with no per-feature
// allocation.
export function makeLdEvaluator(
  ld: LdToIndex,
  indexSnp: string,
  refName: string,
) {
  let lastFeature: Feature | undefined
  let isIndex = false
  let isInsertion = false
  let r2 = Number.NaN
  function compute(feature: Feature) {
    if (feature !== lastFeature) {
      lastFeature = feature
      const name = feature.get('name')
      const key = posKey(refName, feature.get('start'))
      isIndex = matchesIndexSnp(name, key, indexSnp)
      isInsertion = feature.get('svtype') === 'INS'
      r2 = isIndex ? 1 : (lookupR2(ld, name, key) ?? Number.NaN)
    }
  }
  return {
    evalColor(feature: Feature) {
      compute(feature)
      return isIndex ? ldIndexColor : ldBinColor(r2)
    },
    evalR2(feature: Feature) {
      compute(feature)
      return r2
    },
    // Index SNP renders as the diamond glyph (GLYPH_INDEX) instead of a disc.
    // Non-index insertions keep their triangle so switching to LD coloring
    // doesn't silently flatten insertion SVs into plain discs.
    evalGlyph(feature: Feature) {
      compute(feature)
      return isIndex
        ? GLYPH_INDEX
        : isInsertion
          ? GLYPH_INSERTION
          : GLYPH_POINT
    },
  }
}
