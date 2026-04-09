import { getFeatureDimensions, getStrandArrowPadding } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const boxGlyph: Glyph = {
  type: 'Box',

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { heightPx, widthPx } = getFeatureDimensions(feature, bpPerPx, configContext)

    // Only top-level boxes get strand arrows; child boxes (inside
    // subfeaturesGlyph) skip them since the parent handles arrows
    const isTopLevel = !feature.parent?.()
    const strand = feature.get('strand') as number
    const arrowPadding = isTopLevel
      ? getStrandArrowPadding(strand)
      : { left: 0, right: 0 }

    return {
      feature,
      glyphType: 'Box',
      x: 0,
      y: 0,
      width: widthPx,
      height: heightPx,
      totalLayoutHeight: heightPx,
      totalLayoutWidth: widthPx + arrowPadding.left + arrowPadding.right,
      leftPadding: arrowPadding.left,
      children: [],
    }
  },
}
