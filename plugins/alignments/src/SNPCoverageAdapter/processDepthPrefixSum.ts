import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

/**
 * SoA (Structure of Arrays) output for coverage depth.
 * Much more memory efficient than object-per-position.
 *
 * For a 100kb region, this uses ~1.2MB (3 × 100k × 4 bytes)
 * vs ~40MB+ for 100k objects with nested properties.
 */
export interface CoverageDepthSoA {
  regionStart: number
  regionSize: number
  /** Coverage depth at each position */
  depth: Int32Array
  /** Forward strand (+1) read count at each position */
  strandPlus: Int32Array
  /** Reverse strand (-1) read count at each position */
  strandMinus: Int32Array
}

// Reusable static buffers for regions <= 1MB (avoids allocation on every call)
const STATIC_BUFFER_SIZE = 1_000_001

const staticDepthChanges = new Int32Array(STATIC_BUFFER_SIZE)
const staticStrandPlusChanges = new Int32Array(STATIC_BUFFER_SIZE)
const staticStrandMinusChanges = new Int32Array(STATIC_BUFFER_SIZE)

/**
 * Process feature depth using prefix sums algorithm.
 *
 * Complexity: O(features + regionSize) instead of O(features × avgReadLength)
 *
 * For 300x coverage with 50kb long reads over 100kb region:
 * - Original: O(600 × 50000) = 30M iterations
 * - This: O(600 + 100000) = 100k iterations
 *
 * Uses static buffers for regions <= 1MB, dynamic allocation for larger regions.
 */
export function processDepthPrefixSum(
  features: Feature[],
  region: AugmentedRegion,
): CoverageDepthSoA {
  const regionStart = region.start
  const regionEnd = region.end
  const regionSize = regionEnd - regionStart

  // Use static buffers for small regions, dynamic allocation for large ones
  let depthChanges: Int32Array
  let strandPlusChanges: Int32Array
  let strandMinusChanges: Int32Array

  if (regionSize < STATIC_BUFFER_SIZE) {
    depthChanges = staticDepthChanges
    strandPlusChanges = staticStrandPlusChanges
    strandMinusChanges = staticStrandMinusChanges
    depthChanges.fill(0, 0, regionSize + 1)
    strandPlusChanges.fill(0, 0, regionSize + 1)
    strandMinusChanges.fill(0, 0, regionSize + 1)
  } else {
    depthChanges = new Int32Array(regionSize + 1)
    strandPlusChanges = new Int32Array(regionSize + 1)
    strandMinusChanges = new Int32Array(regionSize + 1)
  }

  // Pass 1: Record depth changes at boundaries - O(features)
  for (const feature of features) {
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const fstrand = feature.get('strand') as -1 | 0 | 1

    // Clamp to visible region
    const visStart = Math.max(fstart, regionStart) - regionStart
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      // Increment at start, decrement at end
      depthChanges[visStart]!++
      depthChanges[visEnd]!--

      if (fstrand === 1) {
        strandPlusChanges[visStart]!++
        strandPlusChanges[visEnd]!--
      } else if (fstrand === -1) {
        strandMinusChanges[visStart]!++
        strandMinusChanges[visEnd]!--
      }
    }
  }

  // Pass 2: Compute prefix sums - O(regionSize)
  const depth = new Int32Array(regionSize)
  const strandPlus = new Int32Array(regionSize)
  const strandMinus = new Int32Array(regionSize)

  let d = 0
  let sp = 0
  let sm = 0

  for (let i = 0; i < regionSize; i++) {
    d += depthChanges[i]!
    sp += strandPlusChanges[i]!
    sm += strandMinusChanges[i]!

    depth[i] = d
    strandPlus[i] = sp
    strandMinus[i] = sm
  }

  return {
    regionStart,
    regionSize,
    depth,
    strandPlus,
    strandMinus,
  }
}
