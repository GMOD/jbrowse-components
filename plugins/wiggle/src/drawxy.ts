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

const fudgeFactor = 0.3
const clipHeight = 2

export function drawXY(
  ctx: CanvasRenderingContext2D,
  props: {
    features: Map<string, Feature> | Feature[]
    bpPerPx: number
    regions: Region[]
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    config: AnyConfigurationModel
    displayCrossHatches: boolean
    offset?: number
    colorCallback: (f: Feature, score: number) => string
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
  const reducedFeatures = []

  // we handle whiskers separately to render max row, min row, and avg in three
  // passes. this reduces subpixel rendering issues. note: for stylistic
  // reasons, clipping indicator is only drawn for score, not min/max score
  if (summaryScoreMode === 'whiskers') {
    let lastCol
    let lastDarken
    let lastLighten
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      const summary = feature.get('summary')
      const c = colorCallback(feature, score)
      const w = rightPx - leftPx + fudgeFactor
      if (summary) {
        const max = feature.get('maxScore')
        fillRectCtx(
          leftPx,
          toY(max),
          w,
          getHeight(max),
          ctx,
          c === lastCol
            ? lastLighten
            : (lastLighten = Color(c).lighten(0.4).toString()),
        )
      }
      lastCol = c
    }
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      const c = colorCallback(feature, score)
      const w = rightPx - leftPx + fudgeFactor
      // create reduced features, avoiding multiple features per px
      if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
        reducedFeatures.push(feature)
        prevLeftPx = leftPx
      }
      hasClipping = hasClipping || score < niceMin || score > niceMax
      fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
    }
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      const summary = feature.get('summary')
      const c = colorCallback(feature, score)
      const w = rightPx - leftPx + fudgeFactor

      if (summary) {
        const min = feature.get('minScore')

        fillRectCtx(
          leftPx,
          toY(min),
          w,
          getHeight(min),
          ctx,
          c === lastCol
            ? lastDarken
            : (lastDarken = Color(c).darken(0.4).toString()),
        )
      }
      lastCol = c
    }
  } else {
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      // create reduced features, avoiding multiple features per px
      if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
        reducedFeatures.push(feature)
        prevLeftPx = leftPx
      }

      const score = feature.get('score')
      const c = colorCallback(feature, score)

      hasClipping = hasClipping || score < niceMin || score > niceMax
      const w = rightPx - leftPx + fudgeFactor

      if (summaryScoreMode === 'max') {
        const s = feature.get('summary') ? feature.get('maxScore') : score
        fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
      } else if (summaryScoreMode === 'min') {
        const s = feature.get('summary') ? feature.get('minScore') : score
        fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
      } else {
        fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
      }
    }
  }

  // second pass: draw clipping
  // avoid persisting the red fillstyle with save/restore
  ctx.save()
  if (hasClipping) {
    ctx.fillStyle = clipColor
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + fudgeFactor
      const score = feature.get('score')
      if (score > niceMax) {
        fillRectCtx(leftPx, offset, w, clipHeight, ctx)
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

export function drawLine(
  ctx: CanvasRenderingContext2D,
  props: {
    features: Map<string, Feature> | Feature[]
    regions: Region[]
    bpPerPx: number
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    displayCrossHatches: boolean
    colorCallback: (f: Feature, score: number) => string
    config: AnyConfigurationModel
    offset?: number
  },
) {
  const {
    features,
    regions,
    bpPerPx,
    scaleOpts,
    height: unadjustedHeight,
    ticks: { values },
    displayCrossHatches,
    colorCallback,
    config,
    offset = 0,
  } = props
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx

  // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
  // wiggle display, and makes the height of the actual drawn area add
  // "padding" to the top and bottom of the display
  const height = unadjustedHeight - offset * 2
  const clipColor = readConfObject(config, 'clipColor')
  const scale = getScale({ ...scaleOpts, range: [0, height] })
  const [niceMin, niceMax] = scale.domain()
  const toY = (n: number) => clamp(height - (scale(n) || 0), 0, height) + offset

  let lastVal

  let prevLeftPx = 0
  const reducedFeatures = []
  for (const feature of features.values()) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

    // create reduced features, avoiding multiple features per px
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
      reducedFeatures.push(feature)
      prevLeftPx = leftPx
    }
    const score = feature.get('score')
    const lowClipping = score < niceMin
    const highClipping = score > niceMax
    const w = rightPx - leftPx + fudgeFactor

    const c = colorCallback(feature, score)

    ctx.beginPath()
    ctx.strokeStyle = c
    const startPos = typeof lastVal !== 'undefined' ? lastVal : score
    if (!region.reversed) {
      ctx.moveTo(leftPx, toY(startPos))
      ctx.lineTo(leftPx, toY(score))
      ctx.lineTo(rightPx, toY(score))
    } else {
      ctx.moveTo(rightPx, toY(startPos))
      ctx.lineTo(rightPx, toY(score))
      ctx.lineTo(leftPx, toY(score))
    }
    ctx.stroke()
    lastVal = score

    if (highClipping) {
      ctx.fillStyle = clipColor
      ctx.fillRect(leftPx, offset, w, clipHeight)
    } else if (lowClipping && scaleOpts.scaleType !== 'log') {
      ctx.fillStyle = clipColor
      ctx.fillRect(leftPx, height - clipHeight, w, height)
    }
  }

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.8)'
    values.forEach(tick => {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    })
  }
  return { reducedFeatures }
}

