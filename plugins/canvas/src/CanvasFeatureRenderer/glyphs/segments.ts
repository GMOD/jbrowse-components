import { readCachedConfig } from '../renderConfig'
import { boxGlyph } from './box'
import { cdsGlyph } from './cds'
import {
  drawSegmentedFeature,
  getStrandArrowPadding,
  layoutChild,
} from './glyphUtils'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'
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
    // Not a coding transcript (those use ProcessedTranscript)
    if (transcriptTypes.includes(type)) {
      const hasCDS = subfeatures.some((f: Feature) => f.get('type') === 'CDS')
      if (hasCDS) {
        return false
      }
    }
    // Not a container (gene)
    if (containerTypes.includes(type)) {
      return false
    }
    // Not a top-level feature with nested subfeatures
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
    const { config, displayMode, featureHeight } = configContext

    const start = feature.get('start')
    const end = feature.get('end')
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx
    const widthPx = (end - start) / bpPerPx

    const strand = feature.get('strand') as number
    const arrowPadding = getStrandArrowPadding(strand, reversed)

    const subfeatures = feature.get('subfeatures') || []
    const children = subfeatures.map(child => {
      const childType = child.get('type')
      const glyphType = childType === 'CDS' ? 'CDS' : 'Box'
      return layoutChild(child, feature, args, glyphType)
    })

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

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    drawSegmentedFeature(ctx, layout, dc, boxGlyph, cdsGlyph)
  },
}
