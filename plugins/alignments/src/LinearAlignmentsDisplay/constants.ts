export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15
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

// SYNC: mirrors width logic in shaders/cigarShaders.ts INSERTION_VERTEX_SHADER
// and wgsl/cigarShaders.ts INSERTION_WGSL
export function insertionBarWidth(len: number, pxPerBp: number) {
  const isLong = len >= LONG_INSERTION_MIN_LENGTH
  const insertionWidthPx = len * pxPerBp
  const isLarge = isLong && insertionWidthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX
  if (isLarge) {
    return textWidthForNumber(len)
  }
  if (isLong) {
    return Math.min(5, insertionWidthPx / 3)
  }
  return 1
}

export function featureFrequencyThreshold(depth: number) {
  if (depth < 10) {
    return 0.6
  }
  if (depth >= 40) {
    return 0.1
  }
  if (depth <= 30) {
    return 0.6 + ((depth - 10) / 20) * (0.2 - 0.6)
  }
  return 0.2 + ((depth - 30) / 10) * (0.1 - 0.2)
}
