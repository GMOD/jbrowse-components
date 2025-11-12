import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'

import type { DrawFeatureArgs, DrawingResult } from './types'

/**
 * Draw a directional arrow indicator for stranded features
 */
export function drawArrow(args: DrawFeatureArgs): DrawingResult {
  const { ctx, feature, featureLayout, config, theme, reversed } = args

  const strand = feature.get('strand')
  const size = 5
  const reverseFlip = reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const left = featureLayout.x
  const top = featureLayout.y
  const width = featureLayout.width
  const height = featureLayout.height

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
  const items: { featureId: string; type: string }[] = []

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
