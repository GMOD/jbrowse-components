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

  // clone so neither the input array order nor its elements are mutated
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const stack: T[] = [{ ...sorted[0]! }]

  for (let i = 1; i < sorted.length; i++) {
    const top = stack.at(-1)!
    const next = sorted[i]!
    if (top.end + w < next.start - w) {
      stack.push({ ...next })
    } else if (top.end < next.end) {
      top.end = next.end
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
