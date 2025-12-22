import type { ComputedChain } from './drawFeatsCommon'

/**
 * Calculate Y-offsets using logarithmic scaling for cloud mode
 */
export function calculateCloudYOffsetsUtil(
  computedChains: ComputedChain[],
  height: number,
) {
  // Single pass: find min/max distances while filtering d > 0
  let minDistance = Number.MAX_VALUE
  let maxDistance = Number.MIN_VALUE
  let hasValidDistances = false

  for (const { distance } of computedChains) {
    if (distance > 0) {
      hasValidDistances = true
      if (distance < minDistance) {
        minDistance = distance
      }
      if (distance > maxDistance) {
        maxDistance = distance
      }
    }
  }

  if (!hasValidDistances) {
    return { chainYOffsets: new Map<string, number>() }
  }

  // Use log(distance + offset) instead of log(distance) to smooth out small values
  // The offset shifts the logarithmic curve, reducing the dramatic variation for small TLEN
  // This provides a smooth compression without hard thresholds
  const logOffset = 10
  const rangePadding = 100 // Add/subtract to reduce stratification when values are similar

  const maxD = Math.log(maxDistance + logOffset + rangePadding)
  const minD = Math.log(Math.max(1, minDistance + logOffset - rangePadding))
  const scaler = (height - 20) / (maxD - minD || 1)

  // Calculate Y-offsets for each chain
  const chainYOffsets = new Map<string, number>()
  for (const { id, distance } of computedChains) {
    const top =
      distance > 0 ? (Math.log(distance + logOffset) - minD) * scaler : 0
    chainYOffsets.set(id, top)
  }

  return { chainYOffsets }
}
