import type { ComputedChain } from './drawFeatsCommon'

// Constants for cloud mode logarithmic scaling
export const CLOUD_LOG_OFFSET = 10
export const CLOUD_HEIGHT_PADDING = 20

export interface CloudScaleInfo {
  minDistance: number
  maxDistance: number
}

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

  for (const { distance } of computedChains) {
    if (distance > 0) {
      minDistance = Math.min(minDistance, distance)
      maxDistance = Math.max(maxDistance, distance)
    }
  }

  if (minDistance === Number.MAX_VALUE) {
    return {
      chainYOffsets: new Map<string, number>(),
      cloudScaleInfo: undefined as CloudScaleInfo | undefined,
    }
  }

  // Use log(distance + offset) instead of log(distance) to smooth out small values
  const maxD = Math.log(maxDistance + CLOUD_LOG_OFFSET)
  const minD = Math.log(Math.max(1, minDistance + CLOUD_LOG_OFFSET))
  const scaler = (height - CLOUD_HEIGHT_PADDING) / (maxD - minD || 1)

  // Calculate Y-offsets for each chain
  const chainYOffsets = new Map<string, number>()
  for (const { id, distance } of computedChains) {
    const top =
      distance > 0 ? (Math.log(distance + CLOUD_LOG_OFFSET) - minD) * scaler : 0
    chainYOffsets.set(id, top)
  }

  return {
    chainYOffsets,
    cloudScaleInfo: { minDistance, maxDistance } as CloudScaleInfo,
  }
}
