export {
  computeAutoscaleDomain,
  domainFromStats,
  getNiceDomain,
  getOrigin,
  getScale,
  makeScoreNormalizer,
} from '@jbrowse/wiggle-core'
export type {
  Dataset,
  FeatureArrays,
  ScaleOpts,
  ScoreStats,
} from '@jbrowse/wiggle-core'

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

// There was confusion about whether source or name was required, and effort to
// remove one or the other was thwarted. Adapters like BigWigAdapter, even in
// the BigWigAdapter configSchema.ts, use a 'source' field though, while the
// word 'name' still allowed in the config too. To solve, we made name===source.
export interface Source {
  baseUri?: string
  name: string
  source: string
  color?: string
  labelColor?: string
  group?: string
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
    const startPos = starts[i]! | 0
    const endPos = ends[i]! | 0
    featurePositions[i * 2] = startPos
    featurePositions[i * 2 + 1] = endPos
    featureScores[i] = score
    featureMinScores[i] = minScores ? (minScores[i] ?? score) : score
    featureMaxScores[i] = maxScores ? (maxScores[i] ?? score) : score

    if (score >= bicolorPivot) {
      posFeaturePositionsBuf[posCount * 2] = startPos
      posFeaturePositionsBuf[posCount * 2 + 1] = endPos
      posFeatureScoresBuf[posCount] = score
      posCount++
    } else {
      negFeaturePositionsBuf[negCount * 2] = startPos
      negFeaturePositionsBuf[negCount * 2 + 1] = endPos
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

export const WIGGLE_FUDGE_FACTOR = 0.8
