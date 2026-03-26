export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15
export const MIN_HEIGHT_FOR_TEXT = 5

export const MISMATCH_COLOR = '#f00'
export const DELETION_COLOR = '#888'
export const INSERTION_COLOR = '#c000c0'
export const BASE_A_COLOR = '#00bf00'
export const BASE_C_COLOR = '#4747ff'
export const BASE_G_COLOR = '#d5bb04'
export const BASE_T_COLOR = '#f00'

export function computeLabelFontSize(h: number) {
  return Math.max(5, Math.min(h - 1, 10))
}

// SYNC: mirrors textWidthForNumber() in GLSL/WGSL cigarShaders.ts
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
