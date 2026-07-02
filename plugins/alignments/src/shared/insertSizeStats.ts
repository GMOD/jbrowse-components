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

export function getInsertSizeStats(filtered: number[]) {
  const len = filtered.length
  const avg = sum(filtered) / len
  // Two-pass mean-subtracted variance. The single-pass sum-of-squares form
  // (len*Σx² − (Σx)²)/len² is unstable at high coverage: both terms grow as
  // O(len²·x̄²), overflow 2^53, and lose precision to catastrophic cancellation
  // — a slightly-negative result then yields sd = NaN, which silently collapses
  // insert-size coloring (every read compares as "normal").
  let sumSqDiff = 0
  for (let i = 0; i < len; i++) {
    const diff = filtered[i]! - avg
    sumSqDiff += diff * diff
  }
  const sd = Math.sqrt(sumSqDiff / len)

  // Color thresholds use a robust spread (median ± 3·1.4826·MAD) rather than
  // mean ± 3·sd. Insert-size distributions are right-skewed: deletions and
  // large SVs sit in a long upper tail that inflates sd, which on the short
  // side drives avg − 3·sd negative (clamped to 0) so NOTHING is ever flagged
  // "short insert" and the insertion-supporting signal silently vanishes. The
  // MAD measures spread from the normal-insert bulk and ignores that tail, so
  // the lower bound stays positive and meaningful and the upper bound tracks
  // the bulk closely enough that moderate deletions aren't masked. When MAD = 0
  // (over half the values identical) the robust spread is degenerate, so fall
  // back to the mean/sd estimate there.
  const sorted = [...filtered].sort((a, b) => a - b)
  const med = median(sorted)
  const mad = medianAbsDevFromSorted(sorted, med)
  const center = mad > 0 ? med : avg
  const spread = mad > 0 ? 3 * MAD_TO_SD * mad : 3 * sd
  const upper = center + spread
  const lower = Math.max(0, center - spread)
  return {
    upper,
    lower,
    avg,
    sd,
  }
}
