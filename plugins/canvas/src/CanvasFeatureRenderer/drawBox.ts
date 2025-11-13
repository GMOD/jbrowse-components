import { readConfObject } from '@jbrowse/core/configuration'

import { getBoxColor, isUTR } from './util'

import type { DrawFeatureArgs, DrawingResult, FlatbushItem } from './types'

const utrHeightFraction = 0.65

/**
 * Draw a box (rectangle) feature on the canvas
 */
export function drawBox(args: DrawFeatureArgs): DrawingResult {
  const {
    ctx,
    feature,
    featureLayout,
    region,
    bpPerPx,
    config,
    theme,
    colorByCDS = false,
  } = args
  const { start, end } = region
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureType: string | undefined = feature.get('type')
  const width = featureLayout.width
  const left = featureLayout.x
  let top = featureLayout.y
  let height = featureLayout.height

  const coords: number[] = []
  const items: FlatbushItem[] = []

  if (left + width < 0) {
    return { coords, items }
  }

  // Adjust height for UTRs
  if (isUTR(feature)) {
    top += ((1 - utrHeightFraction) / 2) * height
    height *= utrHeightFraction
  }

  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(2, Math.min(width - diff, screenWidth))

  const fill = getBoxColor({
    feature,
    config,
    colorByCDS,
    theme,
  })
  const stroke = readConfObject(config, 'outline', { feature }) as string

  // Don't render intron subfeatures if they have a parent
  if (feature.parent() && featureType === 'intron') {
    return { coords, items }
  }

  // Draw the rectangle
  ctx.fillStyle = fill
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
  }

  ctx.fillRect(leftWithinBlock, top, widthWithinBlock, height)
  if (stroke) {
    ctx.strokeRect(leftWithinBlock, top, widthWithinBlock, height)
  }

  // Add to spatial index
  coords.push(
    leftWithinBlock,
    top,
    leftWithinBlock + widthWithinBlock,
    top + height,
  )
  items.push({
    featureId: feature.id(),
    type: 'box',
    startBp: feature.get('start'),
    endBp: feature.get('end'),
    leftPx: leftWithinBlock,
    rightPx: leftWithinBlock + widthWithinBlock,
    topPx: top,
    bottomPx: top + height,
  })

  return { coords, items }
}
