import { readCachedConfig } from '../renderConfig'
import { drawChevrons } from '../drawChevrons'
import { getSubparts } from '../filterSubparts'
import { getStrokeColor, isOffScreen } from '../util'
import { boxGlyph } from './box'
import { cdsGlyph } from './cds'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'
import type { Feature } from '@jbrowse/core/util'

const STRAND_ARROW_PADDING = 8

function getStrandArrowPadding(strand: number, reversed: boolean) {
  const reverseFlip = reversed ? -1 : 1
  const effectiveStrand = strand * reverseFlip
  return {
    left: effectiveStrand === -1 ? STRAND_ARROW_PADDING : 0,
    right: effectiveStrand === 1 ? STRAND_ARROW_PADDING : 0,
  }
}

function layoutChild(
  child: Feature,
  parentFeature: Feature,
  args: LayoutArgs,
): FeatureLayout {
  const { bpPerPx, reversed, configContext } = args
  const { config, displayMode, featureHeight } = configContext

  const heightPx = readCachedConfig(featureHeight, config, 'height', child)
  const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx

  const childBp = {
    start: child.get('start') as number,
    end: child.get('end') as number,
  }
  const parentBp = {
    start: parentFeature.get('start') as number,
    end: parentFeature.get('end') as number,
  }

  const widthPx = (childBp.end - childBp.start) / bpPerPx

  // Position relative to parent (in pixels)
  const offsetBp = reversed
    ? parentBp.end - childBp.end
    : childBp.start - parentBp.start
  const xRelativePx = offsetBp / bpPerPx

  const childType = child.get('type')
  const glyphType = childType === 'CDS' ? 'CDS' : 'Box'

  return {
    feature: child,
    glyphType,
    x: xRelativePx,
    y: 0,
    width: widthPx,
    height: baseHeightPx,
    totalFeatureHeight: baseHeightPx,
    totalLayoutHeight: baseHeightPx,
    totalLayoutWidth: widthPx,
    leftPadding: 0,
    children: [],
  }
}

export const processedTranscriptGlyph: Glyph = {
  type: 'ProcessedTranscript',

  match(feature, configContext) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures') as Feature[] | undefined
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

    const featureBp = {
      start: feature.get('start') as number,
      end: feature.get('end') as number,
    }
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx
    const widthPx = (featureBp.end - featureBp.start) / bpPerPx

    const strand = feature.get('strand') as number
    const arrowPadding = getStrandArrowPadding(strand, reversed)

    // Get subparts with synthesized UTRs
    const subparts = getSubparts(feature, config)
    const children = subparts.map(child => layoutChild(child, feature, args))

    return {
      feature,
      glyphType: 'ProcessedTranscript',
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
    const { region, bpPerPx, configContext, theme, canvasWidth } = dc
    const { config, displayDirectionalChevrons } = configContext
    const reversed = region.reversed ?? false

    const leftPx = layout.x
    const widthPx = layout.width
    const topPx = layout.y
    const heightPx = layout.height

    if (isOffScreen(leftPx, widthPx, canvasWidth)) {
      return
    }

    // Draw connecting line
    const strokeColor = getStrokeColor({ feature, config, configContext, theme })
    const centerYPx = topPx + heightPx / 2

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(leftPx, centerYPx)
    ctx.lineTo(leftPx + widthPx, centerYPx)
    ctx.stroke()

    // Draw chevrons if enabled
    if (displayDirectionalChevrons) {
      const strand = feature.get('strand') as number
      if (strand) {
        const effectiveStrand = reversed ? -strand : strand
        drawChevrons(ctx, leftPx, centerYPx, widthPx, effectiveStrand, strokeColor)
      }
    }

    // Draw children (exons, CDS, UTRs) - coordinates are already absolute
    for (const childLayout of children) {
      if (childLayout.glyphType === 'CDS') {
        cdsGlyph.draw(ctx, childLayout, dc)
      } else {
        boxGlyph.draw(ctx, childLayout, dc)
      }
    }

    // Draw strand arrow
    drawArrow(ctx, layout, dc)
  },
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  layout: FeatureLayout,
  dc: DrawContext,
) {
  const { feature } = layout
  const { region, configContext, theme, canvasWidth } = dc
  const { config } = configContext
  const reversed = region.reversed ?? false

  const leftPx = layout.x
  const widthPx = layout.width

  if (isOffScreen(leftPx, widthPx, canvasWidth)) {
    return
  }

  const strand = feature.get('strand')
  if (!strand) {
    return
  }

  const arrowSize = 5
  const reverseFlip = reversed ? -1 : 1
  const arrowOffset = 7 * strand * reverseFlip
  const topPx = layout.y
  const heightPx = layout.height
  const centerYPx = topPx + heightPx / 2

  const strokeColor = getStrokeColor({ feature, config, configContext, theme })

  // Determine arrow position based on effective strand direction
  const arrowXPx =
    strand * reverseFlip === -1
      ? leftPx
      : strand * reverseFlip === 1
        ? leftPx + widthPx
        : null

  if (arrowXPx !== null) {
    // Draw arrow stem
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(arrowXPx, centerYPx)
    ctx.lineTo(arrowXPx + arrowOffset, centerYPx)
    ctx.stroke()

    // Draw arrow head
    ctx.fillStyle = strokeColor
    ctx.strokeStyle = strokeColor
    ctx.beginPath()
    ctx.moveTo(arrowXPx + arrowOffset / 2, centerYPx - arrowSize / 2)
    ctx.lineTo(arrowXPx + arrowOffset / 2, centerYPx + arrowSize / 2)
    ctx.lineTo(arrowXPx + arrowOffset, centerYPx)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}
