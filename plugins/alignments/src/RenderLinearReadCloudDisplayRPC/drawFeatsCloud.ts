import { scaleLog } from '@mui/x-charts-vendor/d3-scale'

import type { ComputedChain } from './drawFeatsCommon.ts'

// Padding at top/bottom of cloud display
export const CLOUD_HEIGHT_PADDING = 20

// Default max distance when all chains are singletons
const DEFAULT_MAX_DISTANCE = 1000

export interface CloudTicks {
  ticks: { value: number; y: number }[]
  height: number
  maxDistance: number
}

/**
 * Create a d3 log scale for cloud mode y-positioning
 * Domain is [1, maxDistance] since we use a log scale (log(0) is undefined)
 */
export function createCloudScale(maxDistance: number, height: number) {
  return scaleLog()
    .base(2)
    .domain([1, Math.max(2, maxDistance)])
    .range([0, height - CLOUD_HEIGHT_PADDING])
    .clamp(true)
}

/**
 * Calculate tick marks for the cloud mode y-axis scalebar
 */
export function calculateCloudTicks(
  maxDistance: number,
  height: number,
): CloudTicks {
  const scale = createCloudScale(maxDistance, height)
  const tickValues = scale.ticks(6)
  const ticks = tickValues.map(value => ({
    value,
    y: scale(value),
  }))

  return { ticks, height, maxDistance }
}

/**
 * Calculate Y-offsets using logarithmic scaling for cloud mode
 * @param computedChains - Pre-computed chain data with distances
 * @param height - Canvas height
 */
export function calculateCloudYOffsetsUtil(
  computedChains: ComputedChain[],
  height: number,
) {
  const chainYOffsets = new Map<string, number>()

  // Compute maxDistance from visible data
  let maxDistance = Number.MIN_VALUE

  for (const { distance } of computedChains) {
    if (distance > 0) {
      maxDistance = Math.max(maxDistance, distance)
    }
  }

  // If all chains are singletons, use default max distance
  if (maxDistance === Number.MIN_VALUE) {
    maxDistance = DEFAULT_MAX_DISTANCE
  }

  const scale = createCloudScale(maxDistance, height)

  for (const { id, distance } of computedChains) {
    const top = distance > 0 ? scale(distance) : 0
    chainYOffsets.set(id, top)
  }

  return {
    chainYOffsets,
    cloudMaxDistance: maxDistance,
  }
}
