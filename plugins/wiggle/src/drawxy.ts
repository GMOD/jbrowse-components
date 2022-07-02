import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { featureSpanPx, Feature, Region } from '@jbrowse/core/util'
import { getOrigin, getScale, ScaleOpts } from './util'

function fillRect(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  path?: Path2D,
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
  if (path) {
    path.rect(x, y, width, height)
  } else {
    if (color) {
      ctx.fillStyle = String(color)
    }
    ctx.fillRect(x, y, width, height)
  }
}

function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  color?: string,
) {
  if (color) {
    ctx.fillStyle = String(color)
  }
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
    exportSVG?: { rasterizeLayers?: boolean }
    offset: number
    color?: string
    colorCallback?: (f: Feature, score: number) => string
    Color: any
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
    displayCrossHatches,
    exportSVG,
    offset = 0,
    color,
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

  const toY = (n: number) => height - (scale(n) || 0) + offset
  const toHeight = (n: number) => toY(originY) - toY(n)

  const useCb = !!colorCallback
  const minColor = color && Color(color).darken(0.6).toString()
  const maxColor = color && Color(color).lighten(0.6).toString()

  // first pass: uses path2d for faster rendering
  const usePath = exportSVG || typeof Path2D === 'undefined'
  const path = usePath ? undefined : new Path2D()
  const pathMin = usePath ? undefined : new Path2D()
  const pathMax = usePath ? undefined : new Path2D()
  const getHeight = (n: number) => (filled ? toHeight(n) : 1)
  let hasClipping = false

  if (useCb) {
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      let score = feature.get('score')
      const c = colorCallback(feature, score)
      const minColor = Color(c).darken(0.6).toString()
      const maxColor = Color(c).lighten(0.6).toString()

      hasClipping = score < niceMin || score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering

      if (summaryScoreMode === 'whiskers') {
        const summary = feature.get('summary')
        if (summary) {
          const max = feature.get('maxScore')
          const min = feature.get('minScore')
          fillRectCtx(
            leftPx,
            toY(max),
            w,
            getHeight(max),
            ctx,

            maxColor,
          )
          fillRectCtx(
            leftPx,
            toY(min),
            w,
            getHeight(min),
            ctx,

            minColor,
          )
        }
        fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
      } else if (summaryScoreMode === 'max') {
        const maxr = feature.get('maxScore')
        const s = feature.get('summary') ? maxr : score
        fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
      } else if (summaryScoreMode === 'min') {
        const minr = feature.get('minScore')
        const s = feature.get('summary') ? minr : score
        fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
      } else {
        fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
      }
    }
  } else {
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      let score = feature.get('score')
      hasClipping = score < niceMin || score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering

      if (summaryScoreMode === 'whiskers') {
        const summary = feature.get('summary')
        if (summary) {
          const max = feature.get('maxScore')
          const min = feature.get('minScore')
          fillRect(leftPx, toY(max), w, getHeight(max), ctx, pathMax, maxColor)
          fillRect(leftPx, toY(min), w, getHeight(min), ctx, pathMin, minColor)
        }
        fillRect(leftPx, toY(score), w, getHeight(score), ctx, path, color)
      } else if (summaryScoreMode === 'max') {
        const maxr = feature.get('maxScore')
        const s = feature.get('summary') ? maxr : score
        fillRect(leftPx, toY(s), w, getHeight(s), ctx, path, color)
      } else if (summaryScoreMode === 'min') {
        const minr = feature.get('minScore')
        const s = feature.get('summary') ? minr : score
        fillRect(leftPx, toY(s), w, getHeight(s), ctx, path, color)
      } else {
        fillRect(leftPx, toY(score), w, getHeight(score), ctx, path, color)
      }
    }
    if (path && pathMin && pathMax && color) {
      ctx.fillStyle = minColor
      ctx.fill(pathMin)
      ctx.fillStyle = maxColor
      ctx.fill(pathMax)
      ctx.fillStyle = color
      ctx.fill(path)
    }
  }

  // second pass: draw clipping
  if (hasClipping) {
    const path = exportSVG ? undefined : new Path2D()
    ctx.fillStyle = clipColor
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + 0.4 // fudge factor for subpixel rendering
      const score = feature.get('score')
      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      if (highClipping) {
        fillRect(leftPx, 0, w, 4, ctx, path)
      } else if (lowClipping && scaleOpts.scaleType !== 'log') {
        fillRect(leftPx, unadjustedHeight - 4, w, 4, ctx, path, clipColor)
      }
    }
    if (path) {
      ctx.fillStyle = clipColor
      ctx.fill(path)
    }
  }

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
}
