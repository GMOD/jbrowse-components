import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { colord, Colord } from '@jbrowse/core/util/colord'
// required to import this for typescript purposes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import mix from 'colord/plugins/mix'

import { clamp, featureSpanPx, Feature, Region } from '@jbrowse/core/util'

// locals
import { fillRectCtx, getOrigin, getScale, ScaleOpts } from './util'

function lighten(color: Colord, amount: number) {
  const hslColor = color.toHsl()
  const l = hslColor.l * (1 + amount)
  return colord({ ...hslColor, l: clamp(l, 0, 100) })
}

function darken(color: Colord, amount: number) {
  const hslColor = color.toHsl()
  const l = hslColor.l * (1 - amount)
  return colord({ ...hslColor, l: clamp(l, 0, 100) })
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
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const minSize = readConfObject(config, 'minSize')

  const scale = getScale({ ...scaleOpts, range: [0, height] })
  const originY = getOrigin(scaleOpts.scaleType)
  const [niceMin, niceMax] = scale.domain()

  const toY = (n: number) => clamp(height - (scale(n) || 0), 0, height) + offset
  const toOrigin = (n: number) => toY(originY) - toY(n)
  const getHeight = (n: number) => (filled ? toOrigin(n) : Math.max(minSize, 1))
  let hasClipping = false

  let prevLeftPx = -Infinity
  const reducedFeatures = []
  const crossingOrigin = niceMin < pivotValue && niceMax > pivotValue

  // we handle whiskers separately to render max row, min row, and avg in three
  // passes. this reduces subpixel rendering issues. note: for stylistic
  // reasons, clipping indicator is only drawn for score, not min/max score
  if (summaryScoreMode === 'whiskers') {
    let lastCol
    let lastMix
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      if (feature.get('summary')) {
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        const max = feature.get('maxScore')
        const c = colorCallback(feature, max)
        const effectiveC = crossingOrigin
          ? c
          : c === lastCol
            ? lastMix
            : (lastMix = lighten(colord(c), 0.4).toHex())
        fillRectCtx(leftPx, toY(max), w, getHeight(max), ctx, effectiveC)
        lastCol = c
      }
    }
    lastMix = undefined
    lastCol = undefined
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      const max = feature.get('maxScore')
      const min = feature.get('minScore')
      const summary = feature.get('summary')
      const c = colorCallback(feature, score)
      const effectiveC =
        crossingOrigin && summary
          ? c === lastCol
            ? lastMix
            : (lastMix = colord(colorCallback(feature, max))
                .mix(colord(colorCallback(feature, min)))
                .toString())
          : c
      const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
      // create reduced features, avoiding multiple features per px
      if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
        reducedFeatures.push(feature)
        prevLeftPx = leftPx
      }
      hasClipping = hasClipping || score < niceMin || score > niceMax
      fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, effectiveC)
      lastCol = c
    }
    lastMix = undefined
    lastCol = undefined
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      if (feature.get('summary')) {
        const min = feature.get('minScore')
        const c = colorCallback(feature, min)
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        const effectiveC = crossingOrigin
          ? c
          : c === lastCol
            ? lastMix
            : (lastMix = darken(colord(c), 0.4).toHex())

        fillRectCtx(leftPx, toY(min), w, getHeight(min), ctx, effectiveC)
        lastCol = c
      }
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
      const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)

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
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    ticks.values.forEach(tick => {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    })
  }

  return { reducedFeatures }
}
