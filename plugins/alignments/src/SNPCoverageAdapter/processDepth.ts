import { createPreBinEntry } from './util'

import type { PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

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

  // Calculate visible range - only iterate over positions within region
  const visStart = Math.max(fstart, regionStart)
  const visEnd = Math.min(fend + 1, regionEnd)

  for (let j = visStart; j < visEnd; j++) {
    const i = j - regionStart
    const bin = (bins[i] ??= {
      depth: 0,
      readsCounted: 0,
      ref: createPreBinEntry(),
      snps: {},
      mods: {},
      nonmods: {},
      delskips: {},
      noncov: {},
    })
    if (j !== fend) {
      bin.depth++
      bin.readsCounted++
      bin.ref.entryDepth++
      bin.ref[fstrand]++
    }
  }
}
