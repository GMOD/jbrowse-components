import type { Sample } from '../types'

/**
 * Find the index of the reference sample (matching the assembly name from the region)
 * Falls back to 0 if no match is found
 */
export function findRefSampleIndex(
  samples: Sample[] | undefined,
  assemblyName: string | undefined,
): number {
  if (!samples || !assemblyName) {
    return 0
  }
  const idx = samples.findIndex(s => s.id === assemblyName)
  return idx === -1 ? 0 : idx
}

/**
 * Build a mapping from display column index to genomic position.
 * Only the reference sequence determines genomic positions - gaps in the
 * reference map to undefined (no genomic position), while gaps in other
 * samples don't affect the mapping.
 */
export function buildColToGenomePos(
  refSequence: string,
  regionStart: number,
): (number | undefined)[] {
  const mapping: (number | undefined)[] = []
  let genomePos = regionStart

  for (const char of refSequence) {
    if (char === '-') {
      mapping.push(undefined)
    } else {
      mapping.push(genomePos)
      genomePos++
    }
  }
  return mapping
}
