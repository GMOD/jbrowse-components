import { sharedChildLabelRows } from '../labelUtils.ts'
import { featureType, getSubfeatures } from '../util.ts'
import { layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// The one child the guide's emitter overpaints and registers. Shared with that
// emitter so the row reserved below and the label drawn in it cannot disagree
// about whether there is a PAM at all: the label is this literal, not the
// subfeature's name — CrisprGuideAdapter gives it none.
export const PAM_LABEL = 'PAM'

export function findPamSubfeature(feature: Feature) {
  return getSubfeatures(feature).find(
    f => featureType(f).toLowerCase() === 'pam',
  )
}

// A CRISPR guide RNA (from CrisprGuideAdapter): a single-row glyph drawn as the
// protospacer box with the PAM overpainted in a distinct color and the predicted
// cut site marked. Geometry is a plain leaf box; the emitter reads the PAM
// subfeature and the `cutSite` attribute off the feature.
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
