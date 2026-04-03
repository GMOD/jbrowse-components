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
