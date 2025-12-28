import { drawChevrons } from '../drawChevrons'
import { readCachedConfig } from '../renderConfig'
import { getStrokeColor, isOffScreen } from '../util'
import { boxGlyph } from './box'
import { cdsGlyph } from './cds'
import {
  drawConnectingLine,
  drawStrandArrow,
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
      totalFeatureHeight: baseHeightPx,
      totalLayoutHeight: baseHeightPx,
      totalLayoutWidth: widthPx + arrowPadding.left + arrowPadding.right,
      leftPadding: arrowPadding.left,
      children,
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { feature, children } = layout
    const { region, configContext, theme, canvasWidth } = dc
    const { config, displayDirectionalChevrons } = configContext
    const reversed = region.reversed ?? false

    const left = layout.x
    const width = layout.width
    const top = layout.y
    const height = layout.height

    if (isOffScreen(left, width, canvasWidth)) {
      return
    }

    const strokeColor = getStrokeColor({
      feature,
      config,
      configContext,
      theme,
    })

    // Draw connecting line
    drawConnectingLine(ctx, left, top, width, height, strokeColor)

    // Draw chevrons if enabled
    if (displayDirectionalChevrons) {
      const strand = feature.get('strand') as number
      if (strand) {
        const effectiveStrand = reversed ? -strand : strand
        drawChevrons(
          ctx,
          left,
          top + height / 2,
          width,
          effectiveStrand,
          strokeColor,
        )
      }
    }

    // Draw children
    for (const childLayout of children) {
      if (childLayout.glyphType === 'CDS') {
        cdsGlyph.draw(ctx, childLayout, dc)
      } else {
        boxGlyph.draw(ctx, childLayout, dc)
      }
    }

    // Draw strand arrow
    drawStrandArrow(ctx, layout, dc, strokeColor)
  },
}
