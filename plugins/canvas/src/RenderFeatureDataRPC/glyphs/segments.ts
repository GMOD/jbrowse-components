import { readCachedConfig } from '../renderConfig.ts'
import {
  getStrandArrowPadding,
  layoutChild,
  sortByPosition,
} from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const segmentsGlyph: Glyph = {
  type: 'Segments',

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, featureHeight, heightMultiplier } = configContext

    const start = feature.get('start')
    const end = feature.get('end')
    const heightPx = readCachedConfig(featureHeight, config, 'featureHeight', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (end - start) / bpPerPx

    const strand = feature.get('strand') as number
    const arrowPadding = getStrandArrowPadding(strand)

    const subfeatures = feature.get('subfeatures') || []
    const children = sortByPosition(
      subfeatures.map(child => {
        const childType = child.get('type')
        const glyphType = childType === 'CDS' ? 'CDS' : 'Box'
        return layoutChild(child, feature, args, glyphType)
      }),
    )

    return {
      feature,
      glyphType: 'Segments',
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
