import { readConfObject } from '@jbrowse/core/configuration'
import { clamp } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
// required to import this for typescript purposes
import mix from 'colord/plugins/mix' // eslint-disable-line @typescript-eslint/no-unused-vars

import {
  WIGGLE_CLIP_HEIGHT,
  WIGGLE_FUDGE_FACTOR,
  getOrigin,
  getScale,
} from './util'

import type {
  ReducedFeatureArrays,
  ScaleOpts,
  WiggleFeatureArrays,
} from './util'
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

/**
 * Optimized drawXY that takes structure-of-arrays directly from BigWig adapter.
 * Avoids feature object creation and method call overhead.
 * Best used with staticColor (e.g., MultiRowXYPlot renderer).
 * Returns reduced feature arrays (one per pixel column) for tooltip support.
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
    color?: string
    // optional bicolor support - when provided, color is determined by score vs pivotValue
    posColor?: string
    negColor?: string
    pivotValue?: number
    stopToken?: string
    // allow filled prop to override config value (like drawXY)
    filled?: boolean
  },
): { reducedFeatures: ReducedFeatureArrays } {
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
    posColor,
    negColor,
    pivotValue = 0,
    inverted,
    stopToken,
    filled: filledProp,
  } = props

  // Determine if we're using bicolor mode
  const useBicolor = posColor !== undefined && negColor !== undefined
  const staticColor = color ?? posColor ?? 'blue'

  // Debug logging
  console.log('[drawXYArrays] color config:', { color, posColor, negColor, useBicolor, staticColor })

  const { starts, ends, scores, minScores, maxScores } = featureArrays
  const len = starts.length
  if (len === 0) {
    return {
      reducedFeatures: { starts: [], ends: [], scores: [] },
    }
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
        ? minScores
        : scores

  // Set initial fill color (will be changed per-feature in bicolor mode)
  ctx.fillStyle = staticColor
  console.log('[drawXYArrays] ctx.fillStyle set to:', ctx.fillStyle, 'staticColor was:', staticColor)

  // Track reduced features for tooltip support
  const reducedStarts: number[] = []
  const reducedEnds: number[] = []
  const reducedScores: number[] = []
  const reducedMinScores: number[] | undefined = minScores ? [] : undefined
  const reducedMaxScores: number[] | undefined = maxScores ? [] : undefined

  let lastCheck = Date.now()

  // Check if features are sub-pixel by sampling the first feature
  // Only use two-pass deduplication when features are < 1px wide
  const firstFeatureWidth = len > 0 ? (ends[0]! - starts[0]!) * invBpPerPx : 0
  const usePixelDedup = filled && firstFeatureWidth < 1

  console.log('[drawXYArrays] drawing path:', { usePixelDedup, filled, len, useBicolor })

  if (usePixelDedup) {
    // Two-pass approach for sub-pixel features: collect max scores per pixel column,
    // then draw once per column. This reduces fillRect calls significantly.
    const widthPx = Math.ceil(width) + 1
    const maxScorePerPx = new Float32Array(widthPx)
    const hasData = new Uint8Array(widthPx)
    const featureIdxPerPx = new Int32Array(widthPx)
    const clipFlag = new Uint8Array(widthPx)

    // First pass: collect max score per pixel column
    for (let i = 0; i < len; i++) {
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

      const pxCol = leftPx | 0
      if (pxCol >= 0 && pxCol < widthPx) {
        const score = scoreArr[i]!
        if (!hasData[pxCol] || score > maxScorePerPx[pxCol]!) {
          maxScorePerPx[pxCol] = score
          hasData[pxCol] = 1
          featureIdxPerPx[pxCol] = i
        }
        if (score > niceMax) {
          clipFlag[pxCol] = 1
        } else if (score < niceMin && !isLog && clipFlag[pxCol] !== 1) {
          clipFlag[pxCol] = 2
        }
      }
    }

    // Second pass: draw one rect per pixel column and build reduced features
    const rectW = Math.max(1 + WIGGLE_FUDGE_FACTOR, minSize)
    for (let px = 0; px < widthPx; px++) {
      if (hasData[px]) {
        const idx = featureIdxPerPx[px]!
        const score = maxScorePerPx[px]!
        const scaled = isLog
          ? (Math.log(score) / log2 - logMin) * logRatio
          : (score - niceMin) * linearRatio
        const yClamped = clamp(inverted ? scaled : height - scaled, 0, height)
        const y = yClamped + offset
        if (useBicolor) {
          ctx.fillStyle = score < pivotValue ? negColor : posColor
        }
        ctx.fillRect(px, y, rectW, originYPx - y)

        // Build reduced features for tooltip support
        reducedStarts.push(starts[idx]!)
        reducedEnds.push(ends[idx]!)
        reducedScores.push(scores[idx]!)
        if (reducedMinScores && minScores) {
          reducedMinScores.push(minScores[idx]!)
        }
        if (reducedMaxScores && maxScores) {
          reducedMaxScores.push(maxScores[idx]!)
        }
      }
    }

    // Draw clipping indicators
    ctx.fillStyle = clipColor
    for (let px = 0; px < widthPx; px++) {
      if (clipFlag[px] === 1) {
        ctx.fillRect(px, offset, rectW, WIGGLE_CLIP_HEIGHT)
      } else if (clipFlag[px] === 2) {
        ctx.fillRect(
          px,
          unadjustedHeight - WIGGLE_CLIP_HEIGHT,
          rectW,
          WIGGLE_CLIP_HEIGHT,
        )
      }
    }
  } else if (filled) {
    // Filled mode with features >= 1px: draw each feature individually
    let prevLeftPx = Number.NEGATIVE_INFINITY

    for (let i = 0; i < len; i++) {
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
      const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)

      // Track reduced features (one per pixel column)
      if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
        reducedStarts.push(fstart)
        reducedEnds.push(fend)
        reducedScores.push(scores[i]!)
        if (reducedMinScores && minScores) {
          reducedMinScores.push(minScores[i]!)
        }
        if (reducedMaxScores && maxScores) {
          reducedMaxScores.push(maxScores[i]!)
        }
        prevLeftPx = leftPx
      }

      const scaled = isLog
        ? (Math.log(score) / log2 - logMin) * logRatio
        : (score - niceMin) * linearRatio
      const yClamped = clamp(inverted ? scaled : height - scaled, 0, height)
      const y = yClamped + offset
      const featureColor = useBicolor
        ? score < pivotValue
          ? negColor
          : posColor
        : staticColor
      ctx.fillStyle = featureColor
      ctx.fillRect(leftPx, y, w, originYPx - y)

      // Draw clipping indicator
      if (score > niceMax) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, offset, w, WIGGLE_CLIP_HEIGHT)
        ctx.fillStyle = featureColor
      } else if (score < niceMin && !isLog) {
        ctx.fillStyle = clipColor
        ctx.fillRect(
          leftPx,
          unadjustedHeight - WIGGLE_CLIP_HEIGHT,
          w,
          WIGGLE_CLIP_HEIGHT,
        )
        ctx.fillStyle = featureColor
      }
    }
  } else {
    // Non-filled (scatterplot) mode: draw each feature individually
    const clipHighPx: number[] = []
    const clipHighW: number[] = []
    const clipLowPx: number[] = []
    const clipLowW: number[] = []
    let clipHighCount = 0
    let clipLowCount = 0
    let prevLeftPx = Number.NEGATIVE_INFINITY
    const dotSize = Math.max(minSize, 1)

    for (let i = 0; i < len; i++) {
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
      const w = rightPx - leftPx + WIGGLE_FUDGE_FACTOR

      // Track reduced features (one per pixel column)
      if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
        reducedStarts.push(fstart)
        reducedEnds.push(fend)
        reducedScores.push(scores[i]!)
        if (reducedMinScores && minScores) {
          reducedMinScores.push(minScores[i]!)
        }
        if (reducedMaxScores && maxScores) {
          reducedMaxScores.push(maxScores[i]!)
        }
        prevLeftPx = leftPx
      }

      const scaled = isLog
        ? (Math.log(score) / log2 - logMin) * logRatio
        : (score - niceMin) * linearRatio
      const yClamped = clamp(inverted ? scaled : height - scaled, 0, height)
      const y = yClamped + offset

      if (useBicolor) {
        ctx.fillStyle = score < pivotValue ? negColor : posColor
      }
      ctx.fillRect(leftPx, y, Math.max(w, minSize), dotSize)

      // Track clipping
      if (score > niceMax) {
        clipHighPx[clipHighCount] = leftPx
        clipHighW[clipHighCount++] = w
      } else if (!isLog && score < niceMin) {
        clipLowPx[clipLowCount] = leftPx
        clipLowW[clipLowCount++] = w
      }
    }

    // Draw clipping indicators
    if (clipHighCount > 0 || clipLowCount > 0) {
      ctx.fillStyle = clipColor
      for (let i = 0; i < clipHighCount; i++) {
        ctx.fillRect(clipHighPx[i]!, offset, clipHighW[i]!, WIGGLE_CLIP_HEIGHT)
      }
      for (let i = 0; i < clipLowCount; i++) {
        ctx.fillRect(
          clipLowPx[i]!,
          unadjustedHeight - WIGGLE_CLIP_HEIGHT,
          clipLowW[i]!,
          WIGGLE_CLIP_HEIGHT,
        )
      }
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

  return {
    reducedFeatures: {
      starts: reducedStarts,
      ends: reducedEnds,
      scores: reducedScores,
      minScores: reducedMinScores,
      maxScores: reducedMaxScores,
    },
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
          w: rightPx - leftPx + WIGGLE_FUDGE_FACTOR,
          high: true,
        })
      } else if (score < niceMin && !isLog) {
        clippingFeatures.push({
          leftPx,
          w: rightPx - leftPx + WIGGLE_FUDGE_FACTOR,
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
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)
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
      const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)
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
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)
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
          fillRectCtx(leftPx, offset, w, WIGGLE_CLIP_HEIGHT, ctx)
        } else {
          fillRectCtx(leftPx, unadjustedHeight, w, WIGGLE_CLIP_HEIGHT, ctx)
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
      const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)

      // track clipping during first pass
      if (score > niceMax) {
        clippingFeatures.push({
          leftPx,
          w: rightPx - leftPx + WIGGLE_FUDGE_FACTOR,
          high: true,
        })
      } else if (score < niceMin && !isLog) {
        clippingFeatures.push({
          leftPx,
          w: rightPx - leftPx + WIGGLE_FUDGE_FACTOR,
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
          fillRectCtx(leftPx, offset, w, WIGGLE_CLIP_HEIGHT, ctx)
        } else {
          fillRectCtx(leftPx, unadjustedHeight, w, WIGGLE_CLIP_HEIGHT, ctx)
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

export { type ReducedFeatureArrays, type WiggleFeatureArrays } from './util'
