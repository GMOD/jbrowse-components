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

// Reusable buffers - avoids allocation on every call
// Size for up to 1MB regions (should cover most use cases)
const MAX_REGION_SIZE = 1_000_000

const depthChanges = new Int32Array(MAX_REGION_SIZE + 1)
const strandPlusChanges = new Int32Array(MAX_REGION_SIZE + 1)
const strandMinusChanges = new Int32Array(MAX_REGION_SIZE + 1)

/**
 * Process feature depth using prefix sums algorithm.
 *
 * Complexity: O(features + regionSize) instead of O(features × avgReadLength)
 *
 * For 300x coverage with 50kb long reads over 100kb region:
 * - Original: O(600 × 50000) = 30M iterations
 * - This: O(600 + 100000) = 100k iterations
 */
export function processDepthPrefixSum(
  features: Feature[],
  region: AugmentedRegion,
): CoverageDepthSoA {
  const regionStart = region.start
  const regionEnd = region.end
  const regionSize = regionEnd - regionStart

  if (regionSize > MAX_REGION_SIZE) {
    throw new Error(
      `Region size ${regionSize} exceeds maximum ${MAX_REGION_SIZE}`,
    )
  }

  // Clear only the portion we need (faster than creating new arrays)
  depthChanges.fill(0, 0, regionSize + 1)
  strandPlusChanges.fill(0, 0, regionSize + 1)
  strandMinusChanges.fill(0, 0, regionSize + 1)

  // Pass 1: Record depth changes at boundaries - O(features)
  for (const feature of features) {
    const fstart = feature.get('start') as number
    const fend = feature.get('end') as number
    const fstrand = feature.get('strand') as -1 | 0 | 1

    // Clamp to visible region
    const visStart = Math.max(fstart, regionStart) - regionStart
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      // Increment at start, decrement at end
      depthChanges[visStart]++
      depthChanges[visEnd]--

      if (fstrand === 1) {
        strandPlusChanges[visStart]++
        strandPlusChanges[visEnd]--
      } else if (fstrand === -1) {
        strandMinusChanges[visStart]++
        strandMinusChanges[visEnd]--
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

/**
 * Alternative version that writes directly to pre-allocated output arrays.
 * Use this when you want to avoid allocations entirely.
 */
export function processDepthPrefixSumInto(
  features: Feature[],
  region: AugmentedRegion,
  output: CoverageDepthSoA,
): void {
  const regionStart = region.start
  const regionEnd = region.end
  const regionSize = regionEnd - regionStart

  if (regionSize > output.depth.length) {
    throw new Error(
      `Region size ${regionSize} exceeds output buffer size ${output.depth.length}`,
    )
  }

  // Clear change buffers
  depthChanges.fill(0, 0, regionSize + 1)
  strandPlusChanges.fill(0, 0, regionSize + 1)
  strandMinusChanges.fill(0, 0, regionSize + 1)

  // Pass 1: Record changes
  for (const feature of features) {
    const fstart = feature.get('start') as number
    const fend = feature.get('end') as number
    const fstrand = feature.get('strand') as -1 | 0 | 1

    const visStart = Math.max(fstart, regionStart) - regionStart
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      depthChanges[visStart]++
      depthChanges[visEnd]--

      if (fstrand === 1) {
        strandPlusChanges[visStart]++
        strandPlusChanges[visEnd]--
      } else if (fstrand === -1) {
        strandMinusChanges[visStart]++
        strandMinusChanges[visEnd]--
      }
    }
  }

  // Pass 2: Compute prefix sums into output arrays
  let d = 0
  let sp = 0
  let sm = 0

  for (let i = 0; i < regionSize; i++) {
    d += depthChanges[i]!
    sp += strandPlusChanges[i]!
    sm += strandMinusChanges[i]!

    output.depth[i] = d
    output.strandPlus[i] = sp
    output.strandMinus[i] = sm
  }

  output.regionStart = regionStart
  output.regionSize = regionSize
}
