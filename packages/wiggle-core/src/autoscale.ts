// Default autoscale modes shared by wiggle / multi-wiggle. The alignments
// coverage band exposes only a subset and a dynamic σ value, so it passes its
// own option list.
//
// Here rather than beside the menu that renders it because a `[value, label]`
// table is the one thing a menu holds that something outside the app needs to
// read: the website's figure recipes name these labels in a click path, and a
// module importing React or a lazy .tsx cannot be loaded by the node script
// that builds them. A leaf module makes the recipe import the label instead of
// retyping it, which is the difference between a copy that drifts and one that
// cannot.
export const DEFAULT_AUTOSCALE_OPTIONS: [string, string][] = [
  ['local', 'Local'],
  ['localpercentile', 'Local (99th percentile)'],
  ['localsd', 'Local ± 3σ'],
]

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

// Which per-feature array each end of the domain comes from. Whiskers spreads
// the two ends across the min/max summary arrays; every other mode draws both
// from a single scalar. One table because `computeScoreStats` and the
// percentile histogram have to agree — a domain whose extent and whose clipped
// bound were measured off different arrays is a domain that clips its own data.
function boundArrays(summaryScoreMode: string) {
  const useWhiskers = summaryScoreMode === 'whiskers'
  return {
    low: (data: FeatureArrays) =>
      useWhiskers
        ? data.featureMinScores
        : getEffectiveScores(data, summaryScoreMode),
    high: (data: FeatureArrays) =>
      useWhiskers
        ? data.featureMaxScores
        : getEffectiveScores(data, summaryScoreMode),
  }
}

// Bin count for the approximate percentile histogram. 1024 bins gives ~0.1%
// resolution on the domain, which is finer than any autoscale needs and keeps
// the second pass O(n) with a fixed, trivial allocation.
const NUM_HISTOGRAM_BINS = 1024

// First index whose feature STARTS at or after `bp`. `featurePositions` is
// sorted by start — the same property `findFeatureAtBp` binary-searches on.
function lowerBoundByStart(
  featurePositions: Uint32Array,
  numFeatures: number,
  bp: number,
) {
  let lo = 0
  let hi = numFeatures
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (featurePositions[mid * 2]! >= bp) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return lo
}

/**
 * The half-open index range that can overlap `[visStart, visEnd)`.
 *
 * A fetch covers `bufferedVisibleRegions` — the viewport plus half a screen on
 * each side — so roughly half of what these passes walk is off-screen, and
 * `localpercentile` (the default) walks it two or three times over. Both bounds
 * come from a binary search on the sorted starts instead.
 *
 * The upper bound needs nothing but that sortedness: a feature starting at or
 * after `visEnd` cannot reach back into the window. The lower bound also leans
 * on wiggle features being non-overlapping bins — bigWig summary levels and
 * bedGraph both are — walking back over any run that does reach in. The callers
 * still test `overlaps` per feature inside the range, so a dataset that broke
 * that assumption could only lose a long early feature, never gain one.
 */
function visibleIndexRange(
  featurePositions: Uint32Array,
  numFeatures: number,
  visStart: number | undefined,
  visEnd: number | undefined,
) {
  if (visStart === undefined || visEnd === undefined) {
    return { from: 0, to: numFeatures }
  }
  const to = lowerBoundByStart(featurePositions, numFeatures, visEnd)
  let from = lowerBoundByStart(featurePositions, numFeatures, visStart)
  while (from > 0 && featurePositions[(from - 1) * 2 + 1]! > visStart) {
    from--
  }
  return { from, to }
}

// Min/max/mean/stddev of the visible features for a summary mode, in one pass.
// Exported (not #api — internal plumbing shared with the wiggle displays) so a
// caller needing both a domain and the raw extent computes the stats once and
// feeds them to autoscaleDomainFromStats instead of walking the arrays twice.
export function computeScoreStats(
  summaryScoreMode: string,
  datasets: Dataset[],
): ScoreStats | undefined {
  const { low, high } = boundArrays(summaryScoreMode)
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  for (const { data, visStart, visEnd } of datasets) {
    const { featureScores, featurePositions, numFeatures } = data
    // Selecting the arrays once per dataset keeps the mode check out of the
    // per-feature loop.
    const minScores = low(data)
    const maxScores = high(data)
    const { from, to } = visibleIndexRange(
      featurePositions,
      numFeatures,
      visStart,
      visEnd,
    )
    for (let i = from; i < to; i++) {
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
  if (autoscaleType === 'localsd') {
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
    const { from, to } = visibleIndexRange(
      featurePositions,
      numFeatures,
      visStart,
      visEnd,
    )
    for (let i = from; i < to; i++) {
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
  const arrays = boundArrays(summaryScoreMode)
  const high =
    scoreMax > 0
      ? sideMagnitudePercentile(datasets, arrays.high, true, scoreMax, quantile)
      : 0
  const negExtent =
    scoreMin < 0
      ? sideMagnitudePercentile(
          datasets,
          arrays.low,
          false,
          -scoreMin,
          quantile,
        )
      : 0
  // Anchor the low bound at 0 for all-positive data (matching localsd's origin
  // convention); otherwise extend it to the negative side's clipped extent.
  return [scoreMin < 0 ? -negExtent : 0, high]
}

// Turns already-computed stats into the displayed domain for the `local` /
// `localsd` / `localpercentile` autoscale types. `localpercentile` re-walks the
// entries to build its histogram; the other types read the stats alone.
// computeAutoscaleDomain (#api) is the one-shot form.
export function autoscaleDomainFromStats({
  stats,
  autoscaleType,
  summaryScoreMode,
  numStdDev,
  numQuantile = 0.99,
  visibleEntries,
}: {
  stats: ScoreStats
  autoscaleType: string
  summaryScoreMode: string
  numStdDev: number
  numQuantile?: number
  visibleEntries: Dataset[]
}): [number, number] {
  return autoscaleType === 'localpercentile'
    ? percentileDomainFromHistogram(
        stats,
        summaryScoreMode,
        numQuantile,
        visibleEntries,
      )
    : domainFromStats(stats, autoscaleType, numStdDev)
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
  const stats = computeScoreStats(summaryScoreMode, visibleEntries)
  return stats
    ? autoscaleDomainFromStats({
        stats,
        autoscaleType,
        summaryScoreMode,
        numStdDev,
        numQuantile,
        visibleEntries,
      })
    : undefined
}
