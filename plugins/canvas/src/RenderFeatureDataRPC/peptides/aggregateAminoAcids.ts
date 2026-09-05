export interface AggregatedAminoAcid {
  aminoAcid: string
  startBp: number
  endBp: number
  proteinIndex: number
  isStopOrNonTriplet: boolean
  isTranslExcept: boolean
}

export interface CdsSegment {
  start: number
  end: number
  phase?: number
}

// Maps the already-translated `protein` back onto the genome, keyed by each
// segment's `start-end`. A codon straddling an exon boundary becomes a partial
// piece in each segment, since its three bases are not genomically contiguous.
//
// `cds` must be deduped and sorted in transcription order — the same shape the
// peptide string was translated from, or the protein indices will not line up.
export function aminoAcidsBySegment(
  cds: CdsSegment[],
  protein: string,
  strand: number,
  translExceptIndices?: ReadonlySet<number>,
): Map<string, AggregatedAminoAcid[]> {
  const bySegment = new Map<string, AggregatedAminoAcid[]>()
  const firstPhase = cds[0]?.phase ?? 0
  let counter = (3 - firstPhase) % 3

  for (const seg of cds) {
    const len = seg.end - seg.start
    const pieces: AggregatedAminoAcid[] = []
    let offset = 0
    while (offset < len) {
      const c = counter + offset
      const proteinIndex = Math.floor(c / 3)
      const chunkLen = Math.min((proteinIndex + 1) * 3 - c, len - offset)
      const aminoAcid = protein[proteinIndex] ?? '&'
      pieces.push({
        aminoAcid,
        startBp:
          strand === -1 ? seg.end - offset - chunkLen : seg.start + offset,
        endBp: strand === -1 ? seg.end - offset : seg.start + offset + chunkLen,
        proteinIndex,
        isStopOrNonTriplet: aminoAcid === '*' || chunkLen !== 3,
        isTranslExcept: translExceptIndices?.has(proteinIndex) ?? false,
      })
      offset += chunkLen
    }
    counter += len
    bySegment.set(`${seg.start}-${seg.end}`, pieces)
  }

  return bySegment
}
