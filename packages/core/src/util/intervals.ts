export interface BasicFeature {
  end: number
  start: number
  refName: string
}

/**
 * Merge intervals that overlap once each is grown by `padding` on both sides.
 * `padding` is per side, so the merge window between two intervals is `2 *
 * padding` — the default merges anything within 10kb of its neighbour, not 5kb.
 * Callers that have already baked their padding into start/end pass 0.
 */
export function mergeIntervals<T extends { start: number; end: number }>(
  intervals: T[],
  padding = 5000,
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
    if (top.end + padding < next.start - padding) {
      stack.push({ ...next })
    } else if (top.end < next.end) {
      top.end = next.end
    }
  }

  return stack
}

/**
 * {@link mergeIntervals} per refName: returns a new array of non-overlapping
 * features. `padding` carries the same per-side meaning.
 */
export function gatherOverlaps<T extends BasicFeature>(
  regions: T[],
  padding = 5000,
) {
  const memo: Record<string, T[]> = {}
  for (const x of regions) {
    memo[x.refName] ??= []
    memo[x.refName]!.push(x)
  }
  return Object.values(memo).flatMap(group => mergeIntervals(group, padding))
}
