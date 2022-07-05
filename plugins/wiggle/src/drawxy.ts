import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { clamp, featureSpanPx, Feature, Region } from '@jbrowse/core/util'
import { getOrigin, getScale, ScaleOpts } from './util'

function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  color?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillRect(x, y, width, height)
}

export function drawFeats(
  ctx: CanvasRenderingContext2D,
  props: {
    features: Feature[]
    bpPerPx: number
    regions: Region[]
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    config: AnyConfigurationModel
    displayCrossHatches: boolean
    offset?: number
    colorCallback: (f: Feature, score: number) => string
    clipHeight: number
    Color: typeof import('color')
  },
) {
  const {
    features,
    bpPerPx,
    regions,
    scaleOpts,
    height: unadjustedHeight,
    config,
    ticks,
    clipHeight = 2,
    displayCrossHatches,
    offset = 0,
    colorCallback,
    Color,
  } = props
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx

  // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
  // wiggle display, and makes the height of the actual drawn area add
  // "padding" to the top and bottom of the display
  const height = unadjustedHeight - offset * 2

  const filled = readConfObject(config, 'filled')
  const clipColor = readConfObject(config, 'clipColor')
  const summaryScoreMode = readConfObject(config, 'summaryScoreMode')

  const scale = getScale({ ...scaleOpts, range: [0, height] })
  const originY = getOrigin(scaleOpts.scaleType)
  const [niceMin, niceMax] = scale.domain()

  const toY = (n: number) => clamp(height - (scale(n) || 0), 0, height) + offset
  const toOrigin = (n: number) => toY(originY) - toY(n)
  const getHeight = (n: number) => (filled ? toOrigin(n) : 1)
  let hasClipping = false

  let prevLeftPx = 0
  let reducedFeatures = []
  for (let i = 0; i < features.length; i++) {
    const feature = features[i]
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
      reducedFeatures.push(feature)
      prevLeftPx = leftPx
    }

    const score = feature.get('score')
    const c = colorCallback(feature, score)
    const minColor = Color(c).darken(0.6).toString()
    const maxColor = Color(c).lighten(0.6).toString()

    hasClipping = hasClipping || score < niceMin || score > niceMax
    const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering

    if (summaryScoreMode === 'whiskers') {
      const summary = feature.get('summary')
      if (summary) {
        const max = feature.get('maxScore')
        const min = feature.get('minScore')
        hasClipping = hasClipping || min < niceMin || max > niceMax
        fillRectCtx(leftPx, toY(max), w, getHeight(max), ctx, maxColor)
        fillRectCtx(leftPx, toY(min), w, getHeight(min), ctx, minColor)
      }
      fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
    } else if (summaryScoreMode === 'max') {
      const s = feature.get('summary') ? feature.get('maxScore') : score
      fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
    } else if (summaryScoreMode === 'min') {
      const s = feature.get('summary') ? feature.get('minScore') : score
      fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
    } else {
      fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
    }
  }

  // second pass: draw clipping
  // avoid persisting the red fillstyle with save/restore
  ctx.save()
  if (hasClipping) {
    ctx.fillStyle = clipColor
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      const score = feature.get('score')
      if (score > niceMax) {
        fillRectCtx(leftPx, 0, w, clipHeight, ctx)
      } else if (score < niceMin && scaleOpts.scaleType !== 'log') {
        fillRectCtx(leftPx, unadjustedHeight, w, clipHeight, ctx)
      }
    }
  }
  ctx.restore()

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.8)'
    ticks.values.forEach(tick => {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    })
  }

  return { reducedFeatures }
}
