import { drawChevrons } from './drawChevrons'
import { getStrokeColor, isOffScreen } from './util'

import type { DrawFeatureArgs } from './types'

export function drawSegments(args: DrawFeatureArgs) {
  const {
    ctx,
    featureLayout,
    configSnapshot,
    configContext,
    theme,
    jexl,
    feature,
    canvasWidth,
    reversed,
  } = args

  const left = featureLayout.x
  const width = featureLayout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const color2 = getStrokeColor({ feature, configSnapshot, configContext, theme, jexl })
  const top = featureLayout.y
  const height = featureLayout.height
  const y = top + height / 2

  ctx.strokeStyle = color2
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()

  const { displayDirectionalChevrons } = configContext
  if (displayDirectionalChevrons) {
    const strand = feature.get('strand') as number
    if (strand) {
      const effectiveStrand = reversed ? -strand : strand
      drawChevrons(ctx, left, y, width, effectiveStrand, color2)
    }
  }
}
