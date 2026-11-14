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
  splitInsertion: 'shortInsert',
} as const satisfies Record<string, SwatchCategory>

export type ArcSplitCategory = keyof typeof ARC_SPLIT_SWATCH

// How the two ends of a split relate, as DELLY, LUMPY and samplot name the
// junction type, and not a variant call: a deletion-type junction is also one
// side of a templated insertion. The inversion rows carry the pair code of
// their twin, as Manta ties INV3/INV5 to LL/RR reads. A connector through a
// segment not in view states it as a relation rather than a junction.
export const ARC_SPLIT_RELATIONS: Record<ArcSplitCategory, string> = {
  splitForward: 'deletion-type',
  splitBack: 'duplication-type',
  splitInvLL: 'inversion, LL-type',
  splitInvRR: 'inversion, RR-type',
  splitInsertion: 'insertion',
}

function splitLabel(category: ArcSplitCategory) {
  return `Split read (${ARC_SPLIT_RELATIONS[category]})`
}

export const ARC_SPLIT_LABELS: Record<ArcSplitCategory, string> = {
  splitForward: splitLabel('splitForward'),
  splitBack: splitLabel('splitBack'),
  splitInvLL: splitLabel('splitInvLL'),
  splitInvRR: splitLabel('splitInvRR'),
  splitInsertion: splitLabel('splitInsertion'),
}

// The one row a split class and its pair twin share when a key holds both: they
// paint one color, and two rows of one color read as two meanings.
export const ARC_SPLIT_MERGED_LABELS: Record<ArcSplitCategory, string> = {
  splitForward: 'Same-strand or deletion-type split',
  splitBack: 'RL pair or duplication-type split',
  splitInvLL: 'LL pair or inversion split',
  splitInvRR: 'RR pair or inversion split',
  splitInsertion: 'Short insert or insertion split',
}

export function isArcSplitCategory(
  category: string,
): category is ArcSplitCategory {
  return category in ARC_SPLIT_SWATCH
}
