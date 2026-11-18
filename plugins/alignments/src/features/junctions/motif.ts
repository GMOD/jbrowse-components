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

// The transcript strand the motif implies, 0 for unknown and non-canonical.
export function spliceMotifStrand(code: number) {
  return CANONICAL_MOTIFS[code - 1]?.strand ?? 0
}

export function isNonCanonicalSpliceMotif(code: number) {
  return code === SPLICE_MOTIF_NON_CANONICAL
}

// Named on the transcript strand ('GT-AG' for both the plus and minus spelling),
// since the strand is reported beside it, and saying outright that the pair is a
// canonical one: 'GT-AG' alone left the reader to remember which three of the
// sixteen dinucleotide pairs the non-canonical label is the complement of.
// Undefined when never looked up, so a tooltip can omit the line rather than
// print "unknown".
export function spliceMotifLabel(code: number) {
  return code === SPLICE_MOTIF_NON_CANONICAL
    ? 'non-canonical'
    : code === SPLICE_MOTIF_UNKNOWN
      ? undefined
      : `${MOTIF_LABELS[Math.floor((code - 1) / 2)]} (canonical)`
}

// One end's dinucleotide as a byte, 0 when it was never read.
//
// Encoded per END rather than per junction because a junction's two ends
// routinely fall in different fetched sequence windows, and then NEITHER window
// can classify the pair on its own. Collapsed introns are the systematic case:
// each padded exon is its own displayed region, so the donor is in one region's
// window and the acceptor in the next one's, and every junction in the view came
// back unknown however much sequence was on screen. The halves merge
// independently in `mergeJunctions` and are classified once both are in hand.
export const DINUCLEOTIDE_UNKNOWN = 0

const BASES = 'ACGT'
const OTHER_BASE = BASES.length

function baseCode(c: string) {
  const i = BASES.indexOf(c)
  return i === -1 ? OTHER_BASE : i
}

// 1 + a base-5 pair, the fifth digit being every non-ACGT character (an `N` in
// the reference, which is a real answer — non-canonical — not a missing one).
export function encodeDinucleotide(bases: string) {
  return (
    1 +
    baseCode(bases[0]!.toUpperCase()) * 5 +
    baseCode(bases[1]!.toUpperCase())
  )
}

// The six canonical pairs as codes, so the classification is integer equality.
// `mergeJunctions` runs it on the pan/zoom frame path, where matching the two
// halves as strings meant decoding both back out of their bytes — two string
// allocations per junction per frame for two comparisons.
const CANONICAL_MOTIF_CODES = CANONICAL_MOTIFS.map(m => ({
  donor: encodeDinucleotide(m.donor),
  acceptor: encodeDinucleotide(m.acceptor),
}))

export function classifyEncodedSpliceMotif(donor: number, acceptor: number) {
  if (donor === DINUCLEOTIDE_UNKNOWN || acceptor === DINUCLEOTIDE_UNKNOWN) {
    return SPLICE_MOTIF_UNKNOWN
  }
  const i = CANONICAL_MOTIF_CODES.findIndex(
    m => m.donor === donor && m.acceptor === acceptor,
  )
  return i === -1 ? SPLICE_MOTIF_NON_CANONICAL : i + 1
}

function dinucleotideAt(offset: number, sequence: string) {
  return offset < 0 || offset + 2 > sequence.length
    ? DINUCLEOTIDE_UNKNOWN
    : encodeDinucleotide(sequence.slice(offset, offset + 2))
}

// The intron [start, end)'s two dinucleotides against `sequence`, which begins
// at absolute bp `sequenceStart`. Each end is unknown when it lies outside the
// window; both are when the intron is too short for them to be distinct.
export function spliceMotifDinucleotides(
  start: number,
  end: number,
  sequence: string,
  sequenceStart: number,
) {
  return end - start < 4
    ? { donor: DINUCLEOTIDE_UNKNOWN, acceptor: DINUCLEOTIDE_UNKNOWN }
    : {
        donor: dinucleotideAt(start - sequenceStart, sequence),
        acceptor: dinucleotideAt(end - 2 - sequenceStart, sequence),
      }
}
