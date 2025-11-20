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

  // Pass 1: Count reads active at region start and record events within region
  // This is O(N) where N = number of reads
  let initialDepth = 0
  let initialStrandNeg1 = 0
  let initialStrand0 = 0
  let initialStrand1 = 0

  for (const feature of features) {
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const fstrand = feature.get('strand') as -1 | 0 | 1

    // Convert to region-relative coordinates
    const startIdx = fstart - region.start
    const endIdx = fend - region.start

    // Check if read is already active at region start (starts before region)
    if (startIdx < 0 && endIdx > 0) {
      initialDepth++
      if (fstrand === -1) {
        initialStrandNeg1++
      } else if (fstrand === 0) {
        initialStrand0++
      } else {
        initialStrand1++
      }
    }

    // Increment at start position if read starts within region
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

    // Decrement at end position if read ends within region
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
  // Initialize with reads that were already active at region start
  let depth = initialDepth
  let strandNeg1 = initialStrandNeg1
  let strand0 = initialStrand0
  let strand1 = initialStrand1

  for (let i = 0; i < regionLength; i++) {
    // Update running totals using difference array
    depth += depthDelta[i]!
    strandNeg1 += strandDeltaNeg1[i]!
    strand0 += strandDelta0[i]!
    strand1 += strandDelta1[i]!

    // Create bins for all positions (even with 0 depth)
    // This is needed because mismatches (deletions/skips) can modify bins
    // The original code had similar behavior - bins were created on-demand
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
