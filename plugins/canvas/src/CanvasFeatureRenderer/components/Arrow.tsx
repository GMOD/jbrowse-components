import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

export function drawArrow({
  feature,
  x,
  y,
  width,
  height,
  config,
  region,
  ctx,
}: {
  region: Region
  feature: Feature
  x: number
  y: number
  width: number
  height: number
  config: AnyConfigurationModel
  ctx: CanvasRenderingContext2D
}) {
  const strand = feature.get('strand')
  const size = 5
  const reverseFlip = region.reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip

  const c = readConfObject(config, 'color2', { feature })
  const theme = createJBrowseTheme()
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
  const p =
    strand * reverseFlip === -1
      ? x
      : strand * reverseFlip === 1
        ? x + width
        : null
  const arrowY = y + height / 2

  if (p !== null) {
    ctx.strokeStyle = color2
    ctx.fillStyle = color2

    // Draw the line
    ctx.beginPath()
    ctx.moveTo(p, arrowY)
    ctx.lineTo(p + offset, arrowY)
    ctx.stroke()

    // Draw the polygon (arrowhead)
    ctx.beginPath()
    ctx.moveTo(p + offset / 2, arrowY - size / 2)
    ctx.lineTo(p + offset / 2, arrowY + size / 2)
    ctx.lineTo(p + offset, arrowY)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}
