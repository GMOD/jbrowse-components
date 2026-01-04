import { getSubparts } from '../filterSubparts'
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

export const processedTranscriptGlyph: Glyph = {
  type: 'ProcessedTranscript',

  match(feature, configContext) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')
    if (!subfeatures?.length) {
      return false
    }
    const { transcriptTypes } = configContext
    // Must be a transcript type with CDS children
    if (!transcriptTypes.includes(type)) {
      return false
    }
    const hasCDS = subfeatures.some((f: Feature) => f.get('type') === 'CDS')
    return hasCDS
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

    // Get subparts with synthesized UTRs
    const subparts = getSubparts(feature, config)
    const children = subparts.map(child => {
      const childType = child.get('type')
      const glyphType = childType === 'CDS' ? 'CDS' : 'Box'
      return layoutChild(child, feature, args, glyphType)
    })

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

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    drawSegmentedFeature(ctx, layout, dc, boxGlyph, cdsGlyph)
  },
}
