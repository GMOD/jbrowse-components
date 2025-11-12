import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'

import type { DrawFeatureArgs, DrawingResult } from './types'

/**
 * Draw a directional arrow indicator for stranded features
 */
export function drawArrow(args: DrawFeatureArgs): DrawingResult {
  const { ctx, feature, featureLayout, config, theme, region } = args

  const strand = feature.get('strand')
  const size = 5
  const reverseFlip = region.reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute

  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null
  const y = top + height / 2

  const coords: number[] = []
  const items = []

  if (p !== null) {
    // Draw line
    ctx.strokeStyle = color2
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p, y)
    ctx.lineTo(p + offset, y)
    ctx.stroke()

    // Draw arrow polygon
    ctx.fillStyle = color2
    ctx.strokeStyle = color2
    ctx.beginPath()
    ctx.moveTo(p + offset / 2, y - size / 2)
    ctx.lineTo(p + offset / 2, y + size / 2)
    ctx.lineTo(p + offset, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  return { coords, items }
}
