import { sum } from '@jbrowse/core/util'

// For a Gaussian, sd ≈ 1.4826·MAD, so a robust spread built from the MAD lines
// up with the classic ±Nσ thresholds on well-behaved data.
const MAD_TO_SD = 1.4826

function median(sorted: number[]) {
  const n = sorted.length
  const mid = n >> 1
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

// Median of |x − med| over an already-sorted array, in O(n) with no second
// allocation+sort. Walking outward from the median, deviations grow
// monotonically: the values below med (indices high→low) and those at/above med
// (indices low→high) form two ascending runs, so merging them and stopping at
// the middle yields the same value as sorting |x − med| — but ~2x cheaper at the
// high coverage where this matters (the naive form sorts twice). Matches
// `median()` semantics exactly (odd → middle element; even → mean of the two).
function medianAbsDevFromSorted(sorted: number[], med: number) {
  const n = sorted.length
  let lo = 0
  while (lo < n && sorted[lo]! < med) {
    lo++
  }
  let i = lo - 1 // below-med run, walking toward index 0 (ascending deviation)
  let j = lo // at/above-med run, walking toward n-1 (ascending deviation)
  const target = n >> 1
  let prev = 0
  let cur = 0
  for (let k = 0; k <= target; k++) {
    prev = cur
    const leftDev = i >= 0 ? med - sorted[i]! : Infinity
    const rightDev = j < n ? sorted[j]! - med : Infinity
    if (leftDev <= rightDev) {
      cur = leftDev
      i--
    } else {
      cur = rightDev
      j++
    }
  }
  return n % 2 === 1 ? cur : (prev + cur) / 2
}

// The insert-size band used for coloring: the two thresholds that classify a
// read's |TLEN| as short/normal/long. A subset of getInsertSizeStats' output
// (avg/sd are used only by the tooltip and the arc long-range gate), and the
// exact shape serialized across the worker boundary (see RenderAlignmentData
// PileupDataResult.insertSizeStats).
export interface InsertSizeBand {
  upper: number
  lower: number
}

export interface InsertSizeStats extends InsertSizeBand {
  avg: number
  sd: number
}

export type InsertSizeClass = 'long' | 'short' | 'normal'

// Single home of the short/normal/long threshold rule, shared by the read-fill
// classifier (colorUtils.ts) and the arc/read-cloud classifier (arcs/compute.ts)
// so the two can't drift. `absInsert` is |TLEN|; 0 means unset (single-end /
// unpaired) and classifies as 'normal', never 'short' — otherwise an unpaired
// read in a mixed dataset (stats defined) would paint as a short insert. The GPU
// twin (insertSizeColor in read.slang) mirrors this via its `is > 0` guard.
export function classifyInsertSize(
  absInsert: number,
  band: InsertSizeBand | undefined,
): InsertSizeClass {
  if (band && absInsert > band.upper) {
    return 'long'
  }
  if (band && absInsert > 0 && absInsert < band.lower) {
    return 'short'
  }
  return 'normal'
}

export interface RobustSpread {
  center: number
  spread: number
  avg: number
  sd: number
}

// Robust center + spread of a sample: the median with a MAD-based spread
// (sd ≈ 1.4826·MAD), scaled by `numSds` (default 3 → the classic ±3σ band),
// plus the mean/sd for callers that want them. Prefer this over mean ± Nσ for
// right-skewed data: insert-size distributions (and paired-end arc radii) have a
// long upper tail — deletions, large SVs — that inflates sd, driving the lower
// bound negative (nothing flagged "short") and the upper bound past genuine
// long-range signal. The MAD measures spread from the normal bulk and ignores
// that tail. When MAD = 0 (over half the values identical) the robust spread is
// degenerate, so fall back to mean/sd there.
//
// The sd itself is a two-pass mean-subtracted variance. The single-pass
// sum-of-squares form (len*Σx² − (Σx)²)/len² is unstable at high coverage: both
// terms grow as O(len²·x̄²), overflow 2^53, and lose precision to catastrophic
// cancellation — a slightly-negative result then yields sd = NaN.
export function robustSpread(values: number[], numSds = 3): RobustSpread {
  const len = values.length
  const avg = sum(values) / len
  let sumSqDiff = 0
  for (let i = 0; i < len; i++) {
    const diff = values[i]! - avg
    sumSqDiff += diff * diff
  }
  const sd = Math.sqrt(sumSqDiff / len)

  const sorted = [...values].sort((a, b) => a - b)
  const med = median(sorted)
  const mad = medianAbsDevFromSorted(sorted, med)
  const center = mad > 0 ? med : avg
  const spread = mad > 0 ? numSds * MAD_TO_SD * mad : numSds * sd
  return { center, spread, avg, sd }
}

export function getInsertSizeStats(filtered: number[]): InsertSizeStats {
  const { center, spread, avg, sd } = robustSpread(filtered)
  return {
    upper: center + spread,
    lower: Math.max(0, center - spread),
    avg,
    sd,
  }
}
