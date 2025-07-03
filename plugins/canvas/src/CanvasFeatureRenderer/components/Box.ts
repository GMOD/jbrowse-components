import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getFrame } from '@jbrowse/core/util'

import Arrow from './Arrow'
import { isUTR } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const utrHeightFraction = 0.65

function drawBox(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  x: number
  y: number
  width: number
  height: number
  bpPerPx: number
  selected?: boolean
  topLevel?: boolean
  colorByCDS: boolean
  ctx: CanvasRenderingContext2D
}) {
  const theme = createJBrowseTheme()
  const {
    colorByCDS,
    feature,
    region,
    config,
    x,
    y,
    width,
    height,
    bpPerPx,
    topLevel,
    ctx,
  } = props
  const { start, end } = region
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const featureType: string | undefined = feature.get('type')
  const featureStrand: -1 | 1 | undefined = feature.get('strand')
  const featurePhase: 0 | 1 | 2 | undefined = feature.get('phase')

  let currentY = y
  let currentHeight = height

  if (isUTR(feature)) {
    currentY += ((1 - utrHeightFraction) / 2) * currentHeight
    currentHeight *= utrHeightFraction
  }
  let fill: string = isUTR(feature)
    ? readConfObject(config, 'color3', { feature })
    : readConfObject(config, 'color1', { feature })
  if (
    colorByCDS &&
    featureType === 'CDS' &&
    featureStrand !== undefined &&
    featurePhase !== undefined
  ) {
    const frame = getFrame(
      featureStart,
      featureEnd,
      featureStrand,
      featurePhase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (frameColor) {
      fill = frameColor
    }
  }
  const stroke = readConfObject(config, 'outline', { feature }) as string

  // if feature has parent and type is intron, then don't render the intron
  // subfeature (if it doesn't have a parent, then maybe the introns are
  // separately displayed features that should be displayed)
  if (feature.parent() && featureType === 'intron') {
    return
  }

  ctx.save()
  if (fill) {
    ctx.fillStyle = fill
    ctx.fillRect(x, currentY, width, currentHeight)
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.strokeRect(x, currentY, width, currentHeight)
  }
  ctx.restore()

  if (topLevel) {
    Arrow.draw({
      feature,
      x,
      y: currentY,
      width,
      height: currentHeight,
      config,
      region,
      ctx,
    })
  }
}

const Box = {
  draw: drawBox,
  getHeight: ({
    feature,
    config,
    displayMode,
  }: {
    feature: Feature
    config: AnyConfigurationModel
    displayMode: string
  }) => {
    const height = readConfObject(config, 'height', { feature }) as number
    const finalHeight = isUTR(feature) ? height * utrHeightFraction : height
    return displayMode === 'compact' ? finalHeight / 3 : finalHeight
  },
}

export default Box
