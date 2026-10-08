// What a same-chromosome split-read arc is, by which way the read extends from
// each foot (`PendingArc.p1Dir`/`p2Dir`). A pair across the same junction falls
// in the same four classes. The deletion-type split paints the split-read gold;
// the other three paint their pair twin's color, so a duplication-type
// junction and the two ends of an inversion read the same in both kinds of
// evidence. These key arcs only:
// a read fill belongs to a segment, which can sit between two junctions of
// different classes, and stays strand-only (`splitDeletion`/`splitInversion`).
export const ARC_SPLIT_PAIR_TWIN = {
  splitForward: 'longInsert',
  splitBack: 'pairRL',
  splitInvLL: 'pairLL',
  splitInvRR: 'pairRR',
} as const

export type ArcSplitCategory = keyof typeof ARC_SPLIT_PAIR_TWIN

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
export const ARC_SPLIT_MERGED_LABELS: Record<
  Exclude<ArcSplitCategory, 'splitForward'>,
  string
> = {
  splitBack: 'RL pair or duplication-type split',
  splitInvLL: 'LL pair or inversion split',
  splitInvRR: 'RR pair or inversion split',
}

export function isArcSplitCategory(
  category: string,
): category is ArcSplitCategory {
  return category in ARC_SPLIT_PAIR_TWIN
}
