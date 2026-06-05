import {
  scaleLinear,
  scaleLog,
  scaleQuantize,
} from './vendor/d3-scale.js'

export interface ScaleOpts {
  domain: number[]
  range: number[]
  scaleType: string
  pivotValue?: number
  inverted?: boolean
}

function createScaleForType(scaleType: string) {
  if (scaleType === 'linear') {
    return scaleLinear()
  }
  if (scaleType === 'log') {
    return scaleLog().base(2)
  }
  if (scaleType === 'quantize') {
    return scaleQuantize()
  }
  throw new Error(`undefined scaleType: ${scaleType}`)
}

/**
 * #api
 * Builds a niced d3 scale (linear/log/quantize) from a `ScaleOpts`.
 */
export function getScale({
  domain,
  range,
  scaleType,
  pivotValue,
  inverted,
}: ScaleOpts) {
  const [min, max] = domain
  if (min === undefined || max === undefined) {
    throw new Error('invalid domain')
  }
  const [rangeMin, rangeMax] = range
  if (rangeMin === undefined || rangeMax === undefined) {
    throw new Error('invalid range')
  }
  const scale = createScaleForType(scaleType)
  scale.domain(pivotValue !== undefined ? [min, pivotValue, max] : [min, max])
  scale.nice()
  scale.range(inverted ? range.slice().reverse() : range)
  return scale
}

/**
 * #api
 * The axis-origin baseline: `1` for log, `0` otherwise.
 */
export function getOrigin(scaleType: string) {
  if (scaleType === 'log') {
    return 1
  }
  return 0
}

/**
 * #api
 * Rounds a domain to "nice" endpoints, clamped to the origin and
 * overridden by any explicit `bounds`.
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
    if (min >= 0 && max > 1) {
      min = 1
    }
  }

  if (minScore !== undefined) {
    min = minScore
  }
  if (maxScore !== undefined) {
    max = maxScore
  }
  const scale = createScaleForType(scaleType)
  scale.domain([min, max])
  scale.nice()
  return scale.domain() as [number, number]
}

/**
 * #api
 * Returns a niced `{min, max}` domain for a maximum score value.
 * Uses log base-2 when `useLogScale` is true (domain is clamped to [1, max]).
 */
export function getNiceScale(maxScore: number, useLogScale?: boolean) {
  if (useLogScale) {
    // scaleLog needs a domain strictly inside its base, so guard against
    // degenerate KR-normalized data where the top count is < 2.
    const scale = scaleLog()
      .base(2)
      .domain([1, Math.max(2, maxScore)])
      .nice()
    const [min, max] = scale.domain()
    return { min, max }
  }
  const scale = scaleLinear().domain([0, maxScore]).nice()
  const [min, max] = scale.domain()
  return { min, max }
}
