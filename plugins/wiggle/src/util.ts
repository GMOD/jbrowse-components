import { readConfObject } from '@jbrowse/core/configuration'
import {
  scaleLinear,
  scaleLog,
  scaleQuantize,
} from '@mui/x-charts-vendor/d3-scale'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export const YSCALEBAR_LABEL_OFFSET = 5

// Default color used by wiggle config schema
export const WIGGLE_COLOR_DEFAULT = '#f0f'

/**
 * Determines the appropriate color callback for wiggle plots.
 *
 * Priority:
 * 1. If color is a jexl callback expression, evaluate per feature
 * 2. If color is explicitly set (not default), use static color
 * 3. If defaultColor provided (e.g. 'grey' for line plots), use it
 * 4. Otherwise use bicolor pivot logic (posColor/negColor based on score)
 */
export function getColorCallback(
  config: AnyConfigurationModel,
  opts?: { defaultColor?: string },
) {
  const color = readConfObject(config, 'color')
  const colorIsCallback = config.color?.isCallback
  const colorIsDefault = color === WIGGLE_COLOR_DEFAULT

  if (colorIsCallback) {
    return (feature: Feature) => readConfObject(config, 'color', { feature })
  }
  if (!colorIsDefault) {
    return () => color
  }
  if (opts?.defaultColor) {
    return () => opts.defaultColor!
  }
  // Bicolor pivot logic
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const negColor = readConfObject(config, 'negColor')
  const posColor = readConfObject(config, 'posColor')
  return (_feature: Feature, score: number) =>
    score < pivotValue ? negColor : posColor
}

export interface ScaleOpts {
  domain: number[]
  range: number[]
  scaleType: string
  pivotValue?: number
  inverted?: boolean
}

// There was confusion about whether source or name was required, and effort to
// remove one or the other was thwarted. Adapters like BigWigAdapter, even in
// the BigWigAdapter configSchema.ts, use a 'source' field though, while the
// word 'name' still allowed in the config too. To solve, we made name===source
export interface Source {
  baseUri?: string
  name: string
  source: string
  color?: string
  group?: string
}

/**
 * produces a d3-scale from arguments. applies a "nice domain" adjustment
 *
 * @param object - containing attributes
 *   - domain [min,max]
 *   - range [min,max]
 *   - bounds [min,max]
 *   - scaleType (linear or log)
 *   - pivotValue (number)
 *   - inverted (boolean)
 */
export function getScale({
  domain,
  range,
  scaleType,
  pivotValue,
  inverted,
}: ScaleOpts) {
  let scale:
    | ReturnType<typeof scaleLinear<number>>
    | ReturnType<typeof scaleLog<number>>
    | ReturnType<typeof scaleQuantize<number>>
  const [min, max] = domain
  if (min === undefined || max === undefined) {
    throw new Error('invalid domain')
  }
  if (scaleType === 'linear') {
    scale = scaleLinear()
  } else if (scaleType === 'log') {
    scale = scaleLog().base(2)
  } else if (scaleType === 'quantize') {
    scale = scaleQuantize()
  } else {
    throw new Error('undefined scaleType')
  }
  scale.domain(pivotValue !== undefined ? [min, pivotValue, max] : [min, max])
  scale.nice()

  const [rangeMin, rangeMax] = range
  if (rangeMin === undefined || rangeMax === undefined) {
    throw new Error('invalid range')
  }
  scale.range(inverted ? range.slice().reverse() : range)
  return scale
}
/**
 * gets the origin for drawing the graph. for linear this is 0, for log this is
 * arbitrarily set to log(1)==0
 *
 * @param scaleType -
 */
export function getOrigin(scaleType: string /* , pivot, stats */) {
  // if (pivot) {
  //   if (pivot === 'mean') {
  //     return stats.scoreMean || 0
  //   }
  //   if (pivot === 'zero') {
  //     return 0
  //   }
  //   return parseFloat()
  // }
  // if (scaleType === 'z_score') {
  //   return stats.scoreMean || 0
  // }
  if (scaleType === 'log') {
    return 1
  }
  return 0
}

