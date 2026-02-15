import { readCachedConfig } from '../renderConfig.ts'
import { getStrandArrowPadding } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const boxGlyph: Glyph = {
  type: 'Box',

  match(feature) {
    const type = feature.get('type')
    if (type === 'CDS') {
      return false
    }
    const subfeatures = feature.get('subfeatures')
    return !subfeatures?.length
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, reversed, configContext } = args
    const { config, featureHeight, heightMultiplier } = configContext

    const height = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeight = height * heightMultiplier
    const width = (feature.get('end') - feature.get('start')) / bpPerPx

    const isTopLevel = !feature.parent?.()
    const strand = feature.get('strand') as number
    const arrowPadding = isTopLevel
      ? getStrandArrowPadding(strand, reversed)
      : { left: 0, right: 0 }

    return {
      feature,
      glyphType: 'Box',
      x: 0,
      y: 0,
      width,
      height: baseHeight,
      totalLayoutHeight: baseHeight,
      totalLayoutWidth: width + arrowPadding.left + arrowPadding.right,
      leftPadding: arrowPadding.left,
      children: [],
    }
  },
}
