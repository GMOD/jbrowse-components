import { getSubparts } from '../filterSubparts.ts'
import { readCachedConfig } from '../renderConfig.ts'
import { getStrandArrowPadding, layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export const processedTranscriptGlyph: Glyph = {
  type: 'ProcessedTranscript',

  match(feature, configContext) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')
    if (!subfeatures?.length) {
      return false
    }
    const { transcriptTypes } = configContext
    if (!transcriptTypes.includes(type)) {
      return false
    }
    return subfeatures.some((f: Feature) => f.get('type') === 'CDS')
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

    const subparts = getSubparts(feature, config)
    const children = subparts
      .map(child => {
        const childType = child.get('type')
        const glyphType = childType === 'CDS' ? 'CDS' : 'Box'
        return layoutChild(child, feature, args, glyphType)
      })
      .sort((a, b) => a.feature.get('start') - b.feature.get('start'))

    return {
      feature,
      glyphType: 'ProcessedTranscript',
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
