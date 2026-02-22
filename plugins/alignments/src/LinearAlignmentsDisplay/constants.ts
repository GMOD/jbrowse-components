export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15
export const INSERTION_SERIF_MIN_PX_PER_BP = 3
export const INSERTION_TEXT_MIN_PX_PER_BP = 6.5

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
