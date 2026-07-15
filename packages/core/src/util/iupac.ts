// IUPAC nucleotide ambiguity codes → character classes, for turning a motif like
// "NGG" or "GGTNACC" into a regex
const IUPAC_CODES: Record<string, string> = {
  A: 'A',
  C: 'C',
  G: 'G',
  T: 'T',
  R: '[AG]',
  Y: '[CT]',
  S: '[GC]',
  W: '[AT]',
  K: '[GT]',
  M: '[AC]',
  B: '[CGT]',
  D: '[AGT]',
  H: '[ACT]',
  V: '[ACG]',
  N: '[ACGT]',
}

const IUPAC_COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  R: 'Y',
  Y: 'R',
  S: 'S',
  W: 'W',
  K: 'M',
  M: 'K',
  B: 'V',
  V: 'B',
  D: 'H',
  H: 'D',
  N: 'N',
}

export const IUPAC_MOTIF_REGEX = /^[ACGTRYSWKMBDHVN]+$/

export function iupacToRegex(motif: string) {
  let out = ''
  for (const c of motif.toUpperCase()) {
    out += IUPAC_CODES[c] ?? c
  }
  return out
}

// reverse-complement a motif in IUPAC space, so a minus-strand match can be
// found directly on the plus-strand sequence
export function reverseComplementIupac(motif: string) {
  let out = ''
  for (const c of motif.toUpperCase()) {
    out = (IUPAC_COMPLEMENT[c] ?? c) + out
  }
  return out
}

// A motif that reads the same on both strands (most restriction sites) matches
// the plus strand and minus strand at identical coordinates, so scanning both
// would emit every hit twice.
export function isPalindromic(motif: string) {
  return reverseComplementIupac(motif) === motif.toUpperCase()
}
