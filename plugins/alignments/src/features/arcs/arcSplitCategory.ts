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

// What was measured, not the variant it suggests: a forward jump is a deletion
// junction but also one side of a templated insertion.
export const ARC_SPLIT_LABELS: Record<ArcSplitCategory, string> = {
  splitForward: 'Split alignment (jumps forward)',
  splitBack: 'Split alignment (jumps back)',
  splitInvLL: 'Split alignment (inverted, LL-type)',
  splitInvRR: 'Split alignment (inverted, RR-type)',
}

export function isArcSplitCategory(
  category: string,
): category is ArcSplitCategory {
  return category in ARC_SPLIT_PAIR_TWIN
}
