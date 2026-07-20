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

// Autoscale types that expand the domain by ±numStdDev around the mean.
function isStdDevAutoscale(autoscaleType: string) {
  return autoscaleType === 'localsd'
}

// Bin count for the approximate percentile histogram. 1024 bins gives ~0.1%
// resolution on the domain, which is finer than any autoscale needs and keeps
// the second pass O(n) with a fixed, trivial allocation.
const NUM_HISTOGRAM_BINS = 1024

function computeStats(
  summaryScoreMode: string,
  datasets: Dataset[],
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
 * expansion for the `localsd` autoscale type.
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

// Builds a `[low, high]` domain by clipping the score distribution to the
// central `quantile` fraction (e.g. 0.99 → clip the top 1% of scores). Unlike
// localsd it makes no normality assumption, so it stays robust on the heavily
// right-skewed score distributions typical of coverage/wiggle data. A fixed
// histogram over [scoreMin, scoreMax] keeps this a single O(n) pass with no
// sort — the resulting quantile is approximate to ~1/NUM_HISTOGRAM_BINS of the
// range, which is far finer than the display needs.
function percentileDomainFromHistogram(
  stats: ScoreStats,
  summaryScoreMode: string,
  quantile: number,
  datasets: Dataset[],
): [number, number] {
  const { scoreMin, scoreMax } = stats
  const range = scoreMax - scoreMin
  if (range <= 0) {
    return [scoreMin, scoreMax]
  }
  const bins = new Int32Array(NUM_HISTOGRAM_BINS)
  const scale = NUM_HISTOGRAM_BINS / range
  let count = 0
  for (const { data, visStart, visEnd } of datasets) {
    const { featurePositions, numFeatures } = data
    const scores = getEffectiveScores(data, summaryScoreMode)
    for (let i = 0; i < numFeatures; i++) {
      if (
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
      const bin = Math.min(
        NUM_HISTOGRAM_BINS - 1,
        Math.floor((scores[i]! - scoreMin) * scale),
      )
      bins[bin]!++
      count++
    }
  }

  // Walk the cumulative histogram to the low/high quantile bins. `quantile` is
  // the upper percentile directly (0.99 → 99th pct max, 1st pct min); the low
  // bound is normally pinned to 0 below, so spending the whole budget on the
  // high tail keeps the clip strong enough to catch outliers.
  const lowTarget = (1 - quantile) * count
  const highTarget = quantile * count
  let cumulative = 0
  let lowBin = 0
  let highBin = NUM_HISTOGRAM_BINS - 1
  let lowFound = false
  for (let bin = 0; bin < NUM_HISTOGRAM_BINS; bin++) {
    cumulative += bins[bin]!
    if (!lowFound && cumulative >= lowTarget) {
      lowBin = bin
      lowFound = true
    }
    if (cumulative >= highTarget) {
      highBin = bin
      break
    }
  }
  // Convert bin edges back to scores. The high edge uses `highBin + 1` so the
  // target bin is included rather than clipped. Pin the low bound to 0 for
  // all-positive data, matching localsd's origin convention so the axis stays
  // anchored at zero.
  return [
    scoreMin >= 0 ? 0 : scoreMin + (lowBin / NUM_HISTOGRAM_BINS) * range,
    scoreMin + ((highBin + 1) / NUM_HISTOGRAM_BINS) * range,
  ]
}

/**
 * #api
 * Computes a score domain from the visible feature arrays for the `local` /
 * `localsd` / `localpercentile` autoscale types.
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
  numQuantile = 0.99,
): [number, number] | undefined {
  const stats = computeStats(summaryScoreMode, visibleEntries)
  if (!stats) {
    return undefined
  }
  if (autoscaleType === 'localpercentile') {
    return percentileDomainFromHistogram(
      stats,
      summaryScoreMode,
      numQuantile,
      visibleEntries,
    )
  }
  return domainFromStats(stats, autoscaleType, numStdDev)
}
