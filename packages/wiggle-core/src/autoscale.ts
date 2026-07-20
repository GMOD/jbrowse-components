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

// The `quantile`-th percentile magnitude of one signed side of the score
// distribution: features are filtered to a single sign (`positiveSide`), their
// magnitudes binned over `[0, maxMag]`, and the magnitude below which `quantile`
// of that side's mass falls is returned — clipping the outermost `1 - quantile`
// as outliers. Returns 0 when the side is empty. A fixed histogram keeps this an
// O(n) pass with no sort, approximate to ~1/NUM_HISTOGRAM_BINS of maxMag, far
// finer than the display needs.
function sideMagnitudePercentile(
  datasets: Dataset[],
  scoresFor: (data: FeatureArrays) => Float32Array,
  positiveSide: boolean,
  maxMag: number,
  quantile: number,
): number {
  if (maxMag <= 0) {
    return 0
  }
  const bins = new Int32Array(NUM_HISTOGRAM_BINS)
  const scale = NUM_HISTOGRAM_BINS / maxMag
  let count = 0
  for (const { data, visStart, visEnd } of datasets) {
    const { featurePositions, numFeatures } = data
    const scores = scoresFor(data)
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
      const mag = positiveSide ? scores[i]! : -scores[i]!
      if (mag > 0) {
        const bin = Math.min(NUM_HISTOGRAM_BINS - 1, Math.floor(mag * scale))
        bins[bin]!++
        count++
      }
    }
  }
  if (count === 0) {
    return 0
  }
  const target = quantile * count
  let cumulative = 0
  for (let bin = 0; bin < NUM_HISTOGRAM_BINS; bin++) {
    cumulative += bins[bin]!
    // +1 so the target bin is included rather than clipped.
    if (cumulative >= target) {
      return ((bin + 1) / NUM_HISTOGRAM_BINS) * maxMag
    }
  }
  return maxMag
}

// Builds a `[low, high]` domain by clipping each side of the score distribution
// to its central `quantile` fraction (e.g. 0.99 → clip the outermost 1% of each
// sign). Unlike localsd it makes no normality assumption, so it stays robust on
// the heavily skewed score distributions typical of coverage/wiggle data.
//
// The two signs are clipped INDEPENDENTLY, anchored at 0. A single combined
// percentile spends its whole budget on the dominant side, so on strongly
// one-sided signed data (e.g. phyloP: mostly-positive conservation with a
// sparse, small negative tail) the minority tail's 1st percentile lands at or
// above 0 and the negative extent collapses to a flat band. Measuring each
// side's percentile from 0 outward keeps a small-but-real opposite tail visible.
function percentileDomainFromHistogram(
  stats: ScoreStats,
  summaryScoreMode: string,
  quantile: number,
  datasets: Dataset[],
): [number, number] {
  const { scoreMin, scoreMax } = stats
  if (scoreMax - scoreMin <= 0) {
    return [scoreMin, scoreMax]
  }
  const useWhiskers = summaryScoreMode === 'whiskers'
  // Mirror computeStats' array selection: whiskers spreads the bounds across the
  // min/max summary arrays; every other mode draws both from one scalar.
  const highScoresFor = (data: FeatureArrays) =>
    useWhiskers
      ? data.featureMaxScores
      : getEffectiveScores(data, summaryScoreMode)
  const lowScoresFor = (data: FeatureArrays) =>
    useWhiskers
      ? data.featureMinScores
      : getEffectiveScores(data, summaryScoreMode)
  const high =
    scoreMax > 0
      ? sideMagnitudePercentile(
          datasets,
          highScoresFor,
          true,
          scoreMax,
          quantile,
        )
      : 0
  const negExtent =
    scoreMin < 0
      ? sideMagnitudePercentile(
          datasets,
          lowScoresFor,
          false,
          -scoreMin,
          quantile,
        )
      : 0
  // Anchor the low bound at 0 for all-positive data (matching localsd's origin
  // convention); otherwise extend it to the negative side's clipped extent.
  return [scoreMin < 0 ? -negExtent : 0, high]
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

/**
 * #api
 * The true `[min, max]` score extent of the visible features for a summary mode,
 * before any autoscale clipping. Comparing it against the displayed domain flags
 * when the domain clips real signal (e.g. localpercentile clamping copy-number
 * gains that sit above the diploid baseline).
 */
export function computeScoreExtent(
  summaryScoreMode: string,
  visibleEntries: {
    data: FeatureArrays
    visStart: number
    visEnd: number
  }[],
): [number, number] | undefined {
  const stats = computeStats(summaryScoreMode, visibleEntries)
  return stats ? [stats.scoreMin, stats.scoreMax] : undefined
}
