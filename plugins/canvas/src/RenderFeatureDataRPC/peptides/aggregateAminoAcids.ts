export interface AggregatedAminoAcid {
  aminoAcid: string
  startBp: number
  endBp: number
  proteinIndex: number
  isStopOrNonTriplet: boolean
  // residue whose translation came from a transl_except override (Sec/Pyl/polyA
  // stop), so the renderer can highlight it like the feature-detail protein view
  isTranslExcept: boolean
}

export interface CdsSegment {
  start: number
  end: number
  phase?: number
}

// Maps the already-translated `protein` onto the genome, splitting each CDS
// segment into its amino-acid pieces keyed by the segment's `start-end` so the
// renderer can look up a CDS child's residues in O(1). A codon straddling an
// exon boundary becomes a partial piece in each segment (flagged
// isStopOrNonTriplet) because its three bases are not genomically contiguous.
//
// The transcription counter carries across segments, matching the phase
// convention in convertCodingSequenceToPeptides: a phase>0 transcript reserves
// protein index 0 for the leading partial codon.
//
// `cds` must be deduped and sorted in transcription order (ascending genomic
// start on the + strand, descending on the - strand) — i.e. the same shape the
// peptide string was translated from, so protein indices line up.
export function aminoAcidsBySegment(
  cds: CdsSegment[],
  protein: string,
  strand: number,
  // protein-string indices whose residue was set by a transl_except override
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
      // bases remaining in this codon, capped by what's left in the segment
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
