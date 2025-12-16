import { readConfObject } from '@jbrowse/core/configuration'
import { clamp } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
// required to import this for typescript purposes
import mix from 'colord/plugins/mix' // eslint-disable-line @typescript-eslint/no-unused-vars

import { getOrigin, getScale } from './util'

import type { ScaleOpts } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Colord } from '@jbrowse/core/util/colord'

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

export interface WiggleFeatureArrays {
  starts: ArrayLike<number>
  ends: ArrayLike<number>
  scores: ArrayLike<number>
  minScores?: ArrayLike<number>
  maxScores?: ArrayLike<number>
}

/**
 * Optimized drawXY that takes structure-of-arrays directly from BigWig adapter.
 * Avoids feature object creation and method call overhead.
 * Best used with staticColor (e.g., MultiRowXYPlot renderer).
 */
export function drawXYArrays(
  ctx: CanvasRenderingContext2D,
  props: {
    featureArrays: WiggleFeatureArrays
    bpPerPx: number
    regions: Region[]
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    config: AnyConfigurationModel
    displayCrossHatches: boolean
    inverted: boolean
    offset?: number
    color: string
    stopToken?: string
    // allow filled prop to override config value (like drawXY)
    filled?: boolean
  },
) {
  const {
    featureArrays,
    bpPerPx,
    regions,
    scaleOpts,
    height: unadjustedHeight,
    config,
    ticks,
    displayCrossHatches,
    offset = 0,
    color,
    inverted,
    stopToken,
    filled: filledProp,
  } = props

  const { starts, ends, scores, minScores, maxScores } = featureArrays
  const len = starts.length
  if (len === 0) {
    return
  }

  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
  const width = (regionEnd - regionStart) * invBpPerPx

  const height = unadjustedHeight - offset * 2

  // allow filled prop to override config value (for point renderers)
  const filled = filledProp ?? readConfObject(config, 'filled')
  const clipColor = readConfObject(config, 'clipColor')
  const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
  const minSize = readConfObject(config, 'minSize')

  const scale = getScale({ ...scaleOpts, range: [0, height], inverted })
  const originY = getOrigin(scaleOpts.scaleType)
  const domain = scale.domain() as [number, number]
  const niceMin = domain[0]
  const niceMax = domain[1]
  const domainSpan = niceMax - niceMin
  const isLog = scaleOpts.scaleType === 'log'

  // Precompute scale constants
  const linearRatio = domainSpan !== 0 ? height / domainSpan : 0
  const log2 = Math.log(2)
  const logMin = Math.log(niceMin) / log2
  const logRatio =
    scaleOpts.scaleType === 'log'
      ? height / (Math.log(niceMax) / log2 - logMin)
      : 0

  // Precompute origin Y for filled mode (must match toY logic with clamp)
  const originYScaled = isLog
    ? (Math.log(originY) / log2 - logMin) * logRatio
    : (originY - niceMin) * linearRatio
  const originYClamped = clamp(
    inverted ? originYScaled : height - originYScaled,
    0,
    height,
  )
  const originYPx = originYClamped + offset

  // Select score array once based on summaryScoreMode
  const isSummary = minScores !== undefined
  const scoreArr =
    summaryScoreMode === 'max' && isSummary
      ? maxScores!
      : summaryScoreMode === 'min' && isSummary
        ? minScores!
        : scores

  ctx.fillStyle = color

  // Track clipping regions during main loop to avoid second pass
  let clipHighCount = 0
  let clipLowCount = 0
  // Preallocate clipping arrays only if we might need them
  const clipHighPx: number[] = []
  const clipHighW: number[] = []
  const clipLowPx: number[] = []
  const clipLowW: number[] = []

  // Time-based stop token check (Date.now is faster than performance.now)
  let lastCheck = Date.now()

  // Main drawing loop - fully inlined for performance
  if (isLog) {
    // Log scale path
    for (let i = 0; i < len; i++) {
      // Check stop token every ~10000 iterations if 400ms elapsed
      if (i % 10000 === 0) {
        const now = Date.now()
        if (now - lastCheck > 400) {
          checkStopToken(stopToken)
          lastCheck = now
        }
      }
      const fstart = starts[i]!
      const fend = ends[i]!
      const leftPx = reversed
        ? (regionEnd - fend) * invBpPerPx
        : (fstart - regionStart) * invBpPerPx
      const rightPx = reversed
        ? (regionEnd - fstart) * invBpPerPx
        : (fend - regionStart) * invBpPerPx
      const score = scoreArr[i]!
      const w = rightPx - leftPx + fudgeFactor

      // Inline toY for log scale (with clamp to match original)
      const scaled = (Math.log(score) / log2 - logMin) * logRatio
      const yClamped = clamp(inverted ? scaled : height - scaled, 0, height)
      const y = yClamped + offset

      // Inline getHeight
      const h = filled ? originYPx - y : Math.max(minSize, 1)

      ctx.fillRect(leftPx, y, Math.max(w, minSize), h)

      // Track clipping
      if (score > niceMax) {
        clipHighPx[clipHighCount] = leftPx
        clipHighW[clipHighCount++] = w
      }
    }
  } else {
    // Linear scale path (most common)
    for (let i = 0; i < len; i++) {
      // Check stop token every ~10000 iterations if 400ms elapsed
      if (i % 10000 === 0) {
        const now = Date.now()
        if (now - lastCheck > 400) {
          checkStopToken(stopToken)
          lastCheck = now
        }
      }
      const fstart = starts[i]!
      const fend = ends[i]!
      const leftPx = reversed
        ? (regionEnd - fend) * invBpPerPx
        : (fstart - regionStart) * invBpPerPx
      const rightPx = reversed
        ? (regionEnd - fstart) * invBpPerPx
        : (fend - regionStart) * invBpPerPx
      const score = scoreArr[i]!
      const w = rightPx - leftPx + fudgeFactor

      // Inline toY for linear scale (with clamp to match original)
      const scaled = (score - niceMin) * linearRatio
      const yClamped = clamp(inverted ? scaled : height - scaled, 0, height)
      const y = yClamped + offset

      // Inline getHeight
      const h = filled ? originYPx - y : Math.max(minSize, 1)

      ctx.fillRect(leftPx, y, Math.max(w, minSize), h)

      // Track clipping
      if (score > niceMax) {
        clipHighPx[clipHighCount] = leftPx
        clipHighW[clipHighCount++] = w
      } else if (score < niceMin) {
        clipLowPx[clipLowCount] = leftPx
        clipLowW[clipLowCount++] = w
      }
    }
  }

  // Draw clipping indicators from cached data
  if (clipHighCount > 0 || clipLowCount > 0) {
    ctx.fillStyle = clipColor
    for (let i = 0; i < clipHighCount; i++) {
      ctx.fillRect(clipHighPx[i]!, offset, clipHighW[i]!, clipHeight)
    }
    for (let i = 0; i < clipLowCount; i++) {
      ctx.fillRect(
        clipLowPx[i]!,
        unadjustedHeight - clipHeight,
        clipLowW[i]!,
        clipHeight,
      )
    }
  }

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    for (const tick of ticks.values) {
      const scaled = isLog
        ? (Math.log(tick) / log2 - logMin) * logRatio
        : (tick - niceMin) * linearRatio
      const y = inverted ? scaled + offset : height - scaled + offset
      ctx.beginPath()
      ctx.moveTo(0, Math.round(y))
      ctx.lineTo(width, Math.round(y))
      ctx.stroke()
    }
  }
}

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
    // override config filled value (for point renderers)
    filled?: boolean
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
    filled: filledProp,
  } = props
  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
  const width = (regionEnd - regionStart) * invBpPerPx

  const height = unadjustedHeight - offset * 2

  // allow filled prop to override config value (for point renderers)
  const filled = filledProp ?? readConfObject(config, 'filled')
  const clipColor = readConfObject(config, 'clipColor')
  const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const minSize = readConfObject(config, 'minSize')

  // Use d3-scale only to get the "niced" domain, then use simple arithmetic
  const scale = getScale({ ...scaleOpts, range: [0, height], inverted })
  const originY = getOrigin(scaleOpts.scaleType)
  const domain = scale.domain() as [number, number]
  const niceMin = domain[0]
  const niceMax = domain[1]
  const domainSpan = niceMax - niceMin
  const isLog = scaleOpts.scaleType === 'log'

  // Precompute values for linear scale
  const linearRatio = domainSpan !== 0 ? height / domainSpan : 0

  // Precompute values for log scale (base 2)
  const log2 = Math.log(2)
  const logMin = Math.log(niceMin) / log2
  const logMax = Math.log(niceMax) / log2
  const logSpan = logMax - logMin
  const logRatio = logSpan !== 0 ? height / logSpan : 0

  // Simple arithmetic scale function - avoid d3-scale overhead in hot path
  const toY = isLog
    ? (n: number) => {
        const scaled = (Math.log(n) / log2 - logMin) * logRatio
        return (
          clamp(height - (inverted ? height - scaled : scaled), 0, height) +
          offset
        )
      }
    : (n: number) => {
        const scaled = (n - niceMin) * linearRatio
        return (
          clamp(height - (inverted ? height - scaled : scaled), 0, height) +
          offset
        )
      }
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
      Math.round(
        ((reversed ? regionEnd - bp : bp - regionStart) / bpPerPx) * 10,
      ) / 10

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
        clippingFeatures.push({
          leftPx,
          w: rightPx - leftPx + fudgeFactor,
          high: true,
        })
      } else if (score < niceMin && !isLog) {
        clippingFeatures.push({
          leftPx,
          w: rightPx - leftPx + fudgeFactor,
          high: false,
        })
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
        fillRectCtx(
          leftPx,
          toY(maxScore),
          w,
          getHeight(maxScore),
          ctx,
          effectiveC,
        )
        lastCol = color
      }
    }
    lastMix = undefined
    lastCol = undefined
    // pass 2: draw average scores
    for (const fd of featureData) {
      const {
        feature,
        leftPx,
        rightPx,
        score,
        maxScore,
        minScore,
        summary,
        color,
        mixedColor,
      } = fd
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

        fillRectCtx(
          leftPx,
          toY(minScore),
          w,
          getHeight(minScore),
          ctx,
          effectiveC,
        )
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
      const fstart = feature.get('start')
      const fend = feature.get('end')
      const leftPx = reversed
        ? (regionEnd - fend) * invBpPerPx
        : (fstart - regionStart) * invBpPerPx
      const rightPx = reversed
        ? (regionEnd - fstart) * invBpPerPx
        : (fend - regionStart) * invBpPerPx

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
        clippingFeatures.push({
          leftPx,
          w: rightPx - leftPx + fudgeFactor,
          high: true,
        })
      } else if (score < niceMin && !isLog) {
        clippingFeatures.push({
          leftPx,
          w: rightPx - leftPx + fudgeFactor,
          high: false,
        })
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
