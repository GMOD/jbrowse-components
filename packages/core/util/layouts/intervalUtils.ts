/**
 * Shared utilities for interval-based layout algorithms.
 * Used by both GranularRectLayout and PileupLayout.
 */

/**
 * Threshold for switching from linear scan to binary search.
 * Arrays smaller than this use linear scan for better cache locality.
 */
export const LINEAR_SEARCH_THRESHOLD = 40

/**
 * Check if a range [left, right) is clear (no overlaps) in a sorted interval array.
 * Intervals are stored as flat array: [start1, end1, start2, end2, ...]
 *
 * Uses linear scan for small arrays and binary search for larger.
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
  if (len < LINEAR_SEARCH_THRESHOLD) {
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
 * Find the data index of the interval containing x.
 * Returns the index in the data array (not the intervals array).
 * Returns -1 if no interval contains x.
 */
export function getItemAt(intervals: number[], x: number): number {
  const len = intervals.length

  if (len === 0) {
    return -1
  }

  // Linear scan for small arrays
  if (len < LINEAR_SEARCH_THRESHOLD) {
    for (let i = 0; i < len; i += 2) {
      if (x >= intervals[i]! && x < intervals[i + 1]!) {
        return i >> 1
      }
    }
    return -1
  }

  // Binary search for larger arrays - find interval containing x
  let low = 0
  let high = len >> 1

  while (low < high) {
    const mid = (low + high) >>> 1
    const midIdx = mid << 1
    if (intervals[midIdx + 1]! <= x) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  const idx = low << 1
  if (idx < len && x >= intervals[idx]! && x < intervals[idx + 1]!) {
    return low
  }
  return -1
}

/**
 * Find insertion point for a new interval in a sorted interval array.
 * Returns the index where [left, right] should be inserted.
 */
export function findInsertionPoint(intervals: number[], left: number): number {
  const len = intervals.length

  if (len < LINEAR_SEARCH_THRESHOLD) {
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

/**
 * Discard intervals within a range, trimming intervals that partially overlap.
 * Returns new arrays for both intervals and parallel data.
 *
 * Intervals completely within [left, right) are removed.
 * Intervals partially overlapping are trimmed or split.
 */
export function discardIntervals<T>(
  intervals: number[],
  data: T[],
  left: number,
  right: number,
): { intervals: number[]; data: T[] } {
  const oldLen = intervals.length
  const newIntervals: number[] = []
  const newData: T[] = []

  for (let i = 0; i < oldLen; i += 2) {
    const start = intervals[i]!
    const end = intervals[i + 1]!
    const intervalData = data[i >> 1]!

    // If interval is completely within discard range, skip it
    if (start >= left && end <= right) {
      continue
    }
    // If no overlap, keep it
    if (end <= left || start >= right) {
      newIntervals.push(start, end)
      newData.push(intervalData)
    }
    // If interval overlaps left edge
    else if (start < left && end > left) {
      if (end <= right) {
        // Trim from the right
        newIntervals.push(start, left)
        newData.push(intervalData)
      } else {
        // Interval spans the entire discard range, split it
        newIntervals.push(start, left, right, end)
        newData.push(intervalData, intervalData)
      }
    }
    // If interval overlaps right edge only
    else if (start < right && end > right) {
      newIntervals.push(right, end)
      newData.push(intervalData)
    }
  }

  return { intervals: newIntervals, data: newData }
}
