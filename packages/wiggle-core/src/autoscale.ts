export interface FeatureArrays {
  featurePositions: Uint32Array
  featureScores: Float32Array
  featureMinScores: Float32Array
  featureMaxScores: Float32Array
  numFeatures: number
  hasSummaryScores: boolean
}

export interface Dataset {
  data: FeatureArrays
  visStart?: number
  visEnd?: number
}

export interface ScoreStats {
  scoreMin: number
  scoreMax: number
  scoreMean: number
  scoreStdDev: number
}

/**
 * #api
 * Per-feature scalar score array for a summary mode: the min/max summary array
 * for `'min'`/`'max'`, otherwise the average score.
 */
export function getEffectiveScores(
  data: {
    featureScores: Float32Array
    featureMinScores: Float32Array
    featureMaxScores: Float32Array
  },
  summaryScoreMode: string,
) {
  return summaryScoreMode === 'min'
    ? data.featureMinScores
    : summaryScoreMode === 'max'
      ? data.featureMaxScores
      : data.featureScores
}

// Half-open overlap test between a feature span and the visible window.
function overlaps(
  fStart: number,
  fEnd: number,
  visStart: number,
  visEnd: number,
) {
  return fEnd > visStart && fStart < visEnd
}

// Autoscale types whose stats come from every loaded region, not just the
// visible window.
function isGlobalAutoscale(autoscaleType: string) {
  return autoscaleType === 'global' || autoscaleType === 'globalsd'
}

// Autoscale types that expand the domain by ±numStdDev around the mean.
function isStdDevAutoscale(autoscaleType: string) {
  return autoscaleType === 'localsd' || autoscaleType === 'globalsd'
}

function computeStats(
  summaryScoreMode: string,
  datasets: Dataset[],
  filterVisible: boolean,
): ScoreStats | undefined {
  const useWhiskers = summaryScoreMode === 'whiskers'
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  for (const { data, visStart, visEnd } of datasets) {
    const { featureScores, featurePositions, numFeatures } = data
    // Whiskers spreads min/max across the two summary arrays; every other mode
    // draws both bounds from a single per-feature scalar. Selecting the arrays
    // once per dataset keeps the mode check out of the per-feature loop.
    const minScores = useWhiskers
      ? data.featureMinScores
      : getEffectiveScores(data, summaryScoreMode)
    const maxScores = useWhiskers
      ? data.featureMaxScores
      : getEffectiveScores(data, summaryScoreMode)
    for (let i = 0; i < numFeatures; i++) {
      if (
        filterVisible &&
        visStart !== undefined &&
        visEnd !== undefined &&
        !overlaps(
          featurePositions[i * 2]!,
          featurePositions[i * 2 + 1]!,
          visStart,
          visEnd,
        )
      ) {
        continue
      }
      min = Math.min(min, minScores[i]!)
      max = Math.max(max, maxScores[i]!)
      // Mean/stddev always use featureScores (the average) regardless of
      // summaryScoreMode; min/max for the domain bounds come from the mode-
      // selected arrays above. Intentional: sd-based autoscale centers on the
      // average-value distribution even in whiskers/min/max summary modes.
      const avg = featureScores[i]!
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

/**
 * #api
 * Converts score stats into a `[min, max]` domain, applying std-dev
 * expansion for `localsd`/`globalsd` autoscale types.
 */
export function domainFromStats(
  stats: ScoreStats,
  autoscaleType: string,
  numStdDev: number,
): [number, number] {
  if (isStdDevAutoscale(autoscaleType)) {
    const { scoreMean, scoreStdDev, scoreMin } = stats
    return [
      scoreMin >= 0 ? 0 : scoreMean - numStdDev * scoreStdDev,
      scoreMean + numStdDev * scoreStdDev,
    ]
  }
  return [stats.scoreMin, stats.scoreMax]
}

/**
 * #api
 * Computes a score domain from feature arrays, scoping to visible or all
 * entries per the global/local autoscale type.
 */
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
  const stats = isGlobalAutoscale(autoscaleType)
    ? computeStats(summaryScoreMode, allEntries, false)
    : computeStats(summaryScoreMode, visibleEntries, true)
  if (!stats) {
    return undefined
  }
  return domainFromStats(stats, autoscaleType, numStdDev)
}
