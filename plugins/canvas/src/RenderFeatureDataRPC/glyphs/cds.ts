import { readCachedConfig } from '../renderConfig.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const cdsGlyph: Glyph = {
  type: 'CDS',

  match(feature) {
    return feature.get('type') === 'CDS'
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, featureHeight, heightMultiplier } = configContext

    const height = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeight = height * heightMultiplier
    const width = (feature.get('end') - feature.get('start')) / bpPerPx

    return {
      feature,
      glyphType: 'CDS',
      x: 0,
      y: 0,
      width,
      height: baseHeight,
      totalLayoutHeight: baseHeight,
      totalLayoutWidth: width,
      leftPadding: 0,
      children: [],
    }
  },
}
