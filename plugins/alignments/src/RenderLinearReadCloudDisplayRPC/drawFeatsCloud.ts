import { scaleLog } from '@mui/x-charts-vendor/d3-scale'

import type { ComputedChain } from './drawFeatsCommon'

// Padding at top/bottom of cloud display
export const CLOUD_HEIGHT_PADDING = 20

export interface CloudScaleInfo {
  minDistance: number
  maxDistance: number
}

export interface CloudTicks {
  ticks: { value: number; y: number }[]
  height: number
  minDistance: number
  maxDistance: number
}

/**
 * Create a d3 log scale for cloud mode y-positioning
 * Used consistently for both read positions and tick marks
 */
export function createCloudScale(
  minDistance: number,
  maxDistance: number,
  height: number,
) {
  return scaleLog()
    .base(2)
    .domain([Math.max(1, minDistance), Math.max(2, maxDistance)])
    .range([0, height - CLOUD_HEIGHT_PADDING])
    .clamp(true)
}

/**
 * Calculate tick marks for the cloud mode y-axis scalebar
 * Uses d3 scaleLog for nice tick generation (similar to LinearWiggleDisplay)
 */
export function calculateCloudTicks(
  cloudScaleInfo: CloudScaleInfo,
  height: number,
): CloudTicks {
  const { minDistance, maxDistance } = cloudScaleInfo
  const scale = createCloudScale(minDistance, maxDistance, height)

  const tickValues = scale.ticks(6)
  const ticks = tickValues.map(value => ({
    value,
    y: scale(value),
  }))

  return { ticks, height, minDistance, maxDistance }
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

  const scale = createCloudScale(minDistance, maxDistance, height)

  // Calculate Y-offsets for each chain using the d3 scale
  const chainYOffsets = new Map<string, number>()
  for (const { id, distance } of computedChains) {
    const top = distance > 0 ? scale(distance) : 0
    chainYOffsets.set(id, top)
  }

  return {
    chainYOffsets,
    cloudScaleInfo: { minDistance, maxDistance } as CloudScaleInfo,
  }
}
