import { quantileExtent } from '@jbrowse/core/util/quantileExtent'

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
  /**
   * Instance `i`'s row key, and 1 at each key that draws: an instance whose
   * key draws nothing, or lies past the end, folds into no domain. Absent,
   * every instance folds in.
   */
  row?: Uint32Array
  drawnKeys?: Uint8Array
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
// from a single scalar. One table because the extent and the clipped bound have
// to read the same arrays, or a domain clips its own data.
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
 * each side — so roughly half of what these passes walk is off-screen, and a
 * clipped domain walks it twice. Both bounds come from a binary search on the
 * sorted starts instead.
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

// Half-open overlap test against the span's own window, for the drawn
// instances the index range admits.
function spanOverlaps(span: ScoreSpan, i: number) {
  const { visStart, visEnd, starts, ends, stride, endOffset, drawnKeys } = span
  return (
    (drawnKeys === undefined || drawnKeys[span.row?.[i] ?? 0] === 1) &&
    (visStart === undefined ||
      visEnd === undefined ||
      overlaps(
        starts[i * stride]!,
        ends[i * stride + endOffset]!,
        visStart,
        visEnd,
      ))
  )
}

// The extremes of the visible instances, in one pass. Exported (not #api —
// internal plumbing shared with the quantitative displays) so a caller needing
// both a domain and the raw extent computes them once and feeds them to
// `autoscaleDomainFromSpans` instead of walking the arrays twice.
export function computeSpanStats(spans: ScoreSpan[]): ScoreStats | undefined {
  let min = Infinity
  let max = -Infinity
  for (const span of spans) {
    const { low, high } = span
    const { from, to } = visibleIndexRange(span)
    for (let i = from; i < to; i++) {
      if (!spanOverlaps(span, i)) {
        continue
      }
      // Non-finite values are skipped rather than folded in: a wig file may
      // carry a NaN, and one of them poisons min/max, collapsing the whole
      // domain to the [0, 1] stub the callers fall back to.
      const lo = low[i]!
      if (Number.isFinite(lo)) {
        min = Math.min(min, lo)
      }
      const hi = high[i]!
      if (Number.isFinite(hi)) {
        max = Math.max(max, hi)
      }
    }
  }
  return Number.isFinite(min) && Number.isFinite(max)
    ? { scoreMin: min, scoreMax: max }
    : undefined
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
 * The domain the visible instances autoscale to: at a `quantile` of 1 their
 * extremes, `stats`; below it `quantileExtent` over each side's own values —
 * the top read off `high` and the bottom off `low`, so whiskers open to their
 * spread — each sign clipped on its own and anchored at 0.
 */
export function autoscaleDomainFromSpans({
  stats,
  quantile,
  spans,
}: {
  stats: ScoreStats
  quantile: number
  spans: ScoreSpan[]
}): [number, number] {
  if (quantile >= 1) {
    return [stats.scoreMin, stats.scoreMax]
  }
  const values: number[] = []
  for (const span of spans) {
    const { low, high } = span
    const { from, to } = visibleIndexRange(span)
    for (let i = from; i < to; i++) {
      if (!spanOverlaps(span, i)) {
        continue
      }
      if (high[i]! > 0) {
        values.push(high[i]!)
      }
      if (low[i]! < 0) {
        values.push(low[i]!)
      }
    }
  }
  const [min, max] = quantileExtent(values, values.length, quantile)
  return [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0]
}

/** `autoscaleDomainFromSpans` over the wiggle packer's datasets. */
export function autoscaleDomainFromStats({
  stats,
  quantile,
  summaryScoreMode,
  visibleEntries,
}: {
  stats: ScoreStats
  quantile: number
  summaryScoreMode: string
  visibleEntries: Dataset[]
}): [number, number] {
  return autoscaleDomainFromSpans({
    stats,
    quantile,
    spans: visibleEntries.map(d => datasetSpan(d, summaryScoreMode)),
  })
}

/**
 * #api
 * The score domain of the visible feature arrays, following `quantile` as
 * `scales.y.domainQuantile` says.
 */
export function computeAutoscaleDomain(
  quantile: number,
  summaryScoreMode: string,
  visibleEntries: {
    data: FeatureArrays
    visStart: number
    visEnd: number
  }[],
): [number, number] | undefined {
  const spans = visibleEntries.map(d => datasetSpan(d, summaryScoreMode))
  const stats = computeSpanStats(spans)
  return stats
    ? autoscaleDomainFromSpans({ stats, quantile, spans })
    : undefined
}
