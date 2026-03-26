import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from '@jbrowse/alignments-core'

export {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  computeLabelFontSize,
} from '@jbrowse/alignments-core'

export const INSERTION_SERIF_MIN_PX_PER_BP = 3

// SYNC: mirrors textWidthForNumber() in shaders/cigarShaders.ts
// INSERTION_VERTEX_SHADER and wgsl/cigarShaders.ts INSERTION_WGSL
// charWidth=6px per digit + padding=10px
export function textWidthForNumber(num: number) {
  const charWidth = 6
  const padding = 10
  if (num < 10) {
    return charWidth + padding
  }
  if (num < 100) {
    return charWidth * 2 + padding
  }
  if (num < 1000) {
    return charWidth * 3 + padding
  }
  if (num < 10000) {
    return charWidth * 4 + padding
  }
  return charWidth * 5 + padding
}

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

// Returns the frequency at which a feature (mismatch, insertion, etc.) reaches
// full visibility at a given coverage depth. Features below this frequency are
// continuously faded rather than hidden, so there are no hard spatial boundaries
// where features pop in/out as depth varies across the view. At low depth we
// require high frequency (80%) since a single read's noise is more visible; at
// high depth we relax to 30% since the signal is more statistically meaningful.
// The result is used by applyDepthDependentThreshold to produce a continuous
// importance value: importance = clamp(freq / threshold, 0, 1), which the
// renderer then blends with the zoom-based sub-pixel alpha.
export function featureFrequencyThreshold(depth: number) {
  if (depth < 10) {
    return 0.8
  }
  if (depth >= 30) {
    return 0.3
  }
  return 0.8 + ((depth - 10) / 20) * (0.3 - 0.8)
}
