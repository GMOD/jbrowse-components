const complementBase = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
} as const

export interface StrandCounts {
  readonly entryDepth: number
  readonly '1': number
  readonly '-1': number
  readonly '0': number
}

export interface ModificationCountsParams {
  readonly base: string
  readonly isSimplex: boolean
  readonly refbase: string | undefined
  readonly snps: Readonly<Record<string, Partial<StrandCounts>>>
  readonly ref: StrandCounts
  readonly score0: number
}

interface ModificationCountsResult {
  readonly modifiable: number
  readonly detectable: number
}

/**
 * Calculate modifiable and detectable counts for a modification following IGV's algorithm.
 *
 * @param params.base - The canonical base (e.g., 'A' for A+a modification)
 * @param params.isSimplex - Whether this modification is simplex (only on one strand)
 * @param params.refbase - The reference base at this position
 * @param params.snps - SNP counts at this position
 * @param params.ref - Reference match counts at this position
 * @param params.score0 - Total coverage at this position
 * @returns Object with modifiable and detectable counts
 */
export function calculateModificationCounts({
  base,
  isSimplex,
  refbase,
  snps,
  ref,
  score0,
}: ModificationCountsParams): ModificationCountsResult {
  // Handle N base (all bases are modifiable/detectable)
  if (base === 'N') {
    return { modifiable: score0, detectable: score0 }
  }

  const cmp = complementBase[base as keyof typeof complementBase]

  // Calculate total reads for base and complement
  // IGV: getCount(pos, base) = reads matching that base (from SNPs or ref)
  const baseCount =
    (snps[base]?.entryDepth || 0) + (refbase === base ? ref.entryDepth : 0)
  const complCount =
    (snps[cmp]?.entryDepth || 0) + (refbase === cmp ? ref.entryDepth : 0)

  // Modifiable: reads that COULD have this modification (base or complement)
  // IGV: modifiable = getCount(pos, base) + getCount(pos, compl)
  const modifiable = baseCount + complCount

  // Detectable: reads where we can DETECT this modification
  // For simplex: only specific strands (+ for base, - for complement)
  // For duplex: all reads (same as modifiable)
  // IGV: detectable = simplex ? getPosCount(base) + getNegCount(compl) : modifiable
  const detectable = isSimplex
    ? (snps[base]?.['1'] || 0) +
      (snps[cmp]?.['-1'] || 0) +
      (refbase === base ? ref['1'] : 0) +
      (refbase === cmp ? ref['-1'] : 0)
    : modifiable

  return { modifiable, detectable }
}
