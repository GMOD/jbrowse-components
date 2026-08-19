import { resolveSymlogConstant } from './normalize.ts'
import {
  type ScaleSpec,
  niceDomain,
  scaleTicks,
  scaleValue,
} from './vendor/d3-scale.ts'

/**
 * What `getScale` hands back: callable, plus the domain and ticks its callers
 * read. The scales underneath are pure functions over a {@link ScaleSpec}, so
 * this has no setters — the domain and range come in through `getScale`.
 */
export interface Scale {
  (x: number): number
  domain(): [number, number]
  range(): [number, number]
  ticks(count?: number): number[]
}

function buildScale(spec: ScaleSpec): Scale {
  const scale = ((x: number) => scaleValue(spec, x)) as Scale
  scale.domain = () => [...spec.domain]
  scale.range = () => [...spec.range]
  scale.ticks = (count?: number) => scaleTicks(spec, count)
  return scale
}

export interface ScaleOpts {
  domain: number[]
  range: number[]
  scaleType: string
  /**
   * symlog's linear-region width. `0` (the config default) resolves from the
   * domain — see {@link resolveSymlogConstant}. Ignored by the other scales.
   */
  symlogConstant?: number
  /**
   * Round the domain to nice endpoints before building the scale. Defaults to
   * true, which is what a caller handing over raw data wants. Pass false when
   * the domain is already the one something else is drawing with — nicing it
   * again moves the axis off that drawing, and can invent an endpoint outside
   * it (a raw `[1, 1000]` nices to `[1, 1024]`, so the axis labels a tick at a
   * value the data never reaches).
   */
  nice?: boolean
}

function specForType(
  scaleType: string,
  domain: readonly [number, number],
  symlogConstant = 0,
): ScaleSpec {
  const range = [0, 1] as const
  if (scaleType === 'linear') {
    return { kind: 'linear', domain, range }
  }
  if (scaleType === 'log') {
    return { kind: 'log', base: 2, domain, range }
  }
  if (scaleType === 'symlog') {
    // The axis has to be built with the same constant the renderer normalizes
    // with, or the ticks label positions the bars are not drawn at. Both
    // resolve through resolveSymlogConstant from the same domain.
    const [min, max] = domain
    return {
      kind: 'symlog',
      constant: resolveSymlogConstant(min, max, symlogConstant),
      domain,
      range,
    }
  }
  throw new Error(`undefined scaleType: ${scaleType}`)
}

/**
 * #api
 * Builds a d3 scale (linear/log/quantize) from a `ScaleOpts`, nicing the domain
 * unless `nice: false` says it is already the one being drawn with.
 */
export function getScale({
  domain,
  range,
  scaleType,
  symlogConstant,
  nice = true,
}: ScaleOpts) {
  const [min, max] = domain
  if (min === undefined || max === undefined) {
    throw new Error('invalid domain')
  }
  const [rangeMin, rangeMax] = range
  if (rangeMin === undefined || rangeMax === undefined) {
    throw new Error('invalid range')
  }
  const spec = specForType(scaleType, [min, max], symlogConstant)
  return buildScale({
    ...spec,
    domain: nice ? niceDomain(spec) : spec.domain,
    range: [rangeMin, rangeMax],
  })
}

/**
 * #api
 * The axis-origin baseline: `1` for log, `0` otherwise — symlog included, since
 * it can represent 0 and that is where a bar should sit from.
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
  symlogConstant,
}: {
  scaleType: string
  domain: readonly [number, number]
  bounds: readonly [number | undefined, number | undefined]
  symlogConstant?: number
}) {
  const [minScore, maxScore] = bounds
  let [min, max] = domain

  // symlog joins linear here rather than log: its origin is 0 (getOrigin), it
  // is defined there, so the domain should reach the baseline its bars grow
  // from instead of being floored off it the way a log domain has to be.
  if (scaleType === 'linear' || scaleType === 'symlog') {
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

  if (scaleType === 'log') {
    // d3 scaleLog is undefined at values <= 0, so autoscale (esp. localsd) or
    // data that crosses zero (e.g. log-ratio bigwigs) would otherwise yield a
    // domain that produces NaN ticks and a blank plot. Floor the domain to a
    // positive, non-degenerate range so the axis renders its valid portion
    // instead of silently disappearing.
    if (min <= 0) {
      min = max > 1 ? 1 : max > 0 ? max / 100 : 1
    }
    if (max <= min) {
      max = min * 2
    }
  }

  return niceDomain(specForType(scaleType, [min, max], symlogConstant))
}

/**
 * #api
 * Returns a niced `{min, max}` domain for a maximum score value.
 * Uses log base-2 when `useLogScale` is true (domain is clamped to [1, max]).
 */
export function getNiceScale(maxScore: number, useLogScale?: boolean) {
  // A log scale needs a domain strictly inside its base, so guard against
  // degenerate KR-normalized data where the top count is < 2.
  const [min, max] = useLogScale
    ? niceDomain(specForType('log', [1, Math.max(2, maxScore)]))
    : niceDomain(specForType('linear', [0, maxScore]))
  return { min, max }
}
