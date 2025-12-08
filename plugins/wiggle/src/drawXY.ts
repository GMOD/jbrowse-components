import { readConfObject } from '@jbrowse/core/configuration'
import { clamp, featureSpanPx } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
// required to import this for typescript purposes
import mix from 'colord/plugins/mix' // eslint-disable-line @typescript-eslint/no-unused-vars

import { fillRectCtx, getOrigin, getScale } from './util'

import type { ScaleOpts } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Colord } from '@jbrowse/core/util/colord'

function lighten(color: Colord, amount: number) {
  const hslColor = color.toHsl()
  const l = hslColor.l * (1 + amount)
  return colord({
    ...hslColor,
    l: clamp(l, 0, 100),
  })
}

function darken(color: Colord, amount: number) {
  const hslColor = color.toHsl()
  const l = hslColor.l * (1 - amount)
  return colord({
    ...hslColor,
    l: clamp(l, 0, 100),
  })
}

const fudgeFactor = 0.3
const clipHeight = 2

export function drawXY(
  ctx: CanvasRenderingContext2D,
  props: {
    stopToken?: string
    features: Map<string, Feature> | Feature[]
    bpPerPx: number
    regions: Region[]
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    config: AnyConfigurationModel
    displayCrossHatches: boolean
    inverted: boolean
    offset?: number
    colorCallback: (f: Feature, score: number) => string
    // when color is static (e.g. in Multi renderers), set fillStyle once and skip callback
    staticColor?: string
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
    inverted,
    stopToken,
    staticColor,
  } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const height = unadjustedHeight - offset * 2

  const filled = readConfObject(config, 'filled')
  const clipColor = readConfObject(config, 'clipColor')
  const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const minSize = readConfObject(config, 'minSize')

  const scale = getScale({ ...scaleOpts, range: [0, height], inverted })
  const originY = getOrigin(scaleOpts.scaleType)
  const domain = scale.domain()
  const niceMin = domain[0]!
  const niceMax = domain[1]!

  const toY = (n: number) => clamp(height - (scale(n) || 0), 0, height) + offset
  const toOrigin = (n: number) => toY(originY) - toY(n)
  const getHeight = (n: number) => (filled ? toOrigin(n) : Math.max(minSize, 1))

  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []
  const crossingOrigin = niceMin < pivotValue && niceMax > pivotValue

  let start = performance.now()

  // we handle whiskers separately to render max row, min row, and avg in three
  // passes. this reduces subpixel rendering issues. note: for stylistic
  // reasons, clipping indicator is only drawn for score, not min/max score
  if (summaryScoreMode === 'whiskers') {
    // pre-compute feature data to avoid repeated feature.get() calls across passes
    // when staticColor is set, also pre-compute derived colors
    const featureData: {
      feature: Feature
      leftPx: number
      rightPx: number
      score: number
      maxScore: number
      minScore: number
      summary: boolean
      color: string
      lightenedColor?: string
      darkenedColor?: string
      mixedColor?: string
    }[] = []
    const clippingFeatures: { leftPx: number; w: number; high: boolean }[] = []
    const isLog = scaleOpts.scaleType === 'log'
    // inline featureSpanPx: pre-compute region values for pixel calculation
    const regionStart = region.start
    const regionEnd = region.end
    const reversed = region.reversed
    const rpx = (bp: number) =>
      Math.round(((reversed ? regionEnd - bp : bp - regionStart) / bpPerPx) * 10) / 10

    // when staticColor is set, pre-compute all color variants once
    let staticLightened: string | undefined
    let staticDarkened: string | undefined
    let staticMixed: string | undefined
    if (staticColor) {
      const colordStatic = colord(staticColor)
      staticLightened = lighten(colordStatic, 0.4).toHex()
      staticDarkened = darken(colordStatic, 0.4).toHex()
      staticMixed = staticColor // for static color, mixed is just the color itself
    }

    start = performance.now()
    for (const feature of features.values()) {
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
      // inline featureSpanPx to avoid extra function calls and feature.get for start/end
      const fStart = feature.get('start')
      const fEnd = feature.get('end')
      const px1 = rpx(fStart)
      const px2 = rpx(fEnd)
      const leftPx = reversed ? px2 : px1
      const rightPx = reversed ? px1 : px2
      const score = feature.get('score')
      const maxScore = feature.get('maxScore')
      const minScore = feature.get('minScore')
      const summary = feature.get('summary')

      // compute color once per feature
      const color = staticColor || colorCallback(feature, score)

      featureData.push({
        feature,
        leftPx,
        rightPx,
        score,
        maxScore,
        minScore,
        summary,
        color,
        // pre-compute color variants if not using staticColor
        lightenedColor: staticLightened,
        darkenedColor: staticDarkened,
        mixedColor: staticMixed,
      })
      // track clipping during data collection pass
      if (score > niceMax) {
        clippingFeatures.push({ leftPx, w: rightPx - leftPx + fudgeFactor, high: true })
      } else if (score < niceMin && !isLog) {
        clippingFeatures.push({ leftPx, w: rightPx - leftPx + fudgeFactor, high: false })
      }
    }

    let lastCol: string | undefined
    let lastMix: string | undefined
    // pass 1: draw max scores
    for (const fd of featureData) {
      const { leftPx, rightPx, maxScore, summary, color, lightenedColor } = fd
      if (summary) {
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        const effectiveC = crossingOrigin
          ? color
          : lightenedColor ||
            (color === lastCol
              ? lastMix
              : (lastMix = lighten(colord(color), 0.4).toHex()))
        fillRectCtx(leftPx, toY(maxScore), w, getHeight(maxScore), ctx, effectiveC)
        lastCol = color
      }
    }
    lastMix = undefined
    lastCol = undefined
    // pass 2: draw average scores
    for (const fd of featureData) {
      const { feature, leftPx, rightPx, score, maxScore, minScore, summary, color, mixedColor } = fd
      const effectiveC =
        crossingOrigin && summary
          ? mixedColor ||
            (color === lastCol
              ? lastMix
              : (lastMix = colord(colorCallback(feature, maxScore))
                  .mix(colord(colorCallback(feature, minScore)))
                  .toString()))
          : color
      const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
      // bitwise OR is faster than Math.floor for positive numbers
      if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
        reducedFeatures.push(feature)
        prevLeftPx = leftPx
      }
      fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, effectiveC)
      lastCol = color
    }
    lastMix = undefined
    lastCol = undefined
    // pass 3: draw min scores
    for (const fd of featureData) {
      const { leftPx, rightPx, minScore, summary, color, darkenedColor } = fd
      if (summary) {
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        const effectiveC = crossingOrigin
          ? color
          : darkenedColor ||
            (color === lastCol
              ? lastMix
              : (lastMix = darken(colord(color), 0.4).toHex()))

        fillRectCtx(leftPx, toY(minScore), w, getHeight(minScore), ctx, effectiveC)
        lastCol = color
      }
    }

    // draw clipping indicators from cached data
    if (clippingFeatures.length > 0) {
      ctx.save()
      ctx.fillStyle = clipColor
      for (const { leftPx, w, high } of clippingFeatures) {
        if (high) {
          fillRectCtx(leftPx, offset, w, clipHeight, ctx)
        } else {
          fillRectCtx(leftPx, unadjustedHeight, w, clipHeight, ctx)
        }
      }
      ctx.restore()
    }
  } else {
    // track clipping info during first pass to avoid re-iterating
    const clippingFeatures: { leftPx: number; w: number; high: boolean }[] = []
    const isLog = scaleOpts.scaleType === 'log'
    // when staticColor is provided, set fillStyle once and skip colorCallback
    if (staticColor) {
      ctx.fillStyle = staticColor
    }
    start = performance.now()
    for (const feature of features.values()) {
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      // create reduced features, avoiding multiple features per px
      // bitwise OR is faster than Math.floor for positive numbers
      if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
        reducedFeatures.push(feature)
        prevLeftPx = leftPx
      }

      const score = feature.get('score')
      const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)

      // track clipping during first pass
      if (score > niceMax) {
        clippingFeatures.push({ leftPx, w: rightPx - leftPx + fudgeFactor, high: true })
      } else if (score < niceMin && !isLog) {
        clippingFeatures.push({ leftPx, w: rightPx - leftPx + fudgeFactor, high: false })
      }

      // skip colorCallback when staticColor is set
      const c = staticColor || colorCallback(feature, score)

      if (summaryScoreMode === 'max') {
        const summary = feature.get('summary')
        const s = summary ? feature.get('maxScore') : score
        fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
      } else if (summaryScoreMode === 'min') {
        const summary = feature.get('summary')
        const s = summary ? feature.get('minScore') : score
        fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
      } else {
        fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
      }
    }

    // draw clipping indicators from cached data
    if (clippingFeatures.length > 0) {
      ctx.save()
      ctx.fillStyle = clipColor
      for (const { leftPx, w, high } of clippingFeatures) {
        if (high) {
          fillRectCtx(leftPx, offset, w, clipHeight, ctx)
        } else {
          fillRectCtx(leftPx, unadjustedHeight, w, clipHeight, ctx)
        }
      }
      ctx.restore()
    }
  }

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    for (const tick of ticks.values) {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    }
  }

  return {
    reducedFeatures,
  }
}
