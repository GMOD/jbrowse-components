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

// Default color used by wiggle config schema
export const WIGGLE_COLOR_DEFAULT = '#f0f'
export const WIGGLE_POS_COLOR_DEFAULT = '#0068d1'

export function isDefaultBicolor(color: string) {
  return color === WIGGLE_COLOR_DEFAULT || color === '#ff00ff'
}

interface ScaleOpts {
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

export function processFeaturesFromArrays(
  starts: Int32Array,
  ends: Int32Array,
  scores: Float32Array,
  minScores: Float32Array | undefined,
  maxScores: Float32Array | undefined,
  count: number,
  regionStart: number,
  bicolorPivot: number,
): WiggleFeatureArrays {
  const featurePositions = new Uint32Array(count * 2)
  const featureScores = new Float32Array(count)
  const featureMinScores = new Float32Array(count)
  const featureMaxScores = new Float32Array(count)
  const posFeaturePositionsBuf = new Uint32Array(count * 2)
  const posFeatureScoresBuf = new Float32Array(count)
  const negFeaturePositionsBuf = new Uint32Array(count * 2)
  const negFeatureScoresBuf = new Float32Array(count)
  let posCount = 0
  let negCount = 0

  for (let i = 0; i < count; i++) {
    const score = scores[i]!
    const startOffset = Math.max(0, starts[i]! - regionStart) | 0
    const endOffset = Math.max(0, ends[i]! - regionStart) | 0
    featurePositions[i * 2] = startOffset
    featurePositions[i * 2 + 1] = endOffset
    featureScores[i] = score
    featureMinScores[i] = minScores ? (minScores[i] ?? score) : score
    featureMaxScores[i] = maxScores ? (maxScores[i] ?? score) : score

    if (score >= bicolorPivot) {
      posFeaturePositionsBuf[posCount * 2] = startOffset
      posFeaturePositionsBuf[posCount * 2 + 1] = endOffset
      posFeatureScoresBuf[posCount] = score
      posCount++
    } else {
      negFeaturePositionsBuf[negCount * 2] = startOffset
      negFeaturePositionsBuf[negCount * 2 + 1] = endOffset
      negFeatureScoresBuf[negCount] = score
      negCount++
    }
  }

  return {
    featurePositions,
    featureScores,
    featureMinScores,
    featureMaxScores,
    numFeatures: count,
    posFeaturePositions: posFeaturePositionsBuf.subarray(0, posCount * 2),
    posFeatureScores: posFeatureScoresBuf.subarray(0, posCount),
    posNumFeatures: posCount,
    negFeaturePositions: negFeaturePositionsBuf.subarray(0, negCount * 2),
    negFeatureScores: negFeatureScoresBuf.subarray(0, negCount),
    negNumFeatures: negCount,
  }
}

export function processFeatures(
  features: { get: (key: string) => unknown }[],
  regionStart: number,
  bicolorPivot: number,
): WiggleFeatureArrays {
  const n = features.length
  const starts = new Int32Array(n)
  const ends = new Int32Array(n)
  const scores = new Float32Array(n)
  const minScores = new Float32Array(n)
  const maxScores = new Float32Array(n)

  for (const [i, feature] of features.entries()) {
    starts[i] = feature.get('start') as number
    ends[i] = feature.get('end') as number
    const score = (feature.get('score') as number | undefined) ?? 0
    scores[i] = score
    const summary = feature.get('summary')
    minScores[i] = summary
      ? ((feature.get('minScore') as number | undefined) ?? score)
      : score
    maxScores[i] = summary
      ? ((feature.get('maxScore') as number | undefined) ?? score)
      : score
  }

  return processFeaturesFromArrays(
    starts,
    ends,
    scores,
    minScores,
    maxScores,
    n,
    regionStart,
    bicolorPivot,
  )
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
export interface Dataset {
  data: FeatureArrays
  visStart?: number
  visEnd?: number
}
function computeStats(
  summaryScoreMode: string,
  datasets: Dataset[],
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

// Returns a function that normalizes a score to [0,1] given a fixed domain.
// Hoisting this outside of feature loops avoids recomputing log(min)/log(max)
// per feature when isLog is true.
export function makeScoreNormalizer(min: number, max: number, isLog: boolean) {
  if (isLog) {
    const logMin = Math.log2(Math.max(min, 1))
    const logMax = Math.log2(Math.max(max, 1))
    const logRange = logMax - logMin
    if (logRange === 0) {
      return () => 0
    }
    const invLogRange = 1 / logRange
    return (score: number) => {
      const logScore = Math.log2(Math.max(score, 1))
      return Math.max(0, Math.min(1, (logScore - logMin) * invLogRange))
    }
  }
  const range = max - min
  if (range === 0) {
    return () => 0
  }
  const invRange = 1 / range
  return (score: number) => Math.max(0, Math.min(1, (score - min) * invRange))
}
