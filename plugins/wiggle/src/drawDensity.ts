import { readConfObject } from '@jbrowse/core/configuration'
import { checkStopToken, checkStopToken2 } from '@jbrowse/core/util/stopToken'

import {
  WIGGLE_CLIP_HEIGHT,
  WIGGLE_FUDGE_FACTOR,
  featuresToArrays,
  getScale,
} from './util'

import type {
  ReducedFeatureArrays,
  ScaleOpts,
  WiggleFeatureArrays,
} from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

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
  const { features, config } = props
  const color = readConfObject(config, 'color')
  const pivot = readConfObject(config, 'bicolorPivot')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const negColor = readConfObject(config, 'negColor')
  const posColor = readConfObject(config, 'posColor')
  const crossing = pivot !== 'none' && props.scaleOpts.scaleType !== 'log'
  const scale = getScale({
    ...props.scaleOpts,
    pivotValue: crossing ? pivotValue : undefined,
    range: crossing ? [negColor, '#eee', posColor] : ['#eee', posColor],
  })

  const cb =
    color === '#f0f'
      ? (_: Feature, score: number) => `${scale(score)}`
      : (feature: Feature, score: number) =>
          readConfObject(config, 'color', { feature, score })

  const featureArrays = featuresToArrays(features, cb)
  return drawDensityArrays(ctx, { ...props, featureArrays })
}

/**
 * Optimized drawDensity that takes structure-of-arrays directly from BigWig adapter.
 */
export function drawDensityArrays(
  ctx: CanvasRenderingContext2D,
  props: {
    featureArrays: WiggleFeatureArrays & { colors?: string[] }
    regions: Region[]
    bpPerPx: number
    scaleOpts: ScaleOpts
    height: number
    config: AnyConfigurationModel
    stopToken?: string
  },
): { reducedFeatures: ReducedFeatureArrays } {
  const {
    stopToken,
    featureArrays,
    regions,
    bpPerPx,
    scaleOpts,
    height,
    config,
  } = props

  const { starts, ends, scores, colors } = featureArrays
  const len = starts.length
  if (len === 0) {
    return { reducedFeatures: { starts: [], ends: [], scores: [] } }
  }

  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx

  const clipColor = readConfObject(config, 'clipColor')
  const pivot = readConfObject(config, 'bicolorPivot')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const negColor = readConfObject(config, 'negColor')
  const posColor = readConfObject(config, 'posColor')
  const crossing = pivot !== 'none' && scaleOpts.scaleType !== 'log'

  // Color scale for density - maps score to color (only used if colors not precomputed)
  const colorScale = colors
    ? undefined
    : getScale({
        ...scaleOpts,
        pivotValue: crossing ? pivotValue : undefined,
        range: crossing ? [negColor, '#eee', posColor] : ['#eee', posColor],
      })

  const scale2 = getScale({ ...scaleOpts, range: [0, height] })
  const domain = scale2.domain()
  const niceMax = domain[1]!
  const niceMin = domain[0]!
  const domainMin = scaleOpts.domain[0]!
  const isLog = scaleOpts.scaleType === 'log'

  // Track reduced features for tooltip support
  const reducedStarts: number[] = []
  const reducedEnds: number[] = []
  const reducedScores: number[] = []
  let prevLeftPx = -1

  const clippingFeatures: { leftPx: number; w: number }[] = []
  const lastCheck = { time: Date.now() }

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
    const score = scores[i]!
    const w = rightPx - leftPx + WIGGLE_FUDGE_FACTOR

    // Reduce features for tooltips (one per pixel column)
    if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
      reducedStarts.push(fstart)
      reducedEnds.push(fend)
      reducedScores.push(score)
      prevLeftPx = leftPx
    }

    // Track clipping
    if (score > niceMax || (score < niceMin && !isLog)) {
      clippingFeatures.push({ leftPx, w })
    }

    // Draw the feature
    if (score >= domainMin) {
      ctx.fillStyle = colors ? colors[i]! : `${colorScale!(score)}`
      ctx.fillRect(leftPx, 0, w, height)
    } else {
      ctx.fillStyle = '#eee'
      ctx.fillRect(leftPx, 0, w, height)
    }
  }

  // Draw clipping indicators from cached data
  if (clippingFeatures.length > 0) {
    ctx.fillStyle = clipColor
    for (const { leftPx, w } of clippingFeatures) {
      ctx.fillRect(leftPx, 0, w, WIGGLE_CLIP_HEIGHT)
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
