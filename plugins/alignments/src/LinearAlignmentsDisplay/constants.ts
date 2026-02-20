export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15

export function insertionFrequencyThreshold(depth: number) {
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
