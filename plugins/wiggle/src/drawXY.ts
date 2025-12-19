import { readConfObject } from '@jbrowse/core/configuration'
import { clamp } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
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
  lastFillStyle?: { value: string },
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
    if (lastFillStyle) {
      if (color !== lastFillStyle.value) {
        ctx.fillStyle = color
        lastFillStyle.value = color
      }
    } else {
      ctx.fillStyle = color
    }
  }
  ctx.fillRect(x, y, width, height)
}

function addRectToPath(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }
  ctx.rect(x, y, width, height)
}

interface ColorArrays {
  colors?: string[]
  lightenedColors?: string[]
  darkenedColors?: string[]
  maxScoreColors?: string[]
  minScoreColors?: string[]
}

/**
 * Convert Feature objects to structure-of-arrays format for use with drawXYArrays.
 * Optionally computes per-feature colors using the provided callback.
 * When whiskers=true, also pre-computes lightened/darkened colors for the 3-pass rendering.
 */
function featuresToArrays(
  features: Map<string, Feature> | Feature[],
  colorCallback?: (f: Feature, score: number) => string,
  whiskers?: boolean,
): WiggleFeatureArrays & ColorArrays {
  const featureList = Array.isArray(features)
    ? features
    : Array.from(features.values())
  const len = featureList.length
  const starts = new Int32Array(len)
  const ends = new Int32Array(len)
  const scores = new Float32Array(len)
  const minScoresArr = new Float32Array(len)
  const maxScoresArr = new Float32Array(len)
  const colors = colorCallback ? new Array<string>(len) : undefined
  const lightenedColors = colorCallback && whiskers ? new Array<string>(len) : undefined
  const darkenedColors = colorCallback && whiskers ? new Array<string>(len) : undefined
  const maxScoreColors = colorCallback && whiskers ? new Array<string>(len) : undefined
  const minScoreColors = colorCallback && whiskers ? new Array<string>(len) : undefined
  let hasSummary = false

  // Cache for color transformations to avoid recomputing for same colors
  let lastColor = ''
  let lastLightened = ''
  let lastDarkened = ''

  for (let i = 0; i < len; i++) {
    const f = featureList[i]!
    const score = f.get('score')
    starts[i] = f.get('start')
    ends[i] = f.get('end')
    scores[i] = score
    const isSummary = f.get('summary')
    if (isSummary) {
      hasSummary = true
      minScoresArr[i] = f.get('minScore')
      maxScoresArr[i] = f.get('maxScore')
    }
    if (colors && colorCallback) {
      const color = colorCallback(f, score)
      colors[i] = color
      if (whiskers) {
        // Cache lightened/darkened colors to avoid recomputing for same color
        if (color !== lastColor) {
          const colordColor = colord(color)
          lastLightened = lighten(colordColor, 0.4).toHex()
          lastDarkened = darken(colordColor, 0.4).toHex()
          lastColor = color
        }
        lightenedColors![i] = lastLightened
        darkenedColors![i] = lastDarkened
        if (isSummary) {
          maxScoreColors![i] = colorCallback(f, maxScoresArr[i]!)
          minScoreColors![i] = colorCallback(f, minScoresArr[i]!)
        }
      }
    }
  }

  return {
    starts,
    ends,
    scores,
    minScores: hasSummary ? minScoresArr : undefined,
    maxScores: hasSummary ? maxScoresArr : undefined,
    colors,
    lightenedColors,
    darkenedColors,
    maxScoreColors,
    minScoreColors,
  }
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
    featureArrays: WiggleFeatureArrays & ColorArrays
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

  // Determine color mode: per-feature colors, bicolor, or static color
  const {
    starts,
    ends,
    scores,
    minScores,
    maxScores,
    colors,
    lightenedColors,
    darkenedColors,
    maxScoreColors,
    minScoreColors,
  } = featureArrays
  const usePerFeatureColors = colors !== undefined && colors.length > 0
  const useBicolor = !usePerFeatureColors && posColor !== undefined && negColor !== undefined
  const staticColor = color ?? posColor ?? 'blue'
  // Check alpha once - can't batch if color has alpha or per-feature colors
  const hasAlpha = colord(staticColor).alpha() < 1
  const canBatch = !usePerFeatureColors && !useBicolor && !hasAlpha
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

  // Track reduced features for tooltip support
  const reducedStarts: number[] = []
  const reducedEnds: number[] = []
  const reducedScores: number[] = []
  const reducedMinScores: number[] | undefined = minScores ? [] : undefined
  const reducedMaxScores: number[] | undefined = maxScores ? [] : undefined

  const lastCheck = { time: Date.now() }
  const isSummary = minScores !== undefined

  // Handle whiskers mode with 3-pass rendering (max, avg, min scores)
  if (summaryScoreMode === 'whiskers' && isSummary && filled) {
    let prevLeftPx = Number.NEGATIVE_INFINITY

    const toY = (n: number) => {
      const scaled = isLog
        ? (Math.log(n) / log2 - logMin) * logRatio
        : (n - niceMin) * linearRatio
      return clamp(inverted ? scaled : height - scaled, 0, height) + offset
    }
    const toOrigin = (n: number) => toY(originY) - toY(n)

    // Determine if we can batch (static color, no alpha)
    const useWhiskersPerFeatureColors = lightenedColors !== undefined
    const colordStatic = colord(staticColor)
    const lightenedColor = lighten(colordStatic, 0.4).toHex()
    const darkenedColor = darken(colordStatic, 0.4).toHex()

    // Check if crossing origin for mixed color mode
    const bicolorPivotValue = readConfObject(config, 'bicolorPivotValue')
    const crossingOrigin = niceMin < bicolorPivotValue && niceMax > bicolorPivotValue

    if (useWhiskersPerFeatureColors) {
      // Per-feature colors path (cannot batch)
      const lastFillStyle = { value: '' }

      // Pass 1: max scores (lightened)
      for (let i = 0; i < len; i++) {
        checkStopToken2(stopToken, i, lastCheck)
        const fstart = starts[i]!
        const fend = ends[i]!
        const leftPx = reversed
          ? (regionEnd - fend) * invBpPerPx
          : (fstart - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - fstart) * invBpPerPx
          : (fend - regionStart) * invBpPerPx
        const maxScore = maxScores![i]!
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)
        const featureColor = crossingOrigin ? colors![i]! : lightenedColors![i]!
        fillRectCtx(leftPx, toY(maxScore), w, toOrigin(maxScore), ctx, featureColor, lastFillStyle)
      }
      lastFillStyle.value = ''

      // Pass 2: average scores
      for (let i = 0; i < len; i++) {
        const fstart = starts[i]!
        const fend = ends[i]!
        const leftPx = reversed
          ? (regionEnd - fend) * invBpPerPx
          : (fstart - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - fstart) * invBpPerPx
          : (fend - regionStart) * invBpPerPx
        const score = scores[i]!
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)

        if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
          reducedStarts.push(fstart)
          reducedEnds.push(fend)
          reducedScores.push(score)
          if (reducedMinScores) {
            reducedMinScores.push(minScores![i]!)
          }
          if (reducedMaxScores) {
            reducedMaxScores.push(maxScores![i]!)
          }
          prevLeftPx = leftPx
        }

        // For crossing origin, mix maxScore and minScore colors
        let featureColor = colors![i]!
        if (crossingOrigin && maxScoreColors && minScoreColors) {
          featureColor = colord(maxScoreColors[i]!).mix(colord(minScoreColors[i]!)).toHex()
        }
        fillRectCtx(leftPx, toY(score), w, toOrigin(score), ctx, featureColor, lastFillStyle)
      }
      lastFillStyle.value = ''

      // Pass 3: min scores (darkened)
      for (let i = 0; i < len; i++) {
        const fstart = starts[i]!
        const fend = ends[i]!
        const leftPx = reversed
          ? (regionEnd - fend) * invBpPerPx
          : (fstart - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - fstart) * invBpPerPx
          : (fend - regionStart) * invBpPerPx
        const minScore = minScores![i]!
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)
        const featureColor = crossingOrigin ? colors![i]! : darkenedColors![i]!
        fillRectCtx(leftPx, toY(minScore), w, toOrigin(minScore), ctx, featureColor, lastFillStyle)
      }
    } else {
      // Static color path (can batch all rects)
      // Pass 1: max scores (lightened)
      ctx.beginPath()
      for (let i = 0; i < len; i++) {
        checkStopToken2(stopToken, i, lastCheck)
        const fstart = starts[i]!
        const fend = ends[i]!
        const leftPx = reversed
          ? (regionEnd - fend) * invBpPerPx
          : (fstart - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - fstart) * invBpPerPx
          : (fend - regionStart) * invBpPerPx
        const maxScore = maxScores![i]!
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)
        addRectToPath(leftPx, toY(maxScore), w, toOrigin(maxScore), ctx)
      }
      ctx.fillStyle = lightenedColor
      ctx.fill()

      // Pass 2: average scores
      ctx.beginPath()
      for (let i = 0; i < len; i++) {
        const fstart = starts[i]!
        const fend = ends[i]!
        const leftPx = reversed
          ? (regionEnd - fend) * invBpPerPx
          : (fstart - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - fstart) * invBpPerPx
          : (fend - regionStart) * invBpPerPx
        const score = scores[i]!
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)

        if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
          reducedStarts.push(fstart)
          reducedEnds.push(fend)
          reducedScores.push(score)
          if (reducedMinScores) {
            reducedMinScores.push(minScores![i]!)
          }
          if (reducedMaxScores) {
            reducedMaxScores.push(maxScores![i]!)
          }
          prevLeftPx = leftPx
        }
        addRectToPath(leftPx, toY(score), w, toOrigin(score), ctx)
      }
      ctx.fillStyle = staticColor
      ctx.fill()

      // Pass 3: min scores (darkened)
      ctx.beginPath()
      for (let i = 0; i < len; i++) {
        const fstart = starts[i]!
        const fend = ends[i]!
        const leftPx = reversed
          ? (regionEnd - fend) * invBpPerPx
          : (fstart - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - fstart) * invBpPerPx
          : (fend - regionStart) * invBpPerPx
        const minScore = minScores![i]!
        const w = Math.max(rightPx - leftPx + WIGGLE_FUDGE_FACTOR, minSize)
        addRectToPath(leftPx, toY(minScore), w, toOrigin(minScore), ctx)
      }
      ctx.fillStyle = darkenedColor
      ctx.fill()
    }

    if (displayCrossHatches) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(200,200,200,0.5)'
      for (const tick of ticks.values) {
        const y = toY(tick)
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

  // Select score array once based on summaryScoreMode
  const scoreArr =
    summaryScoreMode === 'max' && isSummary
      ? maxScores!
      : summaryScoreMode === 'min' && isSummary
        ? minScores
        : scores

  // Set initial fill color (will be changed per-feature in bicolor mode)
  ctx.fillStyle = staticColor

  // Use pixel deduplication when features are sub-pixel for efficiency.
  // The first pass marks all pixel columns each feature covers (not just the
  // starting column), so variable-width features are handled correctly even
  // if only the first feature is checked here.
  const firstFeatureWidth = len > 0 ? (ends[0]! - starts[0]!) * invBpPerPx : 0
  const usePixelDedup = filled && firstFeatureWidth < 1

  if (usePixelDedup) {
    // Two-pass approach for sub-pixel features: collect max scores per pixel column,
    // then draw once per column. This reduces fillRect calls significantly.
    const widthPx = Math.ceil(width) + 1
    const maxScorePerPx = new Float32Array(widthPx)
    const hasData = new Uint8Array(widthPx)
    const featureIdxPerPx = new Int32Array(widthPx)
    const clipFlag = new Uint8Array(widthPx)

    // First pass: collect max score per pixel column, marking all columns each feature covers
    for (let i = 0; i < len; i++) {
      checkStopToken2(stopToken, i, lastCheck)
      const fstart = starts[i]!
      const fend = ends[i]!
      const leftPx = reversed
        ? (regionEnd - fend) * invBpPerPx
        : (fstart - regionStart) * invBpPerPx
      const rightPx = reversed
        ? (regionEnd - fstart) * invBpPerPx
        : (fend - regionStart) * invBpPerPx

      // Mark all pixel columns this feature covers
      const startCol = Math.max(0, leftPx | 0)
      const endCol = Math.min(widthPx - 1, rightPx | 0)
      const score = scoreArr[i]!

      for (let pxCol = startCol; pxCol <= endCol; pxCol++) {
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
    let lastAddedIdx = -1
    for (let px = 0; px < widthPx; px++) {
      if (hasData[px]) {
        const idx = featureIdxPerPx[px]!
        const score = maxScorePerPx[px]!
        const scaled = isLog
          ? (Math.log(score) / log2 - logMin) * logRatio
          : (score - niceMin) * linearRatio
        const yClamped = clamp(inverted ? scaled : height - scaled, 0, height)
        const y = yClamped + offset
        if (usePerFeatureColors) {
          ctx.fillStyle = colors![idx]!
        } else if (useBicolor) {
          ctx.fillStyle = score < pivotValue ? negColor : posColor
        }
        ctx.fillRect(px, y, rectW, originYPx - y)

        // Build reduced features for tooltip support (avoid duplicates)
        if (idx !== lastAddedIdx) {
          reducedStarts.push(starts[idx]!)
          reducedEnds.push(ends[idx]!)
          reducedScores.push(scores[idx]!)
          if (reducedMinScores && minScores) {
            reducedMinScores.push(minScores[idx]!)
          }
          if (reducedMaxScores && maxScores) {
            reducedMaxScores.push(maxScores[idx]!)
          }
          lastAddedIdx = idx
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
    // Filled mode with features >= 1px
    let prevLeftPx = Number.NEGATIVE_INFINITY
    const clipHighPx: number[] = []
    const clipHighW: number[] = []
    const clipLowPx: number[] = []
    const clipLowW: number[] = []
    let clipHighCount = 0
    let clipLowCount = 0

    if (canBatch) {
      ctx.beginPath()
      for (let i = 0; i < len; i++) {
        checkStopToken2(stopToken, i, lastCheck)
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
        addRectToPath(leftPx, y, w, originYPx - y, ctx)

        if (score > niceMax) {
          clipHighPx[clipHighCount] = leftPx
          clipHighW[clipHighCount++] = w
        } else if (score < niceMin && !isLog) {
          clipLowPx[clipLowCount] = leftPx
          clipLowW[clipLowCount++] = w
        }
      }
      ctx.fillStyle = staticColor
      ctx.fill()
    } else {
      let lastFillStyle = ''
      for (let i = 0; i < len; i++) {
        checkStopToken2(stopToken, i, lastCheck)
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
        const featureColor = usePerFeatureColors
          ? colors![i]!
          : useBicolor
            ? score < pivotValue
              ? negColor
              : posColor
            : staticColor
        if (featureColor !== lastFillStyle) {
          ctx.fillStyle = featureColor
          lastFillStyle = featureColor
        }
        ctx.fillRect(leftPx, y, w, originYPx - y)

        if (score > niceMax) {
          clipHighPx[clipHighCount] = leftPx
          clipHighW[clipHighCount++] = w
        } else if (score < niceMin && !isLog) {
          clipLowPx[clipLowCount] = leftPx
          clipLowW[clipLowCount++] = w
        }
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
  } else {
    // Non-filled (scatterplot) mode
    const clipHighPx: number[] = []
    const clipHighW: number[] = []
    const clipLowPx: number[] = []
    const clipLowW: number[] = []
    let clipHighCount = 0
    let clipLowCount = 0
    let prevLeftPx = Number.NEGATIVE_INFINITY
    const dotSize = Math.max(minSize, 1)

    if (canBatch) {
      ctx.beginPath()
      for (let i = 0; i < len; i++) {
        checkStopToken2(stopToken, i, lastCheck)
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
        addRectToPath(leftPx, y, Math.max(w, minSize), dotSize, ctx)

        if (score > niceMax) {
          clipHighPx[clipHighCount] = leftPx
          clipHighW[clipHighCount++] = w
        } else if (!isLog && score < niceMin) {
          clipLowPx[clipLowCount] = leftPx
          clipLowW[clipLowCount++] = w
        }
      }
      ctx.fillStyle = staticColor
      ctx.fill()
    } else {
      let lastFillStyle = ''
      if (!useBicolor && !usePerFeatureColors) {
        ctx.fillStyle = staticColor
        lastFillStyle = staticColor
      }
      for (let i = 0; i < len; i++) {
        checkStopToken2(stopToken, i, lastCheck)
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

        if (usePerFeatureColors) {
          const featureColor = colors![i]!
          if (featureColor !== lastFillStyle) {
            ctx.fillStyle = featureColor
            lastFillStyle = featureColor
          }
        } else if (useBicolor) {
          const featureColor = score < pivotValue ? negColor : posColor
          if (featureColor !== lastFillStyle) {
            ctx.fillStyle = featureColor
            lastFillStyle = featureColor
          }
        }
        ctx.fillRect(leftPx, y, Math.max(w, minSize), dotSize)

        if (score > niceMax) {
          clipHighPx[clipHighCount] = leftPx
          clipHighW[clipHighCount++] = w
        } else if (!isLog && score < niceMin) {
          clipLowPx[clipLowCount] = leftPx
          clipLowW[clipLowCount++] = w
        }
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
): { reducedFeatures: ReducedFeatureArrays } {
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

  const summaryScoreMode = readConfObject(config, 'summaryScoreMode')

  // When staticColor is set, delegate to drawXYArrays (handles all summaryScoreModes)
  if (staticColor) {
    const featureArrays = featuresToArrays(features)
    return drawXYArrays(ctx, {
      ...props,
      featureArrays,
      color: staticColor,
      filled: filledProp,
    })
  }

  // Delegate to drawXYArrays with per-feature colors
  // For whiskers mode, pass whiskers=true to pre-compute lightened/darkened colors
  const isWhiskers = summaryScoreMode === 'whiskers'
  const featureArrays = featuresToArrays(features, colorCallback, isWhiskers)
  return drawXYArrays(ctx, {
    ...props,
    featureArrays,
    filled: filledProp,
  })
}

export { type ReducedFeatureArrays, type WiggleFeatureArrays } from './util'
