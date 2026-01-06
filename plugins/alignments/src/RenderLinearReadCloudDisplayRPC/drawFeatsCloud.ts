import { scaleLog } from '@mui/x-charts-vendor/d3-scale'

import type { ComputedChain } from './drawFeatsCommon.ts'

// Padding at top/bottom of cloud display
export const CLOUD_HEIGHT_PADDING = 20

// Default max distance when all chains are singletons
const DEFAULT_MAX_DISTANCE = 1000

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
  domain: [number, number],
  height: number,
): CloudTicks {
  const [minDistance, maxDistance] = domain
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
 * @param computedChains - Pre-computed chain data with distances
 * @param height - Canvas height
 * @param cloudDomain - Optional [min, max] domain. If provided, use it; otherwise compute from data
 */
export function calculateCloudYOffsetsUtil(
  computedChains: ComputedChain[],
  height: number,
  cloudDomain?: [number, number],
) {
  // Calculate Y-offsets for each chain using the d3 scale
  const chainYOffsets = new Map<string, number>()

  // If cloudDomain is provided, use it directly
  if (cloudDomain) {
    const [, maxDistance] = cloudDomain
    const scale = createCloudScale(1, maxDistance, height)

    for (const { id, distance } of computedChains) {
      const top = distance > 0 ? scale(distance) : 0
      chainYOffsets.set(id, top)
    }

    return {
      chainYOffsets,
      cloudMaxDistance: maxDistance,
    }
  }

  // Otherwise, compute maxDistance from data
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

  const scale = createCloudScale(1, maxDistance, height)

  for (const { id, distance } of computedChains) {
    const top = distance > 0 ? scale(distance) : 0
    chainYOffsets.set(id, top)
  }

  return {
    chainYOffsets,
    cloudMaxDistance: maxDistance,
  }
}
