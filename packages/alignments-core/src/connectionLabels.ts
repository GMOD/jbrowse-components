import { PAIR_DIRECTION_LABELS } from './orientation.ts'

// What a read connector means, in the words both the alignments display's
// connectors and the breakpoint split view's use.
export type ConnectionKind =
  | 'readPair'
  | 'pairLR'
  | 'pairRL'
  | 'pairRR'
  | 'pairLL'
  | 'splitSameStrand'
  | 'splitInverted'
  | 'interchrom'

// A curve is drawn for split reads of either kind, so these name the split
// alignment and not a paired-end read.
export const SPLIT_JUNCTION_LABELS = {
  splitInverted: 'Split alignment (inverted)',
  splitSameStrand: 'Split alignment (same strand)',
  interchrom: 'Split alignment (interchromosomal)',
} as const

export const CONNECTION_LABELS: Record<ConnectionKind, string> = {
  readPair: 'Read pair',
  pairLR: PAIR_DIRECTION_LABELS.LR,
  pairRL: PAIR_DIRECTION_LABELS.RL,
  pairRR: PAIR_DIRECTION_LABELS.RR,
  pairLL: PAIR_DIRECTION_LABELS.LL,
  splitSameStrand: SPLIT_JUNCTION_LABELS.splitSameStrand,
  splitInverted: SPLIT_JUNCTION_LABELS.splitInverted,
  interchrom: 'Inter-chromosomal',
}
