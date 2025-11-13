import { max, min } from '@jbrowse/core/util'

import { drawFeatsCommon } from './drawFeatsCommon'

import type { ComputedChain, DrawFeatsParams } from './drawFeatsCommon'
import type { LinearReadCloudDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

/**
 * Calculate Y-offsets using logarithmic scaling based on distance (params-based version for RPC)
 */
export function calculateCloudYOffsetsCore(
  computedChains: ComputedChain[],
  _params: DrawFeatsParams,
  _view: LGV,
  _featureHeight: number,
  height: number,
) {
  // Calculate Y-offsets based on distance (logarithmic scaling)
  const distances = computedChains.map(c => c.distance).filter(d => d > 0)

  if (distances.length === 0) {
    return { chainYOffsets: new Map<string, number>() }
  }

  // Use log(distance + offset) instead of log(distance) to smooth out small values
  // The offset shifts the logarithmic curve, reducing the dramatic variation for small TLEN
  // This provides a smooth compression without hard thresholds
  const logOffset = 10
  const rangePadding = 100 // Add/subtract to reduce stratification when values are similar

  const maxD = Math.log(max(distances) + logOffset + rangePadding)
  const minD = Math.log(min(distances) + logOffset - rangePadding)
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

/**
 * Calculate Y-offsets using logarithmic scaling based on distance (model-based version)
 */
function calculateCloudYOffsets(
  computedChains: ComputedChain[],
  self: LinearReadCloudDisplayModel,
  _view: LGV,
  _featureHeight: number,
) {
  // Calculate Y-offsets based on distance (logarithmic scaling)
  const distances = computedChains.map(c => c.distance).filter(d => d > 0)

  if (distances.length === 0) {
    return { chainYOffsets: new Map<string, number>() }
  }

  // Use log(distance + offset) instead of log(distance) to smooth out small values
  // The offset shifts the logarithmic curve, reducing the dramatic variation for small TLEN
  // This provides a smooth compression without hard thresholds
  const logOffset = 10
  const rangePadding = 100 // Add/subtract to reduce stratification when values are similar

  const maxD = Math.log(max(distances) + logOffset + rangePadding)
  const minD = Math.log(min(distances) + logOffset - rangePadding)
  const scaler = (self.height - 20) / (maxD - minD || 1)

  // Calculate Y-offsets for each chain
  const chainYOffsets = new Map<string, number>()
  for (const { id, distance } of computedChains) {
    const top =
      distance > 0 ? (Math.log(distance + logOffset) - minD) * scaler : 0
    chainYOffsets.set(id, top)
  }

  return { chainYOffsets }
}

export function drawFeats(
  self: LinearReadCloudDisplayModel,
  ctx: CanvasRenderingContext2D,
) {
  drawFeatsCommon(self, ctx, calculateCloudYOffsets)
}
