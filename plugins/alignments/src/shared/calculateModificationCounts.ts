export const complementBase: Record<string, string> = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
}

export interface StrandCount {
  fwd: number
  rev: number
}

// Per-position canonical-base coverage split by read strand. This is the single
// source of truth for the modification denominators: the un-split base count is
// always `fwd + rev`, so it is derived here rather than tracked in parallel.
export type StrandBaseCounts = Record<string, StrandCount>

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
 *
 * `detectable <= modifiable` by construction: its two terms are a subset of the
 * four summed into `modifiable`.
 */
export function calculateModificationCounts({
  base,
  isSimplex,
  strandBaseCounts,
}: {
  base: string
  isSimplex: boolean
  strandBaseCounts: StrandBaseCounts
}) {
  if (base === 'N') {
    const total = Object.values(strandBaseCounts).reduce(
      (a, sc) => a + sc.fwd + sc.rev,
      0,
    )
    return { modifiable: total, detectable: total }
  }
  const cmp = complementBase[base] ?? 'N'
  const baseSc = strandBaseCounts[base]
  const complSc = strandBaseCounts[cmp]
  const baseTotal = baseSc ? baseSc.fwd + baseSc.rev : 0
  const complTotal = complSc ? complSc.fwd + complSc.rev : 0
  const modifiable = baseTotal + complTotal

  // Simplex: this base read from forward reads + its complement from reverse
  // reads (same cytosine seen from the opposite side).
  const detectable = isSimplex
    ? (baseSc?.fwd ?? 0) + (complSc?.rev ?? 0)
    : modifiable
  return { modifiable, detectable }
}
