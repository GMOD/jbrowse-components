export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15
export const MIN_HEIGHT_FOR_TEXT = 5

export function computeLabelFontSize(h: number) {
  return Math.max(5, Math.min(h - 1, 10))
}
