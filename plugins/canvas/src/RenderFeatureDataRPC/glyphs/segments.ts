import { readCachedConfig } from '../renderConfig.ts'
import { getStrandArrowPadding, layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export const segmentsGlyph: Glyph = {
  type: 'Segments',

  match(feature, configContext) {
    const type = feature.get('type')
    if (type === 'CDS') {
      return false
    }
    const subfeatures = feature.get('subfeatures')
    if (!subfeatures?.length) {
      return false
    }
    const { transcriptTypes, containerTypes } = configContext
    if (transcriptTypes.includes(type)) {
      const hasCDS = subfeatures.some((f: Feature) => f.get('type') === 'CDS')
      if (hasCDS) {
        return false
      }
    }
    if (containerTypes.includes(type)) {
      return false
    }
    const isTopLevel = !feature.parent?.()
    const hasNestedSubfeatures = subfeatures.some(
      (f: Feature) => f.get('subfeatures')?.length,
    )
    if (isTopLevel && hasNestedSubfeatures) {
      return false
    }
    return true
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
    const children = subfeatures
      .map(child => {
        const childType = child.get('type')
        const glyphType = childType === 'CDS' ? 'CDS' : 'Box'
        return layoutChild(child, feature, args, glyphType)
      })
      .sort((a, b) => a.feature.get('start') - b.feature.get('start'))

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
