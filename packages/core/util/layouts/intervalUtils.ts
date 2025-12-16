/**
 * Shared utilities for interval-based layout algorithms.
 * Used by both GranularRectLayout and PileupLayout.
 */

/**
 * Check if a range [left, right) is clear (no overlaps) in a sorted interval array.
 * Intervals are stored as flat array: [start1, end1, start2, end2, ...]
 *
 * Uses linear scan for small arrays (< 40 elements) and binary search for larger.
 */
export function isRangeClear(
  intervals: number[],
  left: number,
  right: number,
): boolean {
  const len = intervals.length

  if (len === 0) {
    return true
  }

  // Linear scan for small arrays (better cache locality)
  if (len < 40) {
    for (let i = 0; i < len; i += 2) {
      if (intervals[i + 1]! > left && intervals[i]! < right) {
        return false
      }
    }
    return true
  }

  // Binary search for larger arrays
  // Find first interval whose end > left (first potential overlap)
  let low = 0
  let high = len >> 1

  while (low < high) {
    const mid = (low + high) >>> 1
    const midIdx = mid << 1
    if (intervals[midIdx + 1]! <= left) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  const idx = low << 1
  if (idx >= len) {
    return true
  }

  // If the first candidate's start is >= right, no overlap
  return intervals[idx]! >= right
}

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
