export const complementBase: Record<string, string> = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
}

/**
 * Denominator for one modification's coverage bar at one position. The bar shows
 * `sum-of-probabilities / detectable`, so `detectable` sets its height.
 *
 * - `modifiable`: reads that have the base this mod sits on. A 5mC sits on a C,
 *   and the paired C on the other strand reads as a G, so both C and G count.
 * - `detectable`: of those, the reads actually examined for the mod. Duplex
 *   (both strands basecalled) → all modifiable reads, so `detectable ===
 *   modifiable`. Simplex (one strand) → only the examined strand: this base on
 *   forward reads + its complement on reverse reads. Counting the rest would
 *   understate the fraction. See detectSimplexModifications.
 *
 * 'N' (unknown base) applies to every read, so both counts are the total depth.
 */
export function calculateModificationCounts({
  base,
  isSimplex,
  baseCounts,
  strandBaseCounts,
}: {
  base: string
  isSimplex: boolean
  baseCounts: Record<string, number>
  strandBaseCounts: Record<string, { fwd: number; rev: number }>
}) {
  if (base === 'N') {
    const total = Object.values(baseCounts).reduce((a, b) => a + b, 0)
    return { modifiable: total, detectable: total }
  }
  const cmp = complementBase[base] ?? 'N'
  const baseCount = baseCounts[base] ?? 0
  const complCount = baseCounts[cmp] ?? 0
  const modifiable = baseCount + complCount

  if (isSimplex) {
    // Only the examined strand: this base on forward reads + its complement on
    // reverse reads (same cytosine, read from the opposite side).
    const baseFwd = strandBaseCounts[base]?.fwd ?? 0
    const complRev = strandBaseCounts[cmp]?.rev ?? 0
    return { modifiable, detectable: baseFwd + complRev }
  }
  return { modifiable, detectable: modifiable }
}
