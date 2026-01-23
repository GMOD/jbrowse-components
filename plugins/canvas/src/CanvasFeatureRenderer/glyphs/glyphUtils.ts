import { drawChevrons } from '../drawChevrons.ts'
import { getDisplayModeHeight, readCachedConfig } from '../renderConfig.ts'
import { getStrokeColor, isOffScreen } from '../util.ts'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export const STRAND_ARROW_WIDTH = 8

/**
 * Compute padding needed for strand arrows.
 *
 * The effectiveStrand accounts for region reversal:
 * - effectiveStrand === -1: arrow points left visually (padding on visual left)
 * - effectiveStrand === 1: arrow points right visually (padding on visual right)
 */
export function getStrandArrowPadding(strand: number, reversed: boolean) {
  const reverseFlip = reversed ? -1 : 1
  const effectiveStrand = strand * reverseFlip
  return {
    left: effectiveStrand === -1 ? STRAND_ARROW_WIDTH : 0,
    right: effectiveStrand === 1 ? STRAND_ARROW_WIDTH : 0,
    visualSide:
      effectiveStrand === -1 ? 'left' : effectiveStrand === 1 ? 'right' : null,
    width: strand ? STRAND_ARROW_WIDTH : 0,
  }
}

/**
 * Layout a child feature relative to its parent.
 * Returns a FeatureLayout with position relative to parent (local coordinates).
 */
export function layoutChild(
  child: Feature,
  parentFeature: Feature,
  args: LayoutArgs,
  glyphType = 'Box',
): FeatureLayout {
  const { bpPerPx, reversed, configContext } = args
  const { config, displayMode, featureHeight } = configContext

  const heightPx = readCachedConfig(featureHeight, config, 'height', child)
  const baseHeightPx = getDisplayModeHeight(heightPx, displayMode)

  const childStart = child.get('start')
  const childEnd = child.get('end')
  const parentStart = parentFeature.get('start')
  const parentEnd = parentFeature.get('end')

  const widthPx = (childEnd - childStart) / bpPerPx

  const offsetBp = reversed ? parentEnd - childEnd : childStart - parentStart
  const xRelativePx = offsetBp / bpPerPx

  return {
    feature: child,
    glyphType: glyphType as FeatureLayout['glyphType'],
    x: xRelativePx,
    y: 0,
    width: widthPx,
    height: baseHeightPx,
    totalLayoutHeight: baseHeightPx,
    totalLayoutWidth: widthPx,
    leftPadding: 0,
    children: [],
  }
}

/**
 * Draw a horizontal connecting line (intron line).
 */
export function drawConnectingLine(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  color: string,
) {
  const centerY = top + height / 2
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, centerY)
  ctx.lineTo(left + width, centerY)
  ctx.stroke()
}

/**
 * Draw a strand direction arrow at a specific position.
 * This is the core arrow drawing logic shared by multiple glyphs.
 */
export function drawStrandArrowAtPosition(
  ctx: CanvasRenderingContext2D,
  left: number,
  centerY: number,
  width: number,
  strand: number,
  reversed: boolean,
  color: string,
) {
  const arrowSize = 5
  const reverseFlip = reversed ? -1 : 1
  const arrowOffset = 7 * strand * reverseFlip

  const arrowX =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null

  if (arrowX !== null) {
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(arrowX, centerY)
    ctx.lineTo(arrowX + arrowOffset, centerY)
    ctx.stroke()

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(arrowX + arrowOffset / 2, centerY - arrowSize / 2)
    ctx.lineTo(arrowX + arrowOffset / 2, centerY + arrowSize / 2)
    ctx.lineTo(arrowX + arrowOffset, centerY)
    ctx.closePath()
    ctx.fill()
  }
}

/**
 * Draw a strand direction arrow at the end of a feature.
 */
export function drawStrandArrow(
  ctx: CanvasRenderingContext2D,
  layout: FeatureLayout,
  dc: DrawContext,
  color: string,
) {
  const { feature } = layout
  const { region, canvasWidth } = dc
  const reversed = region.reversed ?? false

  const left = layout.x
  const width = layout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const strand = feature.get('strand') as number
  if (!strand) {
    return
  }

  const centerY = layout.y + layout.height / 2
  drawStrandArrowAtPosition(ctx, left, centerY, width, strand, reversed, color)
}

/**
 * Draw a segmented feature (ProcessedTranscript or Segments glyph).
 * Draws connecting line, chevrons, children, and strand arrow.
 */
export function drawSegmentedFeature(
  ctx: CanvasRenderingContext2D,
  layout: FeatureLayout,
  dc: DrawContext,
  boxGlyph: Glyph,
  cdsGlyph: Glyph,
) {
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

  // Draw children (exons, CDS, UTRs)
  for (const childLayout of children) {
    if (childLayout.glyphType === 'CDS') {
      cdsGlyph.draw(ctx, childLayout, dc)
    } else {
      boxGlyph.draw(ctx, childLayout, dc)
    }
  }

  // Draw strand arrow
  drawStrandArrow(ctx, layout, dc, strokeColor)
}
