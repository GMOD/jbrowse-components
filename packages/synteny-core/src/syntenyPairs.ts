/**
 * The adjacent row pairs a stack of assembly rows implies: pair `i` spans rows
 * `i` and `i + 1`, so N rows make N-1 pairs. The import forms index their
 * per-pair track selections by pair, and a dotplot is just the single-pair case.
 * Named here so callers iterate pairs instead of open-coding `length - 1` loops
 * and `idx + 1` offsets.
 */
export function syntenyPairs(assemblyNames: string[]) {
  const pairs: string[][] = []
  for (let idx = 0; idx < assemblyNames.length - 1; idx++) {
    pairs.push([assemblyNames[idx]!, assemblyNames[idx + 1]!])
  }
  return pairs
}
