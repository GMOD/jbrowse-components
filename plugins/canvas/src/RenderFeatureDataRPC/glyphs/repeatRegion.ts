import { sharedChildLabelRows, subfeatureLabelText } from '../labelUtils.ts'
import { featureType, getSubfeatures } from '../util.ts'
import { layoutContainerGlyph } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Matched case-insensitively: EDTA and LTR_retriever agree on the SO casing,
// but hand-edited and converted annotations don't always.
export function isRepeatRegion(feature: Feature) {
  return (
    featureType(feature).toLowerCase() === 'repeat_region' &&
    getSubfeatures(feature).length > 0
  )
}

export function layoutRepeatRegion(args: LayoutArgs): FeatureLayout {
  const { config, jexl } = args
  const layout = layoutContainerGlyph(
    'RepeatRegion',
    args,
    getSubfeatures(args.feature),
  )
  return {
    ...layout,
    // The subparts share one body row, so their labels share one row under it,
    // and this layout is what reserves it — no child layout owns a row here.
    labelRows: sharedChildLabelRows(
      config,
      layout.children.map(child =>
        subfeatureLabelText(child.feature, config, jexl),
      ),
    ),
  }
}