export function drawDensity(
  ctx: CanvasRenderingContext2D,
  props: {
    features: Map<string, Feature> | Feature[]
    regions: Region[]
    bpPerPx: number
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    displayCrossHatches: boolean
    config: AnyConfigurationModel
  },
) {
  const { features, regions, bpPerPx, scaleOpts, height, config } = props
  const [region] = regions
  const pivot = readConfObject(config, 'bicolorPivot')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const negColor = readConfObject(config, 'negColor')
  const posColor = readConfObject(config, 'posColor')
  const color = readConfObject(config, 'color')
  const clipColor = readConfObject(config, 'clipColor')
  const crossing = pivot !== 'none' && scaleOpts.scaleType !== 'log'
  const scale = getScale({
    ...scaleOpts,
    pivotValue: crossing ? pivotValue : undefined,
    range: crossing ? [negColor, 'white', posColor] : ['white', posColor],
  })

  const scale2 = getScale({ ...scaleOpts, range: [0, height] })
  let cb
  if (color === '#f0f') {
    cb = (_feature: Feature, score: number) => scale(score)
  } else {
    cb = (feature: Feature, score: number) =>
      readConfObject(config, 'color', { feature, score })
  }
  const [niceMin, niceMax] = scale2.domain()

  let prevLeftPx = 0
  let hasClipping = false
  const reducedFeatures = []
  for (const feature of features.values()) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

    // create reduced features, avoiding multiple features per px
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
      reducedFeatures.push(feature)
      prevLeftPx = leftPx
    }
    const score = feature.get('score')
    hasClipping = hasClipping || score > niceMax || score < niceMin
    const w = rightPx - leftPx + fudgeFactor
    ctx.fillStyle = cb(feature, score)
    ctx.fillRect(leftPx, 0, w, height)
  }

  // second pass: draw clipping
  // avoid persisting the red fillstyle with save/restore
  ctx.save()
  if (hasClipping) {
    ctx.fillStyle = clipColor
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + fudgeFactor
      const score = feature.get('score')
      if (score > niceMax) {
        fillRectCtx(leftPx, 0, w, clipHeight, ctx)
      } else if (score < niceMin && scaleOpts.scaleType !== 'log') {
        fillRectCtx(leftPx, 0, w, clipHeight, ctx)
      }
    }
  }
  ctx.restore()

  return { reducedFeatures }
}
