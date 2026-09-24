import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

// Canonical read-pair / split-read orientation classification, shared by every
// consumer that colors or flags aberrant orientations (the alignments GPU/arc/
// linked-read paths and BreakpointSplitView's overlay). Each consumer maps the
// canonical category to its own vocabulary (num code, GPU palette index, MUI
// theme color) — this owns the strand/orientation logic so those can't drift.
//
// See https://software.broadinstitute.org/software/igv/interpreting_pair_orientations

// IGV pair-orientation category under the default FR library.
export type PairDirection = 'LR' | 'RL' | 'RR' | 'LL'

const FR_ORIENTATION: Record<string, PairDirection> = {
  F1R2: 'LR',
  F2R1: 'LR',

  R1F2: 'RL',
  R2F1: 'RL',

  R1R2: 'RR',
  R2R1: 'RR',

  F1F2: 'LL',
  F2F1: 'LL',
}

// What each category means, in words. Here rather than in either consumer
// because both of them show these to a reader and they must say the same thing:
// the legend's swatch rows (CATEGORY_LEGEND) and the group-by section chips
// (`pairOrientationKey`). The letters lead, since that is the vocabulary IGV
// users arrive with and the tooltip prints.
export const PAIR_DIRECTION_LABELS: Record<PairDirection, string> = {
  LR: 'LR - Normal pair orientation',
  RL: 'RL - Mates point outward',
  RR: 'RR - Both mates reverse strand',
  LL: 'LL - Both mates forward strand',
}

// Classify a pair-orientation string (e.g. "F1R2") into its FR-library category,
// or undefined when unknown/unset.
export function pairDirection(
  pairOrientation: string | undefined,
): PairDirection | undefined {
  return pairOrientation ? FR_ORIENTATION[pairOrientation] : undefined
}

// LR is the normal (concordant) orientation; everything else is aberrant. An
// unknown direction is treated as not-abnormal (the caller decides its color).
export function isAbnormalPairDirection(dir: PairDirection | undefined) {
  return dir !== undefined && dir !== 'LR'
}

// The per-read array encoding of PairDirection (0 = unknown), which is also the
// GPU uniform's and the linked-read connector's palette slot.
export const PAIR_DIRECTION_NUM: Record<PairDirection, number> = {
  LR: 1,
  RL: 2,
  RR: 3,
  LL: 4,
}

export function pairOrientationToNum(pairOrientation: string | undefined) {
  const dir = pairDirection(pairOrientation)
  return dir ? PAIR_DIRECTION_NUM[dir] : 0
}

/**
 * The ordinary pair: the aligner flagged it properly paired, it is not a
 * chimeric segment, and its mates face each other. The one definition of
 * "concordant" behind "Show proper pairs", "Show concordant-pair arcs" and the
 * breakpoint split view's mate links, written over the per-read numbers since
 * none of them hold features.
 *
 * Unknown orientation (0) counts as concordant: an aberrant orientation is
 * positive evidence, and its absence is not. A supplementary segment is never
 * concordant, since aligners like BWA-MEM copy 0x2 onto it from the pair.
 *
 * Not the read cloud's `isConcordantFRPair`, which asks whether |TLEN| sits in
 * the modal insert-size band rather than what the aligner concluded.
 */
export function isConcordantPairRead(
  flags: number,
  pairOrientationNum: number,
) {
  return (
    !!(flags & SAM_FLAG_PROPER_PAIR) &&
    !(flags & SAM_FLAG_SUPPLEMENTARY) &&
    (pairOrientationNum === 0 || pairOrientationNum === PAIR_DIRECTION_NUM.LR)
  )
}

// Strand-flip flavor of a split-read junction (or a same-strand aberrant pair):
// 'rf' when the first segment is reverse and the second forward, 'fr' for the
// opposite, undefined when co-linear (same strand). Mapped reads always carry
// ±1 strands; anything else classifies as co-linear.
export type SplitInversion = 'rf' | 'fr'

export function splitInversion(
  s1: number,
  s2: number,
): SplitInversion | undefined {
  return s1 === -1 && s2 === 1 ? 'rf' : s1 === 1 && s2 === -1 ? 'fr' : undefined
}

// What a split-read junction between two segments of one read means, from the
// segments' strands alone: a strand flip is an inversion junction, a co-linear
// (both strands known and equal) join is a deletion / tandem-dup junction, and
// an unknown strand on either side classifies as neither. Every path that
// colors a junction spells this same three-way rule — the coverage-arc palette,
// the linked-read connector palette, and the chain read-fill marker — so it
// lives here and each maps the category to its own vocabulary.
export type SplitJunctionKind = 'inversion' | 'deletion'

export function splitJunctionKind(
  s1: number,
  s2: number,
): SplitJunctionKind | undefined {
  return splitInversion(s1, s2) !== undefined
    ? 'inversion'
    : s1 !== 0 && s2 !== 0
      ? 'deletion'
      : undefined
}
