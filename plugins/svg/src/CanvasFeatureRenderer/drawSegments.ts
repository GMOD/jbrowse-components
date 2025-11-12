import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'

import { drawArrow } from './drawArrow'

import type { DrawFeatureArgs, DrawingResult, FlatbushItem } from './types'

/**
 * Draw a feature as segments with a connecting line
 * Subfeatures must be drawn separately by the caller
 */
export function drawSegments(args: DrawFeatureArgs): DrawingResult {
  const { ctx, feature, featureLayout, config, theme } = args

  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
  const left = featureLayout.x
  const top = featureLayout.y
  const width = featureLayout.width
  const height = featureLayout.height
  const y = top + height / 2

  const coords: number[] = []
  const items: FlatbushItem[] = []

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
