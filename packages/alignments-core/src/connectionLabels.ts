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

export const CONNECTION_LABELS: Record<ConnectionKind, string> = {
  readPair: 'Read pair',
  pairLR: PAIR_DIRECTION_LABELS.LR,
  pairRL: PAIR_DIRECTION_LABELS.RL,
  pairRR: PAIR_DIRECTION_LABELS.RR,
  pairLL: PAIR_DIRECTION_LABELS.LL,
  splitSameStrand: 'Split alignment (same strand)',
  splitInverted: 'Split alignment (inverted)',
  interchrom: 'Inter-chromosomal',
}
