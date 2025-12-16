import { readConfObject } from '@jbrowse/core/configuration'
import { clamp, featureSpanPx } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { WIGGLE_CLIP_HEIGHT, WIGGLE_FUDGE_FACTOR, getScale } from './util'

import type {
  ReducedFeatureArrays,
  ScaleOpts,
  WiggleFeatureArrays,
} from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

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
    stopToken?: string
    // when color is static (e.g. in Multi renderers), set strokeStyle once and skip callback
    staticColor?: string
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
    stopToken,
    staticColor,
  } = props
  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
  const width = (regionEnd - regionStart) * invBpPerPx

  const height = unadjustedHeight - offset * 2
  const clipColor = readConfObject(config, 'clipColor')

  // Use d3-scale only to get the "niced" domain, then use simple arithmetic
  const scale = getScale({ ...scaleOpts, range: [0, height] })
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
    ? (n: number) =>
        clamp(height - (Math.log(n) / log2 - logMin) * logRatio, 0, height) +
        offset
    : (n: number) =>
        clamp(height - (n - niceMin) * linearRatio, 0, height) + offset

  let lastVal: number | undefined
  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []

  // when staticColor is set, batch all path operations into a single stroke
  if (staticColor) {
    ctx.beginPath()
    ctx.strokeStyle = staticColor
    const clippingFeatures: { leftPx: number; w: number; high: boolean }[] = []

    let start = performance.now()
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
      const scoreY = toY(score)

      // track clipping
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

      const startY = lastVal !== undefined ? toY(lastVal) : scoreY
      if (!reversed) {
        ctx.moveTo(leftPx, startY)
        ctx.lineTo(leftPx, scoreY)
        ctx.lineTo(rightPx, scoreY)
      } else {
        ctx.moveTo(rightPx, startY)
        ctx.lineTo(rightPx, scoreY)
        ctx.lineTo(leftPx, scoreY)
      }
      lastVal = score
    }
    // single stroke for entire path
    ctx.stroke()

    // draw clipping indicators
    if (clippingFeatures.length > 0) {
      ctx.fillStyle = clipColor
      for (const { leftPx, w, high } of clippingFeatures) {
        if (high) {
          ctx.fillRect(leftPx, offset, w, WIGGLE_CLIP_HEIGHT)
        } else {
          ctx.fillRect(leftPx, height - WIGGLE_CLIP_HEIGHT, w, height)
        }
      }
    }
  } else {
    // non-static color: stroke per feature (original behavior)
    let start = performance.now()
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
      const scoreY = toY(score)
      const w = rightPx - leftPx + WIGGLE_FUDGE_FACTOR

      const c = colorCallback(feature, score)

      ctx.beginPath()
      ctx.strokeStyle = c
      const startY = lastVal !== undefined ? toY(lastVal) : scoreY
      if (!reversed) {
        ctx.moveTo(leftPx, startY)
        ctx.lineTo(leftPx, scoreY)
        ctx.lineTo(rightPx, scoreY)
      } else {
        ctx.moveTo(rightPx, startY)
        ctx.lineTo(rightPx, scoreY)
        ctx.lineTo(leftPx, scoreY)
      }
      ctx.stroke()
      lastVal = score

      if (score > niceMax) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, offset, w, WIGGLE_CLIP_HEIGHT)
      } else if (score < niceMin && !isLog) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, height - WIGGLE_CLIP_HEIGHT, w, height)
      }
    }
  }

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    for (const tick of values) {
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

/**
 * Optimized drawLine that takes structure-of-arrays directly from BigWig adapter.
 * Batches all line operations into a single path/stroke for better performance.
 */
export function drawLineArrays(
  ctx: CanvasRenderingContext2D,
  props: {
    featureArrays: WiggleFeatureArrays
    regions: Region[]
    bpPerPx: number
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    displayCrossHatches: boolean
    config: AnyConfigurationModel
    stopToken?: string
    color: string
    offset?: number
  },
): { reducedFeatures: ReducedFeatureArrays } {
  const {
    featureArrays,
    regions,
    bpPerPx,
    scaleOpts,
    height: unadjustedHeight,
    ticks: { values },
    displayCrossHatches,
    config,
    stopToken,
    color,
    offset = 0,
  } = props

  const { starts, ends, scores } = featureArrays
  const len = starts.length
  if (len === 0) {
    return { reducedFeatures: { starts: [], ends: [], scores: [] } }
  }

  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
  const width = (regionEnd - regionStart) * invBpPerPx

  const height = unadjustedHeight - offset * 2
  const clipColor = readConfObject(config, 'clipColor')

  // Scale setup
  const scale = getScale({ ...scaleOpts, range: [0, height] })
  const domain = scale.domain() as [number, number]
  const niceMin = domain[0]
  const niceMax = domain[1]
  const domainSpan = niceMax - niceMin
  const isLog = scaleOpts.scaleType === 'log'

  const linearRatio = domainSpan !== 0 ? height / domainSpan : 0
  const log2 = Math.log(2)
  const logMin = Math.log(niceMin) / log2
  const logMax = Math.log(niceMax) / log2
  const logSpan = logMax - logMin
  const logRatio = logSpan !== 0 ? height / logSpan : 0

  // Inline toY for performance
  const toY = isLog
    ? (n: number) =>
        clamp(height - (Math.log(n) / log2 - logMin) * logRatio, 0, height) +
        offset
    : (n: number) =>
        clamp(height - (n - niceMin) * linearRatio, 0, height) + offset

  // Track reduced features and clipping
  const reducedStarts: number[] = []
  const reducedEnds: number[] = []
  const reducedScores: number[] = []
  let prevLeftPx = Number.NEGATIVE_INFINITY
  const clippingFeatures: { leftPx: number; w: number; high: boolean }[] = []

  // Batch all line operations into single path
  ctx.beginPath()
  ctx.strokeStyle = color

  let lastVal: number | undefined
  let lastCheck = Date.now()

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
    const score = scores[i]!
    const scoreY = toY(score)

    // Track reduced features (one per pixel column)
    if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
      reducedStarts.push(fstart)
      reducedEnds.push(fend)
      reducedScores.push(score)
      prevLeftPx = leftPx
    }

    // Track clipping
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

    // Draw line segment
    const startY = lastVal !== undefined ? toY(lastVal) : scoreY
    if (!reversed) {
      ctx.moveTo(leftPx, startY)
      ctx.lineTo(leftPx, scoreY)
      ctx.lineTo(rightPx, scoreY)
    } else {
      ctx.moveTo(rightPx, startY)
      ctx.lineTo(rightPx, scoreY)
      ctx.lineTo(leftPx, scoreY)
    }
    lastVal = score
  }

  // Single stroke for entire path
  ctx.stroke()

  // Draw clipping indicators
  if (clippingFeatures.length > 0) {
    ctx.fillStyle = clipColor
    for (const { leftPx, w, high } of clippingFeatures) {
      if (high) {
        ctx.fillRect(leftPx, offset, w, WIGGLE_CLIP_HEIGHT)
      } else {
        ctx.fillRect(leftPx, height - WIGGLE_CLIP_HEIGHT, w, height)
      }
    }
  }

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    for (const tick of values) {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    }
  }

  return {
    reducedFeatures: {
      starts: reducedStarts,
      ends: reducedEnds,
      scores: reducedScores,
    },
  }
}
