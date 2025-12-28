import { readCachedConfig } from '../renderConfig'
import { isOffScreen } from '../util'

import type { DrawContext, FeatureLayout, LayoutArgs } from '../types'
import type { Feature } from '@jbrowse/core/util'

const STRAND_ARROW_PADDING = 8

/**
 * Compute padding needed for strand arrows.
 */
export function getStrandArrowPadding(strand: number, reversed: boolean) {
  const reverseFlip = reversed ? -1 : 1
  const effectiveStrand = strand * reverseFlip
  return {
    left: effectiveStrand === -1 ? STRAND_ARROW_PADDING : 0,
    right: effectiveStrand === 1 ? STRAND_ARROW_PADDING : 0,
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
  const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx

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

  const arrowSize = 5
  const reverseFlip = reversed ? -1 : 1
  const arrowOffset = 7 * strand * reverseFlip
  const centerY = layout.y + layout.height / 2

  // Determine arrow position based on effective strand direction
  const arrowX =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null

  if (arrowX !== null) {
    // Draw arrow stem
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(arrowX, centerY)
    ctx.lineTo(arrowX + arrowOffset, centerY)
    ctx.stroke()

    // Draw arrow head
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(arrowX + arrowOffset / 2, centerY - arrowSize / 2)
    ctx.lineTo(arrowX + arrowOffset / 2, centerY + arrowSize / 2)
    ctx.lineTo(arrowX + arrowOffset, centerY)
    ctx.closePath()
    ctx.fill()
  }
}
