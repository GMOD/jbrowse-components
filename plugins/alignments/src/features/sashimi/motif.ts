// A junction's splice-site motif, read off the reference: the first two intron
// bases (donor) and the last two (acceptor). STAR's numbering in its SJ.out.tab
// motif column, with one code past it for a junction whose bases were never
// looked up — an unindexed assembly, or an end that fell outside the fetched
// sequence.
export const SPLICE_MOTIF_UNKNOWN = 0
export const SPLICE_MOTIF_NON_CANONICAL = 7

// Codes 1-6. The even codes are the odd ones reverse-complemented, i.e. the
// same intron read on the minus strand, which is why each pair carries a strand.
const CANONICAL_MOTIFS: { donor: string; acceptor: string; strand: 1 | -1 }[] =
  [
    { donor: 'GT', acceptor: 'AG', strand: 1 },
    { donor: 'CT', acceptor: 'AC', strand: -1 },
    { donor: 'GC', acceptor: 'AG', strand: 1 },
    { donor: 'CT', acceptor: 'GC', strand: -1 },
    { donor: 'AT', acceptor: 'AC', strand: 1 },
    { donor: 'GT', acceptor: 'AT', strand: -1 },
  ]

const MOTIF_LABELS = ['GT-AG', 'GC-AG', 'AT-AC']

export function classifySpliceMotif(donor: string, acceptor: string) {
  const d = donor.toUpperCase()
  const a = acceptor.toUpperCase()
  const i = CANONICAL_MOTIFS.findIndex(m => m.donor === d && m.acceptor === a)
  return i === -1 ? SPLICE_MOTIF_NON_CANONICAL : i + 1
}

// The transcript strand the motif implies, 0 for unknown and non-canonical.
export function spliceMotifStrand(code: number) {
  return CANONICAL_MOTIFS[code - 1]?.strand ?? 0
}

export function isNonCanonicalSpliceMotif(code: number) {
  return code === SPLICE_MOTIF_NON_CANONICAL
}

// Named on the transcript strand ('GT-AG' for both the plus and minus spelling),
// since the strand is reported beside it. Undefined when never looked up, so a
// tooltip can omit the line rather than print "unknown".
export function spliceMotifLabel(code: number) {
  return code === SPLICE_MOTIF_NON_CANONICAL
    ? 'non-canonical'
    : code === SPLICE_MOTIF_UNKNOWN
      ? undefined
      : MOTIF_LABELS[Math.floor((code - 1) / 2)]
}

// The motif of the intron [start, end) against `sequence`, which begins at
// absolute bp `sequenceStart`. Unknown when either dinucleotide lies outside it.
export function spliceMotifAt(
  start: number,
  end: number,
  sequence: string,
  sequenceStart: number,
) {
  const d = start - sequenceStart
  const a = end - 2 - sequenceStart
  return d < 0 || a + 2 > sequence.length || a < d + 2
    ? SPLICE_MOTIF_UNKNOWN
    : classifySpliceMotif(sequence.slice(d, d + 2), sequence.slice(a, a + 2))
}
