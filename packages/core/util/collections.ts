// do an array map of an iterable
export function iterMap<T, U>(
  iter: Iterable<T>,
  func: (arg: T) => U,
  sizeHint?: number,
) {
  const results = Array.from<U>({ length: sizeHint || 0 })
  let counter = 0
  for (const item of iter) {
    results[counter] = func(item)
    counter += 1
  }
  return results
}

/**
 * Returns the index of the last element in the array where predicate is true,
 * and -1 otherwise. Based on https://stackoverflow.com/a/53187807
 *
 * @param array - The source array to search in
 *
 * @param predicate - find calls predicate once for each element of the array, in
 * descending order, until it finds one where predicate returns true.
 *
 * @returns findLastIndex returns element index where predicate is true.
 * Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean,
) {
  let l = array.length
  while (l--) {
    if (predicate(array[l]!, l, array)) {
      return l
    }
  }
  return -1
}

export function findLast<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean,
) {
  let l = array.length
  while (l--) {
    if (predicate(array[l]!, l, array)) {
      return array[l]
    }
  }
  return undefined
}

export function groupBy<T>(array: Iterable<T>, predicate: (v: T) => string) {
  const result = {} as Record<string, T[]>
  for (const value of array) {
    const key = predicate(value)
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(value)
  }
  return result
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function mergeIntervals<T extends { start: number; end: number }>(
  intervals: T[],
  w = 5000,
) {
  // test if there are at least 2 intervals
  if (intervals.length <= 1) {
    return intervals
  }

  const stack = [] as T[]
  let top = null

  // sort the intervals based on their start values
  intervals = intervals.sort((a, b) => a.start - b.start)

  // push the 1st interval into the stack
  stack.push(intervals[0]!)

  // start from the next interval and merge if needed
  for (let i = 1; i < intervals.length; i++) {
    // get the top element
    top = stack.at(-1)!

    // if the current interval doesn't overlap with the
    // stack top element, push it to the stack
    if (top.end + w < intervals[i]!.start - w) {
      stack.push(intervals[i]!)
    }
    // otherwise update the end value of the top element
    // if end of current interval is higher
    else if (top.end < intervals[i]!.end) {
      top.end = intervals[i]!.end
    }
  }

  return stack
}

export interface BasicFeature {
  end: number
  start: number
  refName: string
}

// returns new array non-overlapping features
export function gatherOverlaps<T extends BasicFeature>(regions: T[], w = 5000) {
  return Object.values(groupBy(regions, r => r.refName)).flatMap(group =>
    mergeIntervals(
      group.sort((a, b) => a.start - b.start),
      w,
    ),
  )
}
