import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'

import { drawArrow } from './drawArrow'
import { drawFeature } from './drawFeature'

import type { DrawFeatureArgs, DrawingResult } from './types'

/**
 * Draw a feature as segments with a connecting line and subfeatures
 */
export function drawSegments(
  args: DrawFeatureArgs,
  subfeatures?: any[],
): DrawingResult {
  const { ctx, feature, featureLayout, config, theme } = args

  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute
  const y = top + height / 2

  const coords: number[] = []
  const items = []

  // Draw the connecting line
  ctx.strokeStyle = color2
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()

  // Draw subfeatures
  const subs = subfeatures || feature.get('subfeatures')
  if (subs) {
    for (const subfeature of subs) {
      const subfeatureId = String(subfeature.id())
      const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
      if (!subfeatureLayout) {
        continue
      }

      const result = drawFeature({
        ...args,
        feature: subfeature,
        featureLayout: subfeatureLayout,
        topLevel: false,
      })

      coords.push(...result.coords)
      items.push(...result.items)
    }
  }

  // Draw arrow
  const arrowResult = drawArrow(args)
  coords.push(...arrowResult.coords)
  items.push(...arrowResult.items)

  return { coords, items }
}
