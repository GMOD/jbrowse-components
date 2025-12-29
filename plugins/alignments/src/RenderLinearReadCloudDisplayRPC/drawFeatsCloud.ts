import type { ComputedChain } from './drawFeatsCommon'

// Constants for cloud mode logarithmic scaling
const CLOUD_LOG_OFFSET = 10
const CLOUD_RANGE_PADDING = 100
const CLOUD_HEIGHT_PADDING = 20

/**
 * Calculate Y-offsets using logarithmic scaling for cloud mode
 */
export function calculateCloudYOffsetsUtil(
  computedChains: ComputedChain[],
  height: number,
) {
  // Find min/max distances for scaling (distance=0 chains are placed at y=0)
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
  const maxD = Math.log(maxDistance + CLOUD_LOG_OFFSET + CLOUD_RANGE_PADDING)
  const minD = Math.log(
    Math.max(1, minDistance + CLOUD_LOG_OFFSET - CLOUD_RANGE_PADDING),
  )
  const scaler = (height - CLOUD_HEIGHT_PADDING) / (maxD - minD || 1)

  // Calculate Y-offsets for each chain
  const chainYOffsets = new Map<string, number>()
  for (const { id, distance } of computedChains) {
    const top =
      distance > 0 ? (Math.log(distance + CLOUD_LOG_OFFSET) - minD) * scaler : 0
    chainYOffsets.set(id, top)
  }

  return { chainYOffsets }
}
