import { readConfObject } from '@jbrowse/core/configuration'

import { getBoxColor, isUTR } from './util'

import type { DrawFeatureArgs } from './types'

const utrHeightFraction = 0.65

export function drawBox(args: DrawFeatureArgs) {
  const {
    ctx,
    feature,
    featureLayout,
    region,
    bpPerPx,
    config,
    configContext,
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

  if (left + width < 0) {
    return
  }

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
    configContext,
    colorByCDS,
    theme,
  })
  const stroke = readConfObject(config, 'outline', { feature }) as string

  if (feature.parent() && featureType === 'intron') {
    return
  }

  ctx.fillStyle = fill
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
  }

  ctx.fillRect(leftWithinBlock, top, widthWithinBlock, height)
  if (stroke) {
    ctx.strokeRect(leftWithinBlock, top, widthWithinBlock, height)
  }
}
