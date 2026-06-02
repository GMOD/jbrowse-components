export interface BasicFeature {
  end: number
  start: number
  refName: string
}

export function mergeIntervals<T extends { start: number; end: number }>(
  intervals: T[],
  w = 5000,
) {
  if (intervals.length <= 1) {
    return intervals
  }

  const stack: T[] = []
  intervals = intervals.sort((a, b) => a.start - b.start)
  stack.push(intervals[0]!)

  for (let i = 1; i < intervals.length; i++) {
    const top = stack.at(-1)!
    if (top.end + w < intervals[i]!.start - w) {
      stack.push(intervals[i]!)
    } else if (top.end < intervals[i]!.end) {
      top.end = intervals[i]!.end
    }
  }

  return stack
}

// returns new array of non-overlapping features
export function gatherOverlaps<T extends BasicFeature>(regions: T[], w = 5000) {
  const memo: Record<string, T[]> = {}
  for (const x of regions) {
    memo[x.refName] ??= []
    memo[x.refName]!.push(x)
  }
  return Object.values(memo).flatMap(group => mergeIntervals(group, w))
}
