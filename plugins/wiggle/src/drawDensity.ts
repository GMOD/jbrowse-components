import { readConfObject } from '@jbrowse/core/configuration'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  getScale,
  WIGGLE_CLIP_HEIGHT,
  WIGGLE_FUDGE_FACTOR,
} from './util'

import type {
  ReducedFeatureArrays,
  ScaleOpts,
  WiggleFeatureArrays,
} from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

function fillRectCtx(
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
  ctx.fillRect(x, y, width, height)
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
    stopToken?: string
  },
) {
  const { stopToken, features, regions, bpPerPx, scaleOpts, height, config } =
    props
  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
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
    range: crossing ? [negColor, '#eee', posColor] : ['#eee', posColor],
  })

  const scale2 = getScale({ ...scaleOpts, range: [0, height] })
  const cb =
    color === '#f0f'
      ? (_: Feature, score: number) => scale(score)
      : (feature: Feature, score: number) =>
          readConfObject(config, 'color', { feature, score })
  const domain = scale2.domain()
  const niceMin = domain[0]!
  const niceMax = domain[1]!

  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []
  const clippingFeatures: { leftPx: number; w: number; high: boolean }[] = []
  const isLog = scaleOpts.scaleType === 'log'
  const domainMin = scaleOpts.domain[0]!
  let start = performance.now()
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
    const w = rightPx - leftPx + WIGGLE_FUDGE_FACTOR

    // track clipping during first pass
    if (score > niceMax) {
      clippingFeatures.push({ leftPx, w, high: true })
    } else if (score < niceMin && !isLog) {
      clippingFeatures.push({ leftPx, w, high: false })
    }

    if (score >= domainMin) {
      ctx.fillStyle = cb(feature, score)
      ctx.fillRect(leftPx, 0, w, height)
    } else {
      ctx.fillStyle = '#eee'
      ctx.fillRect(leftPx, 0, w, height)
    }
  }

  // draw clipping indicators from cached data
  if (clippingFeatures.length > 0) {
    ctx.save()
    ctx.fillStyle = clipColor
    for (const { leftPx, w } of clippingFeatures) {
      fillRectCtx(leftPx, 0, w, WIGGLE_CLIP_HEIGHT, ctx)
    }
    ctx.restore()
  }

  return {
    reducedFeatures,
  }
}

/**
 * Optimized drawDensity that takes structure-of-arrays directly from BigWig adapter.
 * Uses two-pass rendering to reduce fillRect calls when zoomed out.
 */
export function drawDensityArrays(
  ctx: CanvasRenderingContext2D,
  props: {
    featureArrays: WiggleFeatureArrays
    regions: Region[]
    bpPerPx: number
    scaleOpts: ScaleOpts
    height: number
    config: AnyConfigurationModel
    stopToken?: string
    color: string
  },
): { reducedFeatures: ReducedFeatureArrays } {
  const { stopToken, featureArrays, regions, bpPerPx, scaleOpts, height, config, color } = props

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

  const clipColor = readConfObject(config, 'clipColor')
  const pivot = readConfObject(config, 'bicolorPivot')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const negColor = readConfObject(config, 'negColor')
  const posColor = readConfObject(config, 'posColor')
  const crossing = pivot !== 'none' && scaleOpts.scaleType !== 'log'

  // Color scale for density
  const colorScale = getScale({
    ...scaleOpts,
    pivotValue: crossing ? pivotValue : undefined,
    range: crossing ? [negColor, '#eee', posColor] : ['#eee', posColor],
  })

  const scale2 = getScale({ ...scaleOpts, range: [0, height] })
  const domain = scale2.domain()
  const niceMin = domain[0]!
  const niceMax = domain[1]!
  const isLog = scaleOpts.scaleType === 'log'
  const domainMin = scaleOpts.domain[0]!

  // Use provided color or compute from scale
  const useStaticColor = color !== '#f0f'
  const getColor = useStaticColor
    ? () => color
    : (score: number) => colorScale(score) as string

  // Two-pass approach: collect max scores per pixel column, then draw
  const widthPx = Math.ceil(width) + 1
  const maxScorePerPx = new Float32Array(widthPx)
  const hasData = new Uint8Array(widthPx)
  const featureIdxPerPx = new Int32Array(widthPx)
  const clipFlag = new Uint8Array(widthPx)

  let lastCheck = Date.now()

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
      const score = scores[i]!
      if (!hasData[pxCol] || score > maxScorePerPx[pxCol]!) {
        maxScorePerPx[pxCol] = score
        hasData[pxCol] = 1
        featureIdxPerPx[pxCol] = i
      }
      // Track clipping
      if (score > niceMax) {
        clipFlag[pxCol] = 1
      } else if (score < niceMin && !isLog && clipFlag[pxCol] !== 1) {
        clipFlag[pxCol] = 2
      }
    }
  }

  // Build reduced features and draw
  const reducedStarts: number[] = []
  const reducedEnds: number[] = []
  const reducedScores: number[] = []
  const rectW = Math.max(1 + WIGGLE_FUDGE_FACTOR, 1)

  for (let px = 0; px < widthPx; px++) {
    if (hasData[px]) {
      const score = maxScorePerPx[px]!
      const idx = featureIdxPerPx[px]!

      // Draw density rect
      if (score >= domainMin) {
        ctx.fillStyle = getColor(score)
      } else {
        ctx.fillStyle = '#eee'
      }
      ctx.fillRect(px, 0, rectW, height)

      // Build reduced features
      reducedStarts.push(starts[idx]!)
      reducedEnds.push(ends[idx]!)
      reducedScores.push(scores[idx]!)
    }
  }

  // Draw clipping indicators
  ctx.fillStyle = clipColor
  for (let px = 0; px < widthPx; px++) {
    if (clipFlag[px] === 1) {
      ctx.fillRect(px, 0, rectW, WIGGLE_CLIP_HEIGHT)
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
