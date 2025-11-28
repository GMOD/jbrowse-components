import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'

import type { DrawFeatureArgs } from './types'

export function drawSegments(args: DrawFeatureArgs) {
  const { ctx, featureLayout, config, theme, feature } = args

  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
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
