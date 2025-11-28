import { getStrokeColor } from './util'

import type { DrawFeatureArgs } from './types'

export function drawSegments(args: DrawFeatureArgs) {
  const { ctx, featureLayout, config, configContext, theme, feature } = args

  const color2 = getStrokeColor({ feature, config, configContext, theme })
  const left = featureLayout.x
  const top = featureLayout.y
  const width = featureLayout.width
  const height = featureLayout.height
  const y = top + height / 2

  ctx.strokeStyle = color2
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()
}
