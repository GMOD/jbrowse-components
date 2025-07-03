import { getViewParams, measureText, stripAlpha } from '@jbrowse/core/util'


import type { DisplayModel } from './util'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

interface ViewParams {
  start: number
  end: number
  offsetPx: number
  offsetPx1: number
}

export function drawFeatureLabel({
  text,
  x,
  y,
  region,
  reversed,
  bpPerPx,
  exportSVG,
  feature,
  viewParams,
  color = 'black',
  fontHeight = 11,
  featureWidth = 0,
  allowedWidthExpansion = 0,
  displayModel = {},
  theme,
  ctx,
}: {
  text: string
  x: number
  y: number
  color?: string
  fontHeight?: number
  featureWidth?: number
  bpPerPx: number
  allowedWidthExpansion?: number
  feature: Feature
  reversed?: boolean
  displayModel?: DisplayModel
  exportSVG?: unknown
  region: Region
  viewParams: ViewParams
  theme: Theme
  ctx: CanvasRenderingContext2D
}) {
  const totalWidth = featureWidth + allowedWidthExpansion
  const measuredTextWidth = measureText(text, fontHeight)
  const params =
    displayModel && !exportSVG ? getViewParams(displayModel) : viewParams

  const viewLeft = reversed ? params.end : params.start

  const rstart = region.start
  const rend = region.end
  const fstart = feature.get('start')
  const fend = feature.get('end')

  const featureWidthBp = measuredTextWidth * bpPerPx

  // this tricky bit of code helps smooth over block boundaries
  // not supported for reverse mode currently
  // reason: reverse mode allocates space for the label in the "normal
  // forward orientation" making it hard to slide. The reverse mode should
  // allocate the label space in the reverse orientation to slide it
  if (
    viewLeft < rend &&
    viewLeft > rstart &&
    fstart < viewLeft &&
    viewLeft + featureWidthBp < fend
  ) {
    x = params.offsetPx
  } else if (
    fstart < viewLeft &&
    viewLeft + featureWidthBp < fend &&
    viewLeft + featureWidthBp > rstart &&
    viewLeft + featureWidthBp < rend
  ) {
    x = params.offsetPx1
  }

  ctx.save()
  ctx.font = `${fontHeight}px Arial` // You might want to make font configurable
  ctx.fillStyle =
    color === '#f0f' ? stripAlpha(theme.palette.text.primary) : color
  ctx.fillText(
    measuredTextWidth > totalWidth
      ? `${text.slice(0, totalWidth / (fontHeight * 0.6))}...`
      : text,
    x,
    y + fontHeight,
  )
  ctx.restore()
}
