import { getStrokeColor, isOffScreen } from './util'

import type { DrawFeatureArgs } from './types'

export function drawArrow(args: DrawFeatureArgs) {
  const {
    ctx,
    feature,
    featureLayout,
    config,
    configContext,
    theme,
    reversed,
    canvasWidth,
  } = args

  const left = featureLayout.x
  const width = featureLayout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const strand = feature.get('strand')
  const size = 5
  const reverseFlip = reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const top = featureLayout.y
  const height = featureLayout.height
  const y = top + height / 2

  const color2 = getStrokeColor({ feature, config, configContext, theme })
  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null

  if (p !== null) {
    ctx.strokeStyle = color2
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p, y)
    ctx.lineTo(p + offset, y)
    ctx.stroke()

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
}
