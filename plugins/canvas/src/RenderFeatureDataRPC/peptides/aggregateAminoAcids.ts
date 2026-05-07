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
  let groupAA = ''
  let groupStart = 0
  let prevI = -1

  const pushGroup = (endI: number) => {
    const length = endI - groupStart + 1
    const startBp =
      strand === -1 ? featureEnd - 1 - endI : featureStart + groupStart
    const endBp =
      strand === -1 ? featureEnd - groupStart : featureStart + endI + 1
    aggregated.push({
      aminoAcid: groupAA,
      startBp,
      endBp,
      proteinIndex: groupElt,
      isStopOrNonTriplet: groupAA === '*' || length !== 3,
    })
  }

  for (let i = 0; i < len; i++) {
    const pos = strand === -1 ? featureEnd - 1 - i : featureStart + i
    const elt = g2p[pos]
    if (elt === undefined) {
      console.warn(`No g2p mapping for position ${pos}`)
      continue
    }

    if (groupElt === -1) {
      groupElt = elt
      groupAA = protein[elt] ?? '&'
      groupStart = i
    } else if (groupElt !== elt) {
      pushGroup(prevI)
      groupElt = elt
      groupAA = protein[elt] ?? '&'
      groupStart = i
    }
    prevI = i
  }

  if (groupElt !== -1) {
    pushGroup(prevI)
  }

  return aggregated
}
