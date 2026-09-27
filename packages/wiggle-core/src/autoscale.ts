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
 * wiggle source's interleaved `featurePositions` and its summary arrays, or a
 * mark layer's separate `x`/`x2` and its one `y` lane. `starts[i * stride]` and
 * `ends[i * stride + endOffset]` give instance `i`'s span, and `low` and `high`
 * the two ends of its value, one array where the packer ships a single scalar.
 */
export interface ScoreSpan {
  count: number
  starts: Uint32Array
  ends: Uint32Array
  stride: number
  endOffset: number
  low: Float32Array
  high: Float32Array
  visStart?: number
  visEnd?: number
  /**
   * Whether the instances are bins sorted by start that never overlap, as a
   * wiggle source's are, so a binary search finds the window's. A mark
   * layer's features overlap and arrive source after source or section after
   * section, so each is tested against the window instead.
   */
  sortedBins: boolean
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
    visStart,
    visEnd,
    sortedBins: true,
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
 * The half-open index range that can overlap `[visStart, visEnd)`. Over
 * `sortedBins` a binary search bounds it, walking back over any bin that
 * reaches into the window; any other span is walked whole, and every caller
 * tests `overlaps` per instance inside the range.
 */
function visibleIndexRange(span: ScoreSpan) {
  const { visStart, visEnd, ends, stride, endOffset, sortedBins } = span
  if (!sortedBins || visStart === undefined || visEnd === undefined) {
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
 * extremes, `stats`; below it `quantileExtent`'s ends, the bottom read off
 * the `low`s and the top off the `high`s less the zeros where any is
 * positive, so whiskers open to their spread, a sparse window's empty bins
 * lower no top, and a window of nothing above 0 keeps the top it has.
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
  const lows: number[] = []
  const highs: number[] = []
  for (const span of spans) {
    const { low, high } = span
    const { from, to } = visibleIndexRange(span)
    for (let i = from; i < to; i++) {
      if (!spanOverlaps(span, i)) {
        continue
      }
      lows.push(low[i]!)
      highs.push(high[i]!)
    }
  }
  const tops = highs.some(v => v > 0) ? highs.filter(v => v !== 0) : highs
  const min = quantileExtent(lows, lows.length, quantile)[0]
  const max = quantileExtent(tops, tops.length, quantile)[1]
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
