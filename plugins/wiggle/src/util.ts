import {
  scaleLinear,
  scaleLog,
  scaleQuantize,
} from '@mui/x-charts-vendor/d3-scale'

export const YSCALEBAR_LABEL_OFFSET = 5

export const MULTI_WIGGLE_RENDERING_TYPES = [
  'multirowxy',
  'multixyplot',
  'multirowdensity',
  'multirowline',
  'multiline',
  'multirowscatter',
  'multiscatter',
] as const

export type MultiWiggleRenderingType =
  (typeof MULTI_WIGGLE_RENDERING_TYPES)[number]

// Default color used by wiggle config schema
export const WIGGLE_COLOR_DEFAULT = '#f0f'
export const WIGGLE_POS_COLOR_DEFAULT = '#0068d1'

export function isDefaultBicolor(color: string) {
  return color === WIGGLE_COLOR_DEFAULT || color === '#ff00ff'
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
  labelColor?: string
  group?: string
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
 * gets the origin for drawing the graph. for linear this is 0, for log this is
 * arbitrarily set to log(1)==0
 *
 * @param scaleType -
 */
export function getOrigin(scaleType: string) {
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
  const scale = createScaleForType(scaleType)
  scale.domain([min, max])
  scale.nice()
  return scale.domain() as [number, number]
}

export function toP(s = 0) {
  return +s.toPrecision(6)
}

export interface SourceInfo {
  name: string
  color?: string
}

export interface WiggleFeatureArrays {
  featurePositions: Uint32Array
  featureScores: Float32Array
  featureMinScores: Float32Array
  featureMaxScores: Float32Array
  numFeatures: number
  posFeaturePositions: Uint32Array
  posFeatureScores: Float32Array
  posNumFeatures: number
  negFeaturePositions: Uint32Array
  negFeatureScores: Float32Array
  negNumFeatures: number
}

export function processFeatures(
  features: { get: (key: string) => unknown }[],
  regionStart: number,
  bicolorPivot: number,
): WiggleFeatureArrays {
  const featurePositions = new Uint32Array(features.length * 2)
  const featureScores = new Float32Array(features.length)
  const featureMinScores = new Float32Array(features.length)
  const featureMaxScores = new Float32Array(features.length)
  const posPositions: number[] = []
  const posScores: number[] = []
  const negPositions: number[] = []
  const negScores: number[] = []

  for (const [i, feature] of features.entries()) {
    const start = feature.get('start') as number
    const end = feature.get('end') as number
    const score = (feature.get('score') as number | undefined) ?? 0
    const summary = feature.get('summary')

    const startOffset = Math.max(0, Math.floor(start - regionStart))
    const endOffset = Math.max(0, Math.floor(end - regionStart))
    featurePositions[i * 2] = startOffset
    featurePositions[i * 2 + 1] = endOffset
    featureScores[i] = score
    featureMinScores[i] = summary
      ? ((feature.get('minScore') as number | undefined) ?? score)
      : score
    featureMaxScores[i] = summary
      ? ((feature.get('maxScore') as number | undefined) ?? score)
      : score

    if (score >= bicolorPivot) {
      posPositions.push(startOffset, endOffset)
      posScores.push(score)
    } else {
      negPositions.push(startOffset, endOffset)
      negScores.push(score)
    }
  }

  return {
    featurePositions,
    featureScores,
    featureMinScores,
    featureMaxScores,
    numFeatures: features.length,
    posFeaturePositions: new Uint32Array(posPositions),
    posFeatureScores: new Float32Array(posScores),
    posNumFeatures: posScores.length,
    negFeaturePositions: new Uint32Array(negPositions),
    negFeatureScores: new Float32Array(negScores),
    negNumFeatures: negScores.length,
  }
}

export function getEffectiveScores(
  data: {
    featureScores: Float32Array
    featureMinScores: Float32Array
    featureMaxScores: Float32Array
  },
  mode: string,
) {
  if (mode === 'min') {
    return data.featureMinScores
  }
  if (mode === 'max') {
    return data.featureMaxScores
  }
  return data.featureScores
}

export interface FeatureArrays {
  featurePositions: Uint32Array
  featureScores: Float32Array
  featureMinScores: Float32Array
  featureMaxScores: Float32Array
  numFeatures: number
}

function computeStats(
  summaryScoreMode: string,
  datasets: { data: FeatureArrays; visStart?: number; visEnd?: number }[],
  filterVisible: boolean,
) {
  const useWhiskers = summaryScoreMode === 'whiskers'
  const useMin = summaryScoreMode === 'min'
  const useMax = summaryScoreMode === 'max'
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  for (const { data, visStart, visEnd } of datasets) {
    for (let i = 0; i < data.numFeatures; i++) {
      if (filterVisible && visStart !== undefined && visEnd !== undefined) {
        const fStart = data.featurePositions[i * 2]!
        const fEnd = data.featurePositions[i * 2 + 1]!
        if (fEnd <= visStart || fStart >= visEnd) {
          continue
        }
      }
      if (useWhiskers) {
        min = Math.min(min, data.featureMinScores[i]!)
        max = Math.max(max, data.featureMaxScores[i]!)
      } else if (useMin) {
        const s = data.featureMinScores[i]!
        min = Math.min(min, s)
        max = Math.max(max, s)
      } else if (useMax) {
        const s = data.featureMaxScores[i]!
        min = Math.min(min, s)
        max = Math.max(max, s)
      } else {
        const s = data.featureScores[i]!
        min = Math.min(min, s)
        max = Math.max(max, s)
      }
      const avg = data.featureScores[i]!
      sum += avg
      sumSq += avg * avg
      count++
    }
  }
  if (count === 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined
  }
  const mean = sum / count
  const stdDev = Math.sqrt(Math.max(0, sumSq / count - mean * mean))
  return { scoreMin: min, scoreMax: max, scoreMean: mean, scoreStdDev: stdDev }
}

export function computeAutoscaleDomain(
  autoscaleType: string,
  summaryScoreMode: string,
  numStdDev: number,
  visibleEntries: {
    data: FeatureArrays
    visStart: number
    visEnd: number
  }[],
  allEntries: { data: FeatureArrays }[],
): [number, number] | undefined {
  const isGlobal = autoscaleType === 'global' || autoscaleType === 'globalsd'
  const isSd = autoscaleType === 'localsd' || autoscaleType === 'globalsd'

  const stats = isGlobal
    ? computeStats(summaryScoreMode, allEntries, false)
    : computeStats(summaryScoreMode, visibleEntries, true)

  if (!stats) {
    return undefined
  }

  if (isSd) {
    const { scoreMean, scoreStdDev, scoreMin } = stats
    return [
      scoreMin >= 0 ? 0 : scoreMean - numStdDev * scoreStdDev,
      scoreMean + numStdDev * scoreStdDev,
    ]
  }
  return [stats.scoreMin, stats.scoreMax]
}

export const WIGGLE_FUDGE_FACTOR = 0.8
