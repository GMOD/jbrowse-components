// IUPAC nucleotide ambiguity codes → character classes, for turning a PAM
// motif like "NGG" or "TTTV" into a regex
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

export function iupacToRegex(pam: string) {
  let out = ''
  for (const c of pam.toUpperCase()) {
    out += IUPAC_CODES[c] ?? c
  }
  return out
}

// reverse-complement a PAM motif in IUPAC space, so a minus-strand guide's PAM
// can be matched directly on the plus-strand sequence
export function reverseComplementIupac(pam: string) {
  let out = ''
  for (const c of pam.toUpperCase()) {
    out = (IUPAC_COMPLEMENT[c] ?? c) + out
  }
  return out
}

// Cheap, honest triage metrics for a protospacer (in guide 5'->3' orientation):
// GC percent (extreme values hurt on-target efficiency) and a poly-T run, which
// terminates transcription from pol III (U6/H1) promoters and kills the guide.
// These are sequence properties, NOT a specificity/off-target score.
export function guideQuality(guideSeq: string) {
  const seq = guideSeq.toUpperCase()
  let gc = 0
  for (const c of seq) {
    if (c === 'G' || c === 'C') {
      gc += 1
    }
  }
  return {
    gcPercent: seq.length ? Math.round((100 * gc) / seq.length) : 0,
    hasPolyT: seq.includes('TTTT'),
  }
}

export interface GuidePlacement {
  featureStart: number
  featureEnd: number
  pamStart: number
  pamEnd: number
  protoStart: number
  protoEnd: number
  cutSite: number
}

// Given a PAM match on the plus strand at [matchStart, matchStart+pamLength),
// compute the protospacer extent and predicted (blunt) cut site for a guide on
// the given strand. Cas9-type enzymes carry the PAM 3' of the protospacer;
// Cas12a-type carry it 5'. All coordinates are absolute plus-strand interbase.
export function placeGuide({
  matchStart,
  pamLength,
  guideLength,
  pamLocation,
  cutOffset,
  strand,
}: {
  matchStart: number
  pamLength: number
  guideLength: number
  pamLocation: string
  cutOffset: number
  strand: 1 | -1
}): GuidePlacement {
  const pamStart = matchStart
  const pamEnd = matchStart + pamLength
  const isFivePrime = pamLocation === '5prime'

  // the protospacer sits on the low-coordinate side of the PAM for a plus-strand
  // 3' PAM or a minus-strand 5' PAM, and on the high-coordinate side otherwise
  const protoOnLeft =
    (strand === 1 && !isFivePrime) || (strand === -1 && isFivePrime)

  const protoStart = protoOnLeft ? pamStart - guideLength : pamEnd
  const protoEnd = protoOnLeft ? pamStart : pamEnd + guideLength

  // the cut sits cutOffset bp into the protospacer from its PAM-proximal end
  const cutSite = protoOnLeft ? pamStart - cutOffset : pamEnd + cutOffset

  return {
    featureStart: Math.min(pamStart, protoStart),
    featureEnd: Math.max(pamEnd, protoEnd),
    pamStart,
    pamEnd,
    protoStart,
    protoEnd,
    cutSite,
  }
}
