import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  textWidthForNumber,
} from '@jbrowse/alignments-core'

export {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  computeLabelFontSize,
  textWidthForNumber,
} from '@jbrowse/alignments-core'

export const INSERTION_SERIF_MIN_PX_PER_BP = 3

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

// Linked-reads rendering mode. 'off' → ordinary pileup; 'normal' → chain
// layout with straight connecting lines; 'bezier' → chain layout with
// bezier curves.
export type LinkedReadsMode = 'off' | 'normal' | 'bezier'

// Direction of arc overlays (paired-end and sashimi). 'up' bumps into the
// coverage band; 'down' opens its own band below coverage.
export type ArcDirection = 'off' | 'up' | 'down'

// How paired-end connections are rendered. Orthogonal to direction
// (pairedConnectionsDown): 'arc' draws regular arcs colored by arcColorByType;
// 'samplot' draws flat lines at Y=|tlen| colored DEL/DUP/INV/BND, discordant
// pairs only.
export type PairedConnectionsMode = 'off' | 'arc' | 'samplot'

export type InsertionType = 'large' | 'long' | 'small'

export function getInsertionType(
  length: number,
  pxPerBp: number,
): InsertionType {
  if (length >= LONG_INSERTION_MIN_LENGTH) {
    if (length * pxPerBp >= LONG_INSERTION_TEXT_THRESHOLD_PX) {
      return 'large'
    }
    return 'long'
  }
  return 'small'
}

// SYNC: mirrors width logic in shaders/cigarShaders.ts INSERTION_VERTEX_SHADER
// and wgsl/cigarShaders.ts INSERTION_WGSL
export function insertionBarWidth(len: number, pxPerBp: number) {
  const type = getInsertionType(len, pxPerBp)
  if (type === 'large') {
    return textWidthForNumber(len)
  }
  if (type === 'long') {
    return Math.min(5, (len * pxPerBp) / 3)
  }
  return Math.min(pxPerBp, 1)
}

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
