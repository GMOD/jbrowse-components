// The `basesPerSpan` interval, `[lo, hi)`, over which `@gmod/bbi`'s `getView`
// picks the same level it picks for `basesPerSpan`: the highest-indexed level
// whose reduction fits twice into a span, and the raw section below the first.
export function tierSpanRange(
  reductionLevels: readonly number[],
  basesPerSpan: number,
): [number, number] {
  let picked = -1
  for (let i = reductionLevels.length - 1; i >= 0; i--) {
    if (reductionLevels[i]! <= 2 * basesPerSpan) {
      picked = i
      break
    }
  }
  let hi = Infinity
  for (let i = picked + 1; i < reductionLevels.length; i++) {
    hi = Math.min(hi, reductionLevels[i]! / 2)
  }
  return [picked >= 0 ? reductionLevels[picked]! / 2 : 0, hi]
}
