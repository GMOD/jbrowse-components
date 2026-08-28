/**
 * Shared utilities for interval-based layout algorithms, used by
 * GranularRectLayout.
 */

/**
 * Find insertion point for a new interval in a sorted interval array.
 * Returns the index where [left, right] should be inserted.
 */
export function findInsertionPoint(intervals: number[], left: number): number {
  const len = intervals.length

  if (len < 40) {
    for (let i = 0; i < len; i += 2) {
      if (left < intervals[i]!) {
        return i
      }
    }
    return len
  }

  // Binary search
  let low = 0
  let high = len >> 1

  while (low < high) {
    const mid = (low + high) >>> 1
    if (intervals[mid << 1]! < left) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low << 1
}

/**
 * Insert an interval into a sorted interval array using manual shift
 * (avoids splice GC pressure).
 */
export function insertInterval(
  intervals: number[],
  idx: number,
  left: number,
  right: number,
): void {
  const len = intervals.length
  intervals.push(0, 0)
  for (let i = len + 1; i > idx + 1; i--) {
    intervals[i] = intervals[i - 2]!
  }
  intervals[idx] = left
  intervals[idx + 1] = right
}
