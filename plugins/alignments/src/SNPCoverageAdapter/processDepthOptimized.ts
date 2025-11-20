import type { PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

/**
 * Optimized depth calculation using the mosdepth difference array algorithm.
 *
 * Instead of iterating through every base position of every read (O(N×M)),
 * this approach:
 * 1. Records start/end events for each read (O(N))
 * 2. Computes cumulative sum to get depth at all positions (O(R))
 *
 * For 200× coverage with 100bp reads over 3kb region:
 * - Old approach: 600 reads × 100 positions = 60,000 iterations
 * - New approach: 600 + 3,000 = 3,600 operations (~17× faster)
 *
 * Reference: https://github.com/brentp/mosdepth
 */
export function processDepthOptimized({
  features,
  bins,
  region,
}: {
  features: Feature[]
  bins: PreBaseCoverageBin[]
  region: AugmentedRegion
}) {
  const regionLength = region.end - region.start

  // Allocate difference arrays for depth calculation
  // These track increments/decrements at each position
  const depthDelta = new Int32Array(regionLength)

  // Separate arrays for each strand direction
  const strandDeltaNeg1 = new Int32Array(regionLength)
  const strandDelta0 = new Int32Array(regionLength)
  const strandDelta1 = new Int32Array(regionLength)

  // Pass 1: Record start/end events for all reads
  // This is O(N) where N = number of reads
  for (const feature of features) {
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const fstrand = feature.get('strand') as -1 | 0 | 1

    // Convert to region-relative coordinates
    const startIdx = fstart - region.start
    const endIdx = fend - region.start

    // Increment at start position (read begins contributing to depth)
    if (startIdx >= 0 && startIdx < regionLength) {
      depthDelta[startIdx]!++
      if (fstrand === -1) {
        strandDeltaNeg1[startIdx]!++
      } else if (fstrand === 0) {
        strandDelta0[startIdx]!++
      } else {
        strandDelta1[startIdx]!++
      }
    }

    // Decrement at end position (read stops contributing to depth)
    // Note: endIdx is exclusive, matching the original behavior where
    // the loop condition is "j < fend + 1" with "if (j !== fend)"
    if (endIdx >= 0 && endIdx < regionLength) {
      depthDelta[endIdx]!--
      if (fstrand === -1) {
        strandDeltaNeg1[endIdx]!--
      } else if (fstrand === 0) {
        strandDelta0[endIdx]!--
      } else {
        strandDelta1[endIdx]!--
      }
    }
  }

  // Pass 2: Compute cumulative sum to get actual depth values
  // This is O(R) where R = region length
  let depth = 0
  let strandNeg1 = 0
  let strand0 = 0
  let strand1 = 0

  for (let i = 0; i < regionLength; i++) {
    // Update running totals using difference array
    depth += depthDelta[i]!
    strandNeg1 += strandDeltaNeg1[i]!
    strand0 += strandDelta0[i]!
    strand1 += strandDelta1[i]!

    // Only create bins where there's actual coverage
    // This maintains the sparse array behavior of the original
    if (depth > 0) {
      bins[i] = {
        depth,
        readsCounted: depth,
        ref: {
          probabilities: [],
          entryDepth: depth,
          '-1': strandNeg1,
          '0': strand0,
          '1': strand1,
        },
        snps: {},
        mods: {},
        nonmods: {},
        delskips: {},
        noncov: {},
      }
    }
  }
}
