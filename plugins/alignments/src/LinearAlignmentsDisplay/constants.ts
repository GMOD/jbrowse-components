export {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  computeLabelFontSize,
  getInsertionType,
  insertionBarWidth,
  textWidthForNumber,
} from '@jbrowse/alignments-core'
export type { InsertionType } from '@jbrowse/alignments-core'

export const ColorScheme = {
  normal: 0,
  strand: 1,
  mappingQuality: 2,
  insertSize: 3,
  firstOfPairStrand: 4,
  pairOrientation: 5,
  insertSizeAndOrientation: 6,
  modifications: 7,
  tag: 8,
  baseQuality: 9,
  insertSizeGradient: 10,
} as const

export const ALIGNMENTS_FUDGE_FACTOR = 0.8

// Linked-reads layout mode. 'off' → ordinary pileup; 'normal' → chain layout
// grouping mates/supplementary alignments onto shared rows with connecting
// lines. Bezier connection curves are orthogonal to layout (see the
// `showBezierConnections` flag) and draw over either mode.
export type LinkedReadsMode = 'off' | 'normal'

// How read connections (mate pairs + split/chimeric reads) are rendered.
// Orthogonal to direction (readConnectionsDown): 'arc' draws regular arcs;
// 'samplot' (read cloud) draws flat lines at Y=|tlen|, discordant pairs only.
// Both color by arcColorByType (red/green/teal/navy by insert size + orientation).
export type ReadConnectionsMode = 'off' | 'arc' | 'samplot'

// Returns the minimum frequency at which a feature (mismatch, insertion, etc.)
// is shown at a given coverage depth. Features below this threshold are zeroed
// out. At low depth we require high frequency (80%) since a single read's noise
// is more visible; at high depth we relax to 30% since the signal is more
// statistically meaningful.
export function featureFrequencyThreshold(depth: number) {
  if (depth < 10) {
    return 0.8
  }
  if (depth >= 30) {
    return 0.3
  }
  return 0.8 + ((depth - 10) / 20) * (0.3 - 0.8)
}
