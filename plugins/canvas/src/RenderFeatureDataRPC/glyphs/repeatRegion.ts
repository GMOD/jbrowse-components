import { readCachedConfig } from '../renderConfig.ts'
import { getStrandArrowPadding, layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const repeatRegionGlyph: Glyph = {
  type: 'RepeatRegion',

  match(feature) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')
    return type === 'repeat_region' && !!subfeatures?.length
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, reversed, configContext } = args
    const { config, featureHeight, heightMultiplier } = configContext

    const start = feature.get('start')
    const end = feature.get('end')
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (end - start) / bpPerPx

    const strand = feature.get('strand') as number
    const arrowPadding = getStrandArrowPadding(strand, reversed)

    const subfeatures = feature.get('subfeatures') || []
    const children = subfeatures.map(child => layoutChild(child, feature, args))

    return {
      feature,
      glyphType: 'RepeatRegion',
      x: 0,
      y: 0,
      width: widthPx,
      height: baseHeightPx,
      totalLayoutHeight: baseHeightPx,
      totalLayoutWidth: widthPx + arrowPadding.left + arrowPadding.right,
      leftPadding: arrowPadding.left,
      children,
    }
  },
}