/**
 * produces a "nice" domain that actually rounds down to 0 for the min or 0 to
 * the max depending on if all values are positive or negative
 *
 * @param object - containing attributes
 *   - domain [min,max]
 *   - bounds [min,max]
 *   - mean
 *   - stddev
 *   - scaleType (linear or log)
 */
export function getNiceDomain({
  scaleType,
  domain,
  bounds,
}: {
  scaleType: string
  domain: readonly [number, number]
  bounds: readonly [number | undefined, number | undefined]
}) {
  const [minScore, maxScore] = bounds
  let [min, max] = domain

  if (scaleType === 'linear') {
    if (max < 0) {
      max = 0
    }
    if (min > 0) {
      min = 0
    }
  }
  if (scaleType === 'log') {
    // for min>0 and max>1, set log min to 1, which works for most coverage
    // type tracks. if max is not >1, might be like raw p-values so then it'll
    // display negative values
    if (min >= 0 && max > 1) {
      min = 1
    }
  }

  if (minScore !== undefined && minScore !== Number.MIN_VALUE) {
    min = minScore
  }
  if (maxScore !== undefined && maxScore !== Number.MAX_VALUE) {
    max = maxScore
  }
  const getScaleType = (type: string) => {
    if (type === 'linear') {
      return scaleLinear()
    }
    if (type === 'log') {
      const scale = scaleLog()
      scale.base(2)
      return scale
    }
    if (type === 'quantize') {
      return scaleQuantize()
    }
    throw new Error(`undefined scaleType ${type}`)
  }
  const scale = getScaleType(scaleType)

  scale.domain([min, max])
  scale.nice()
  return scale.domain() as [number, number]
}

export function toP(s = 0) {
  return +s.toPrecision(6)
}

/**
 * Lightweight feature serialization for wiggle features.
 * Only serializes properties needed for mouse interaction,
 * avoiding the overhead of full toJSON() serialization.
 */
export function serializeWiggleFeature(f: {
  get: (key: string) => unknown
  id: () => string
}) {
  return {
    uniqueId: f.id(),
    start: f.get('start'),
    end: f.get('end'),
    score: f.get('score'),
    source: f.get('source'),
    refName: f.get('refName'),
    maxScore: f.get('maxScore'),
    minScore: f.get('minScore'),
    summary: f.get('summary'),
  }
}

export function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

// Shared constants for wiggle drawing
export const WIGGLE_FUDGE_FACTOR = 0.3
export const WIGGLE_CLIP_HEIGHT = 2

// Precomputed scale values for fast rendering
export interface ScaleValues {
  niceMin: number
  niceMax: number
  height: number
  linearRatio: number
  log2: number
  logMin: number
  logRatio: number
  isLog: boolean
}

// Precompute scale values once for use in hot loops
export function getScaleValues(
  scaleOpts: ScaleOpts,
  height: number,
): ScaleValues {
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

  return {
    niceMin,
    niceMax,
    height,
    linearRatio,
    log2,
    logMin,
    logRatio,
    isLog,
  }
}

/**
 * Groups features by source, optimized for multi-wiggle rendering.
 * Pre-allocates arrays for known sources to avoid dynamic key checking.
 * Uses Object.create(null) to avoid prototype chain lookups.
 */
export function groupFeaturesBySource(
  features: Feature[],
  sources: Source[],
): Record<string, Feature[]> {
  const groups: Record<string, Feature[]> = Object.create(null)
  for (const { name } of sources) {
    groups[name] = []
  }
  for (const feature of features) {
    const sourceName = feature.get('source') as string
    groups[sourceName]?.push(feature)
  }
  return groups
}

// avoid drawing negative width features for SVG exports
export function fillRectCtx(
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
