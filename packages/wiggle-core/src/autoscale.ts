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
 * One block's worth of values to fold into a domain, whatever packed them: a
 * wiggle source's interleaved `featurePositions` and its three summary arrays,
 * or a mark layer's separate `x`/`x2` and its one `y` lane. `starts[i * stride]`
 * and `ends[i * stride + endOffset]` give instance `i`'s span; `low`, `high` and
 * `avg` give the two ends of its value and the one the mean is taken over, which
 * are the same array wherever the packer ships a single scalar.
 */
export interface ScoreSpan {
  count: number
  starts: Uint32Array
  ends: Uint32Array
  stride: number
  endOffset: number
  low: Float32Array
  high: Float32Array
  avg: Float32Array
  visStart?: number
  visEnd?: number
}

/** The wiggle packer's arrays as a span, under a summary mode. */
export function datasetSpan(
  { data, visStart, visEnd }: Dataset,
  summaryScoreMode: string,
): ScoreSpan {
  const { low, high } = boundArrays(summaryScoreMode)
  return {
    count: data.numFeatures,
    starts: data.featurePositions,
    ends: data.featurePositions,
    stride: 2,
    endOffset: 1,
    low: low(data),
    high: high(data),
    avg: data.featureScores,
    visStart,
    visEnd,
  }
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

// First index whose instance STARTS at or after `bp`. `starts` is sorted by
// start — the same property `findFeatureAtBp` binary-searches on.
function lowerBoundByStart(span: ScoreSpan, bp: number) {
  const { starts, stride } = span
  let lo = 0
  let hi = span.count
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid * stride]! >= bp) {
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
function visibleIndexRange(span: ScoreSpan) {
  const { visStart, visEnd, ends, stride, endOffset } = span
  if (visStart === undefined || visEnd === undefined) {
    return { from: 0, to: span.count }
  }
  const to = lowerBoundByStart(span, visEnd)
  let from = lowerBoundByStart(span, visStart)
  while (from > 0 && ends[(from - 1) * stride + endOffset]! > visStart) {
    from--
  }
  return { from, to }
}

// Half-open overlap test against the span's own window, for the instances the
// index range admits.
function spanOverlaps(span: ScoreSpan, i: number) {
  const { visStart, visEnd, starts, ends, stride, endOffset } = span
  return (
    visStart === undefined ||
    visEnd === undefined ||
    overlaps(
      starts[i * stride]!,
      ends[i * stride + endOffset]!,
      visStart,
      visEnd,
    )
  )
}

// Min/max/mean/stddev of the visible instances, in one pass. Exported (not #api
// — internal plumbing shared with the quantitative displays) so a caller needing
// both a domain and the raw extent computes the stats once and feeds them to
// `autoscaleDomainFromSpans` instead of walking the arrays twice.
export function computeSpanStats(spans: ScoreSpan[]): ScoreStats | undefined {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  for (const span of spans) {
    const { low, high, avg } = span
    const { from, to } = visibleIndexRange(span)
    for (let i = from; i < to; i++) {
      if (!spanOverlaps(span, i)) {
        continue
      }
      // Non-finite values are skipped rather than folded in: a wig file may
      // carry a NaN, and one of them poisons min/max and mean alike, collapsing
      // the whole domain to the [0, 1] stub the callers fall back to.
      const lo = low[i]!
      if (Number.isFinite(lo)) {
        min = Math.min(min, lo)
      }
      const hi = high[i]!
      if (Number.isFinite(hi)) {
        max = Math.max(max, hi)
      }
      // Mean/stddev always come from `avg` — the average score on the wiggle
      // side — while min/max come from the mode-selected pair. Intentional:
      // sd-based autoscale centers on the average-value distribution even in
      // whiskers/min/max summary modes.
      const mid = avg[i]!
      if (Number.isFinite(mid)) {
        sum += mid
        sumSq += mid * mid
        count++
      }
    }
  }
  if (count === 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined
  }
  const mean = sum / count
  const stdDev = Math.sqrt(Math.max(0, sumSq / count - mean * mean))
  return { scoreMin: min, scoreMax: max, scoreMean: mean, scoreStdDev: stdDev }
}

/** `computeSpanStats` over the wiggle packer's datasets. */
export function computeScoreStats(
  summaryScoreMode: string,
  datasets: Dataset[],
): ScoreStats | undefined {
  return computeSpanStats(datasets.map(d => datasetSpan(d, summaryScoreMode)))
}

/**
 * #api
 * Converts score stats into a `[min, max]` domain, applying std-dev expansion
 * for the `localsd` autoscale type. An `undefined` mode is a display whose
 * scale declares none, and takes the plain extremes.
 */
export function domainFromStats(
  stats: ScoreStats,
  autoscaleType: string | undefined,
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

// The `quantile`-th percentile magnitude of one signed side of the value
// distribution: instances are filtered to a single sign (`positiveSide`), their
// magnitudes binned over `[0, maxMag]`, and the magnitude below which `quantile`
// of that side's mass falls is returned — clipping the outermost `1 - quantile`
// as outliers. Returns 0 when the side is empty. A fixed histogram keeps this an
// O(n) pass with no sort, approximate to ~1/NUM_HISTOGRAM_BINS of maxMag, far
// finer than the display needs.
function sideMagnitudePercentile(
  spans: ScoreSpan[],
  valuesFor: (span: ScoreSpan) => Float32Array,
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
  for (const span of spans) {
    const values = valuesFor(span)
    const { from, to } = visibleIndexRange(span)
    for (let i = from; i < to; i++) {
      if (!spanOverlaps(span, i)) {
        continue
      }
      const mag = positiveSide ? values[i]! : -values[i]!
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

// Builds a `[low, high]` domain by clipping each side of the value distribution
// to its central `quantile` fraction (e.g. 0.99 -> clip the outermost 1% of each
// sign). Unlike localsd it makes no normality assumption, so it stays robust on
// the heavily skewed distributions typical of coverage/wiggle data.
//
// The two signs are clipped INDEPENDENTLY, anchored at 0. A single combined
// percentile spends its whole budget on the dominant side, so on strongly
// one-sided signed data (e.g. phyloP: mostly-positive conservation with a
// sparse, small negative tail) the minority tail's 1st percentile lands at or
// above 0 and the negative extent collapses to a flat band. Measuring each
// side's percentile from 0 outward keeps a small-but-real opposite tail visible.
function percentileDomainFromSpans(
  stats: ScoreStats,
  quantile: number,
  spans: ScoreSpan[],
): [number, number] {
  const { scoreMin, scoreMax } = stats
  if (scoreMax - scoreMin <= 0) {
    return [scoreMin, scoreMax]
  }
  const high =
    scoreMax > 0
      ? sideMagnitudePercentile(
          spans,
          span => span.high,
          true,
          scoreMax,
          quantile,
        )
      : 0
  const negExtent =
    scoreMin < 0
      ? sideMagnitudePercentile(
          spans,
          span => span.low,
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
 * Already-computed stats to the displayed domain, for the `local` / `localsd` /
 * `localpercentile` autoscale modes. `localpercentile` re-walks the spans to
 * build its histogram; the other modes read the stats alone.
 */
export function autoscaleDomainFromSpans({
  stats,
  autoscaleType,
  numStdDev,
  numQuantile = 0.99,
  spans,
}: {
  stats: ScoreStats
  autoscaleType: string | undefined
  numStdDev: number
  numQuantile?: number
  spans: ScoreSpan[]
}): [number, number] {
  return autoscaleType === 'localpercentile'
    ? percentileDomainFromSpans(stats, numQuantile, spans)
    : domainFromStats(stats, autoscaleType, numStdDev)
}

/** `autoscaleDomainFromSpans` over the wiggle packer's datasets. */
export function autoscaleDomainFromStats({
  stats,
  autoscaleType,
  summaryScoreMode,
  numStdDev,
  numQuantile = 0.99,
  visibleEntries,
}: {
  stats: ScoreStats
  autoscaleType: string | undefined
  summaryScoreMode: string
  numStdDev: number
  numQuantile?: number
  visibleEntries: Dataset[]
}): [number, number] {
  return autoscaleDomainFromSpans({
    stats,
    autoscaleType,
    numStdDev,
    numQuantile,
    spans: visibleEntries.map(d => datasetSpan(d, summaryScoreMode)),
  })
}

/**
 * #api
 * Computes a score domain from the visible feature arrays for the `local` /
 * `localsd` / `localpercentile` autoscale types.
 */
export function computeAutoscaleDomain(
  autoscaleType: string | undefined,
  summaryScoreMode: string,
  numStdDev: number,
  visibleEntries: {
    data: FeatureArrays
    visStart: number
    visEnd: number
  }[],
  numQuantile = 0.99,
): [number, number] | undefined {
  const spans = visibleEntries.map(d => datasetSpan(d, summaryScoreMode))
  const stats = computeSpanStats(spans)
  return stats
    ? autoscaleDomainFromSpans({
        stats,
        autoscaleType,
        numStdDev,
        numQuantile,
        spans,
      })
    : undefined
}
