import { sharedChildLabelRows } from '../labelUtils.ts'
import { featureType, getSubfeatures } from '../util.ts'
import { layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// CrisprGuideAdapter names the PAM subfeature nothing, so the row reservation
// and the emitted label both spend this literal instead of a name.
export const PAM_LABEL = 'PAM'

export function findPamSubfeature(feature: Feature) {
  return getSubfeatures(feature).find(
    f => featureType(f).toLowerCase() === 'pam',
  )
}

export function layoutCrisprGuide(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  return {
    ...layoutChild(feature, args),
    glyphType: 'CrisprGuide',
    labelRows: sharedChildLabelRows(config, [
      findPamSubfeature(feature) ? PAM_LABEL : undefined,
    ]),
  }
}
