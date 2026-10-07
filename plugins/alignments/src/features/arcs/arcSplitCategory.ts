// What a same-chromosome split-read arc is, by which way the read extends from
// each foot (`PendingArc.p1Dir`/`p2Dir`). A pair across the same junction falls
// in the same four classes, so each split class paints the colour of its pair
// twin and the two kinds of evidence agree at a junction. These key arcs only:
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

export function isArcSplitCategory(
  category: string,
): category is ArcSplitCategory {
  return category in ARC_SPLIT_PAIR_TWIN
}
