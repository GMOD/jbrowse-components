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
