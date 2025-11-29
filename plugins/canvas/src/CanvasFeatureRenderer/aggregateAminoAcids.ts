export interface AggregatedAminoAcid {
  aminoAcid: string
  startIndex: number
  endIndex: number
  length: number
  proteinIndex: number
}

/**
 * Aggregates consecutive genomic positions that map to the same amino acid
 */
export function aggregateAminos(
  protein: string,
  g2p: Record<string, number>,
  featureStart: number,
  featureEnd: number,
  strand: number,
): AggregatedAminoAcid[] {
  const aggregated: AggregatedAminoAcid[] = []
  const len = featureEnd - featureStart

  let currentElt: number | undefined = undefined
  let currentAminoAcid: string | null = null
  let startIndex = 0
  let idx = 0

  for (let i = 0; i < len; i++) {
    const pos = strand === -1 ? featureEnd - i : featureStart + i
    const elt = g2p[pos]!
    const aminoAcid = protein[elt] ?? '&'

    if (currentElt === undefined) {
      currentElt = elt
      currentAminoAcid = aminoAcid
      startIndex = idx
    } else if (currentElt !== elt) {
      aggregated.push({
        aminoAcid: currentAminoAcid!,
        startIndex,
        endIndex: idx - 1,
        length: idx - startIndex,
        proteinIndex: currentElt,
      })
      currentElt = elt
      currentAminoAcid = aminoAcid
      startIndex = idx
    }

    idx++
  }

  if (currentAminoAcid !== null) {
    aggregated.push({
      aminoAcid: currentAminoAcid,
      startIndex,
      endIndex: idx - 1,
      length: idx - startIndex,
      proteinIndex: currentElt!,
    })
  }

  return aggregated
}
