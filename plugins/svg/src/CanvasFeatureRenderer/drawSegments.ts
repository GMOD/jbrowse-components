import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'

import { drawArrow } from './drawArrow'

import type { DrawFeatureArgs, DrawingResult } from './types'
import type { Feature } from '@jbrowse/core/util'

/**
 * Draw a feature as segments with a connecting line
 * Subfeatures must be drawn separately by the caller
 */
export function drawSegments(
  args: DrawFeatureArgs,
): DrawingResult {
  const { ctx, feature, featureLayout, config, theme } = args

  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute
  const y = top + height / 2

  const coords: number[] = []
  const items: { feature: Feature; type: string }[] = []

  // Draw the connecting line
  ctx.strokeStyle = color2
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()

  // Draw arrow
  const arrowResult = drawArrow(args)
  coords.push(...arrowResult.coords)
  items.push(...arrowResult.items)

  return { coords, items }
}
