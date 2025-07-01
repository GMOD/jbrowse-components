import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

export function drawArrow({
  feature,
  featureLayout,
  config,
  region,
  ctx,
}: {
  region: Region
  feature: Feature
  featureLayout: SceneGraph
  config: AnyConfigurationModel
  ctx: CanvasRenderingContext2D
}) {
  const strand = feature.get('strand')
  const size = 5
  const reverseFlip = region.reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute

  const c = readConfObject(config, 'color2', { feature })
  const theme = createJBrowseTheme()
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null
  const y = top + height / 2

  if (p !== null) {
    ctx.strokeStyle = color2
    ctx.fillStyle = color2

    // Draw the line
    ctx.beginPath()
    ctx.moveTo(p, y)
    ctx.lineTo(p + offset, y)
    ctx.stroke()

    // Draw the polygon (arrowhead)
    ctx.beginPath()
    ctx.moveTo(p + offset / 2, y - size / 2)
    ctx.lineTo(p + offset / 2, y + size / 2)
    ctx.lineTo(p + offset, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}