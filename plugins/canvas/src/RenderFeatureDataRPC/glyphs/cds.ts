import { readCachedConfig } from '../renderConfig.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const cdsGlyph: Glyph = {
  type: 'CDS',

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, featureHeight, heightMultiplier } = configContext

    const heightPx = readCachedConfig(featureHeight, config, 'featureHeight', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (feature.get('end') - feature.get('start')) / bpPerPx

    return {
      feature,
      glyphType: 'CDS',
      x: 0,
      y: 0,
      width: widthPx,
      height: baseHeightPx,
      totalLayoutHeight: baseHeightPx,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children: [],
    }
  },
}
