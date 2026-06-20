import { sum } from '@jbrowse/core/util'

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
  const upper = avg + 3 * sd
  const lower = Math.max(0, avg - 3 * sd)
  return {
    upper,
    lower,
    avg,
    sd,
  }
}
