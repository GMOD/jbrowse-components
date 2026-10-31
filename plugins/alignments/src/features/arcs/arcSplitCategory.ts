import type { SwatchCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'

// What a same-chromosome split-read arc is, by which way the read extends from
// each foot (`PendingArc.p1Dir`/`p2Dir`), and the read swatch whose color each
// class paints. The deletion-type split paints the split-read gold; the other
// three paint their pair twin's color, since a pair across the same junction
// falls in the same class, so a duplication-type junction and the two ends of
// an inversion read the same in both kinds of evidence. These key connections
// only: a read fill belongs to a segment, which can sit between two junctions
// of different classes, and stays strand-only (`splitSameStrand`/`splitInverted`).
export const ARC_SPLIT_SWATCH = {
  splitForward: 'splitSameStrand',
  splitBack: 'pairRL',
  splitInvLL: 'pairLL',
  splitInvRR: 'pairRR',
} as const satisfies Record<string, SwatchCategory>

export type ArcSplitCategory = keyof typeof ARC_SPLIT_SWATCH

// The junction's type, as DELLY, LUMPY and samplot name it, and not a variant
// call: a deletion-type junction is also one side of a templated insertion. The
// inversion rows carry the pair code of their twin, as Manta ties INV3/INV5 to
// LL/RR reads.
export const ARC_SPLIT_LABELS: Record<ArcSplitCategory, string> = {
  splitForward: 'Split read (deletion-type)',
  splitBack: 'Split read (duplication-type)',
  splitInvLL: 'Split read (inversion, LL-type)',
  splitInvRR: 'Split read (inversion, RR-type)',
}

// The one row a split class and its pair twin share when a key holds both: they
// paint one color, and two rows of one color read as two meanings.
export const ARC_SPLIT_MERGED_LABELS: Record<ArcSplitCategory, string> = {
  splitForward: 'Same-strand or deletion-type split',
  splitBack: 'RL pair or duplication-type split',
  splitInvLL: 'LL pair or inversion split',
  splitInvRR: 'RR pair or inversion split',
}

export function isArcSplitCategory(
  category: string,
): category is ArcSplitCategory {
  return category in ARC_SPLIT_SWATCH
}
