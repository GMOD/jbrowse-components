// One-pass count / min / max / mean over a set of lengths. Keeping a named
// `sum` and turning it into a mean only in `toLengthStats` means the divide
// happens in exactly one place — the tooltip's interbase and deletion tallies
// report the same statistic and had drifted into two different ways of getting
// it.

export interface LengthAccumulator {
  count: number
  min: number
  max: number
  sum: number
}

/** Fold one length in, seeding the accumulator on first sight. */
export function accumulateLength(
  acc: LengthAccumulator | undefined,
  len: number,
): LengthAccumulator {
  if (acc === undefined) {
    return { count: 1, min: len, max: len, sum: len }
  }
  acc.count++
  acc.sum += len
  if (len < acc.min) {
    acc.min = len
  }
  if (len > acc.max) {
    acc.max = len
  }
  return acc
}

/** The accumulated lengths in the shape `CoverageTooltipBin` reports. */
export function toLengthStats(acc: LengthAccumulator) {
  return {
    count: acc.count,
    minLen: acc.min,
    maxLen: acc.max,
    avgLen: acc.sum / acc.count,
  }
}
