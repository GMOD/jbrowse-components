import { getStrokeColor, isOffScreen } from './util'

import type { DrawFeatureArgs } from './types'

export function drawSegments(args: DrawFeatureArgs) {
  const { ctx, featureLayout, config, configContext, theme, feature, canvasWidth } =
    args

  const left = featureLayout.x
  const width = featureLayout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const color2 = getStrokeColor({ feature, config, configContext, theme })
  const top = featureLayout.y
  const height = featureLayout.height
  const y = top + height / 2

  ctx.strokeStyle = color2
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()
}
