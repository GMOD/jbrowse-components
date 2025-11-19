import type { PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

function initBin(): PreBaseCoverageBin {
  return {
    depth: 0,
    readsCounted: 0,
    ref: {
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
  const regionEnd = region.end

  const clampedStart = Math.max(fstart, regionStart)
  const clampedEnd = Math.min(fend, regionEnd)

  for (let j = clampedStart; j < clampedEnd; j++) {
    const i = j - regionStart
    const bin = bins[i] || (bins[i] = initBin())
    bin.depth++
    bin.readsCounted++
    const ref = bin.ref
    ref.entryDepth++
    ref[fstrand]++
  }
}
