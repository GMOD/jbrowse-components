export interface AggregatedAminoAcid {
  aminoAcid: string
  startBp: number
  endBp: number
  proteinIndex: number
  isStopOrNonTriplet: boolean
}

export function aggregateAminos(
  protein: string,
  g2p: Record<number, number>,
  featureStart: number,
  featureEnd: number,
  strand: number,
): AggregatedAminoAcid[] {
  const aggregated: AggregatedAminoAcid[] = []
  const len = featureEnd - featureStart

  let groupElt = -1
  let groupStart = 0
  let groupEnd = 0

  const flush = (endI: number) => {
    if (groupElt === -1) {
      return
    }
    const aa = protein[groupElt] ?? '&'
    const length = endI - groupStart + 1
    aggregated.push({
      aminoAcid: aa,
      startBp:
        strand === -1 ? featureEnd - 1 - endI : featureStart + groupStart,
      endBp: strand === -1 ? featureEnd - groupStart : featureStart + endI + 1,
      proteinIndex: groupElt,
      isStopOrNonTriplet: aa === '*' || length !== 3,
    })
    groupElt = -1
  }

  for (let i = 0; i < len; i++) {
    const pos = strand === -1 ? featureEnd - 1 - i : featureStart + i
    const elt = g2p[pos]
    if (elt === undefined) {
      console.warn(`No g2p mapping for position ${pos}`)
      flush(groupEnd)
      continue
    }
    if (elt !== groupElt) {
      flush(groupEnd)
      groupElt = elt
      groupStart = i
    }
    groupEnd = i
  }
  flush(groupEnd)

  return aggregated
}
