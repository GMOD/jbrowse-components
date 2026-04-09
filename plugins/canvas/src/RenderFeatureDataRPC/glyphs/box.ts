import { readCachedConfig } from '../renderConfig.ts'
import { getStrandArrowPadding } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const boxGlyph: Glyph = {
  type: 'Box',

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, featureHeight, heightMultiplier } = configContext

    const heightPx = readCachedConfig(featureHeight, config, 'featureHeight', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (feature.get('end') - feature.get('start')) / bpPerPx

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
      height: baseHeightPx,
      totalLayoutHeight: baseHeightPx,
      totalLayoutWidth: widthPx + arrowPadding.left + arrowPadding.right,
      leftPadding: arrowPadding.left,
      children: [],
    }
  },
}
