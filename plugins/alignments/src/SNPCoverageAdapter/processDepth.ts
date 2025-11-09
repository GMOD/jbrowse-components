import type { PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

/**
 * Factory function to create a new coverage bin
 */
function createBin(): PreBaseCoverageBin {
  return {
    depth: 0,
    readsCounted: 0,
    ref: {
      probabilitySum: 0,
      probabilityCount: 0,
      entryDepth: 0,
      '-1': 0,
      0: 0,
      1: 0,
    },
    snps: {},
    mods: {},
    nonmods: {},
    delskips: {},
    noncov: {},
  }
}

export function processDepth({
  feature,
  bins,
  region,
}: {
  feature: Feature
  bins: PreBaseCoverageBin[]
  region: AugmentedRegion
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const regionStart = region.start
  const regionLength = region.end - regionStart

  // Process all positions from fstart to fend-1 (with updates)
  for (let j = fstart; j < fend; j++) {
    const i = j - regionStart
    if (i >= 0 && i < regionLength) {
      let bin = bins[i]
      if (bin === undefined) {
        bin = bins[i] = createBin()
      }
      // Cache ref for multiple accesses
      const ref = bin.ref
      bin.depth++
      bin.readsCounted++
      ref.entryDepth++
      ref[fstrand]++
    }
  }

  // Initialize fend position without updating counts
  const endIdx = fend - regionStart
  if (endIdx >= 0 && endIdx < regionLength && bins[endIdx] === undefined) {
    bins[endIdx] = createBin()
  }
}
