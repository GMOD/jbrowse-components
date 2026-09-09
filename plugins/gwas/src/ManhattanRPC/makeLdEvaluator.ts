import { GLYPH_DIAMOND } from '@jbrowse/render-core/shaders/pointMarkConsts'

import { ldBinColor, ldIndexColor } from '../LinearManhattanDisplay/ldBins.ts'
import { lookupR2, matchesIndexSnp, posKey } from './ldToIndex.ts'
import { defaultGlyph } from './rpcTypes.ts'

import type { LdToIndex } from './ldToIndex.ts'
import type { Feature } from '@jbrowse/core/util'

// Per-feature LD color, glyph and r² to the index SNP from one shared lookup:
//   - color: index SNP is purple (ldIndexColor), partners bin by r², absent → grey
//   - glyph: the index is the diamond; everything else keeps its normal glyph
//   - r²:    1 for the index, the looked-up r² for partners, NaN when absent (so
//            the tooltip omits it rather than showing a fake 0)
// All three derive from the r² state, so they come from a single
// name/posKey/Map derivation, memoized on the last feature: the encoder reads
// color and glyph back-to-back for one feature, and the r² pass that follows
// it derives once more per point.
export function makeLdEvaluator(
  ld: LdToIndex,
  indexSnp: string,
  refName: string,
) {
  let lastFeature: Feature | undefined
  let isIndex = false
  let r2 = Number.NaN
  function compute(feature: Feature) {
    if (feature !== lastFeature) {
      lastFeature = feature
      const name = feature.get('name')
      const key = posKey(refName, feature.get('start'))
      isIndex = matchesIndexSnp(name, key, indexSnp)
      r2 = isIndex ? 1 : (lookupR2(ld, name, key) ?? Number.NaN)
    }
  }
  return {
    color(feature: Feature) {
      compute(feature)
      return isIndex ? ldIndexColor : ldBinColor(r2)
    },
    r2(feature: Feature) {
      compute(feature)
      return r2
    },
    glyph(feature: Feature) {
      compute(feature)
      return isIndex ? GLYPH_DIAMOND : defaultGlyph(feature)
    },
  }
}
