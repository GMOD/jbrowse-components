import { PAIR_DIRECTION_LABELS } from './orientation.ts'

// What a read connector means, in the words both the alignments display's
// connectors and the breakpoint split view's use.
export type ConnectionKind =
  | 'readPair'
  | 'pairLR'
  | 'pairRL'
  | 'pairRR'
  | 'pairLL'
  | 'splitDeletion'
  | 'splitInversion'
  | 'interchrom'

// A curve is drawn for split reads of either kind, so these name the split
// alignment and not a paired-end read.
export const SPLIT_JUNCTION_LABELS = {
  splitInversion: 'Split alignment (inverted)',
  splitDeletion: 'Split alignment (same strand)',
  interchrom: 'Split alignment (interchromosomal)',
} as const

export const CONNECTION_LABELS: Record<ConnectionKind, string> = {
  readPair: 'Read pair',
  pairLR: PAIR_DIRECTION_LABELS.LR,
  pairRL: PAIR_DIRECTION_LABELS.RL,
  pairRR: PAIR_DIRECTION_LABELS.RR,
  pairLL: PAIR_DIRECTION_LABELS.LL,
  splitDeletion: SPLIT_JUNCTION_LABELS.splitDeletion,
  splitInversion: SPLIT_JUNCTION_LABELS.splitInversion,
  interchrom: 'Inter-chromosomal',
}
